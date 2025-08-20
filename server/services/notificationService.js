import webpush from 'web-push';
import cron from 'node-cron';
import { config } from '../config/index.js';
import {
  getAllActivePushSubscriptions,
  getPushSubscriptions,
  storePushSubscription,
  removePushSubscription,
  removeSpecificPushSubscription,
  trackNotificationSent,
  trackNotificationError,
  logNotificationEvent
} from '../database.js';
import { fetchOlaClickData, getTimezoneAwareDate } from './olaClickService.js';
import { pool } from '../database.js';

// Configure Web Push
export function configureWebPush() {
  webpush.setVapidDetails(
    `mailto:${config.vapid.contact}`,
    config.vapid.publicKey,
    config.vapid.privateKey
  );
}

// Schedule daily reports with frequency-based delivery
export function scheduleDailyReports() {
  // Run every 30 minutes to check for users who need notifications
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔔 Checking for users ready for notifications...');
    
    try {
      // Get all active subscriptions
      const subscriptions = await getAllActivePushSubscriptions();
        
      if (subscriptions.length === 0) {
        console.log('📊 No active subscriptions found');
        return;
      }
      
      // Group subscriptions by user to avoid duplicate notifications
      const userSubscriptionsMap = new Map();
      subscriptions.forEach(sub => {
        if (!userSubscriptionsMap.has(sub.userId)) {
          userSubscriptionsMap.set(sub.userId, {
            user: sub.user,
            devices: []
          });
        }
        userSubscriptionsMap.get(sub.userId).devices.push(sub);
      });
      
      console.log(`📊 Found ${userSubscriptionsMap.size} unique users with ${subscriptions.length} total devices`);
          
      for (const [userId, {user, devices}] of userSubscriptionsMap) {
        // Only admins and super-admins receive sales reports
        if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
          continue;
        }
        if (!user.accounts || user.accounts.length === 0) {
          console.log(`📊 Skipping user ${user.email} - no accounts assigned`);
          continue;
        }
        
        // Use the most recent device's notification frequency and timing
        const latestDevice = devices.sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt))[0];
        const { notificationFrequency, lastNotificationTime } = latestDevice;
        
        // Check if enough time has passed since last notification
        const now = new Date();
        const lastNotification = lastNotificationTime ? new Date(lastNotificationTime) : null;
        const frequencyMs = (notificationFrequency || 30) * 60 * 1000; // Convert minutes to milliseconds
        
        // If no last notification or enough time has passed
        if (!lastNotification || (now.getTime() - lastNotification.getTime()) >= frequencyMs) {
          console.log(`📊 User ${user.email} ready for ${notificationFrequency}-minute notification (${devices.length} devices)`);
            
          try {
            // Generate report for this user
            const report = await generateUserDailyReport(user, latestDevice);
            
            if (report) {
              // Send notification to ALL user devices
              let successCount = 0;
              let errorCount = 0;
              
              for (const deviceSub of devices) {
                try {
                  await webpush.sendNotification(
                    deviceSub.subscription,
                    JSON.stringify(report)
                  );
                  successCount++;
                  console.log(`📨 Sent to ${user.email} (${deviceSub.deviceName || 'Unknown Device'})`);
                } catch (deviceError) {
                  errorCount++;
                  console.error(`❌ Failed to send to device ${deviceSub.deviceName}: ${deviceError.message}`);
                  
                  // Track error for this specific device
                  await trackNotificationError(userId, `Device ${deviceSub.deviceName}: ${deviceError.message}`);
                  
                  // Remove invalid subscription (410 = Gone)
                  if (deviceError.statusCode === 410) {
                    await removeSpecificPushSubscription(deviceSub.endpoint);
                    console.log(`🗑️ Removed invalid device subscription: ${deviceSub.deviceName}`);
                  }
                }
              }
              
              // Track notification sent for the user (if at least one device succeeded)
              if (successCount > 0) {
                await trackNotificationSent(userId);
                console.log(`✅ Report sent to ${successCount}/${devices.length} devices for: ${user.email}`);
              }
            }
            
          } catch (error) {
            console.error(`❌ Error generating report for ${user.email}:`, error);
            await trackNotificationError(userId, error.message);
          }
        } else {
          // Calculate time remaining until next notification
          const timeRemaining = frequencyMs - (now.getTime() - lastNotification.getTime());
          const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));
          console.log(`⏰ User ${user.email} not ready yet (${minutesRemaining} minutes remaining, ${devices.length} devices)`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in frequency-based notifications check:', error);
      
      await logNotificationEvent(
        '00000000-0000-0000-0000-000000000000',
        'frequency_notifications_error',
        'Frequency-based notifications check failed',
        { error: error.message },
        false,
        error.message
      );
    }
  });
  
  console.log('⏰ Frequency-based notifications scheduled to run every 30 minutes');
}

// Manual employee notification: shift updated
export async function notifyUserShiftUpdate(userId) {
  try {
    // De-dup within short window to prevent multiple sends during bulk save
    const recent = await pool.query(
      `SELECT 1 FROM notification_logs 
        WHERE user_id = $1 
          AND event_type = 'shift_update_notify' 
          AND created_at > NOW() - INTERVAL '45 seconds' 
        LIMIT 1`,
      [userId]
    )
    if (recent.rowCount > 0) {
      await logNotificationEvent(userId, 'shift_update_notify', 'Skipped due to dedup (recent notification)', { reason: 'dedup_window' }, true)
      return { hasSubscriptions: false, deviceCount: 0, sentCount: 0, errors: [], skippedDueToDedup: true }
    }
    const subs = await getPushSubscriptions(userId);
    const result = { hasSubscriptions: !!(subs && subs.length), deviceCount: subs?.length || 0, sentCount: 0, errors: [] };
    if (!result.hasSubscriptions) {
      await logNotificationEvent(userId, 'shift_update_notify', 'No active push subscriptions for user', { reason: 'no_active_subscriptions' }, true);
      return result;
    }
    const payload = {
      title: '🗓️ New shift ready',
      body: 'New shift ready, check it',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'shift-update',
      data: { url: '/timesheet', type: 'shift-update', timestamp: Date.now() }
    };
    for (const s of subs) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload));
        result.sentCount++;
      } catch (err) {
        result.errors.push({ endpoint: s.endpoint?.slice(0, 40) + '...', statusCode: err.statusCode, message: err.message });
        await trackNotificationError(userId, err.message);
        if (err.statusCode === 410) {
          await removeSpecificPushSubscription(s.endpoint);
        }
      }
    }
    if (result.sentCount > 0) await trackNotificationSent(userId);
    await logNotificationEvent(
      userId,
      'shift_update_notify',
      result.sentCount > 0 ? 'Shift update notification sent' : 'Shift update notification not sent',
      { devices: result.deviceCount, sent: result.sentCount, errors: result.errors },
      result.sentCount > 0
    );
    return result;
  } catch (e) {
    await logNotificationEvent(userId, 'shift_update_notify_error', 'Failed to send shift update notification', { error: e.message }, false, e.message);
    return { hasSubscriptions: false, deviceCount: 0, sentCount: 0, errors: [{ message: e.message }] };
  }
}

// Manual employee notification: paid for period
export async function notifyUserPaid(userId, amount, currency, periodStart, periodEnd) {
  try {
    // De-dup per period: if already notified, skip
    const exists = await pool.query(
      `SELECT 1 FROM notification_logs 
        WHERE user_id = $1 
          AND event_type = 'payroll_paid_notify'
          AND payload->>'periodStart' = $2
          AND payload->>'periodEnd' = $3
        LIMIT 1`,
      [userId, String(periodStart), String(periodEnd)]
    )
    if (exists.rowCount > 0) {
      await logNotificationEvent(userId, 'payroll_paid_notify', 'Skipped due to existing period notification', { periodStart, periodEnd, reason: 'already_notified' }, true)
      return { hasSubscriptions: false, deviceCount: 0, sentCount: 0, errors: [], skippedDueToDedup: true }
    }
    const subs = await getPushSubscriptions(userId);
    if (!subs || subs.length === 0) return false;
    const payload = {
      title: '💵 Payroll Paid',
      body: `You have been paid ${amount} ${currency}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `payroll-paid-${periodStart}-${periodEnd}`,
      data: { url: '/timesheet', type: 'payroll-paid', periodStart, periodEnd, amount, currency, timestamp: Date.now() }
    };
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload));
        sent++;
      } catch (err) {
        await trackNotificationError(userId, err.message);
        if (err.statusCode === 410) {
          await removeSpecificPushSubscription(s.endpoint);
        }
      }
    }
    if (sent > 0) await trackNotificationSent(userId);
    await logNotificationEvent(userId, 'payroll_paid_notify', 'Payroll paid notification sent', { amount, currency, periodStart, periodEnd, devices: subs.length, sent }, true);
    return sent > 0;
  } catch (e) {
    await logNotificationEvent(userId, 'payroll_paid_notify_error', 'Failed to send payroll paid notification', { error: e.message }, false, e.message);
    return false;
  }
}

// Admin alert: late employees, checked every 10 minutes, do-not-spam per entry
export function scheduleLateEmployeeAlerts() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      // Find open entries with shift_start older than 10 minutes and no clock_in yet? We need employees whose shift started but no open entry.
      // Approach: For each employee shift today, if now > shift_start + 10m and there is no time_entries for today for that user/account, they are late.
      const now = new Date();
      const today = now.toISOString().slice(0,10);
      // Build candidate rows from employee_shifts joined to users and company_accounts
      const q = await pool.query(`
        WITH today_shifts AS (
          SELECT es.user_id, es.company_token, es.weekday, es.start_time
          FROM employee_shifts es
          WHERE es.weekday = EXTRACT(DOW FROM CURRENT_DATE)::int
        )
        SELECT ts.user_id, ts.company_token, u.name AS user_name, u.company_id, ts.start_time
        FROM today_shifts ts
        JOIN users u ON u.id = ts.user_id AND u.is_active = TRUE
      `);
      if (q.rowCount === 0) return;
      for (const row of q.rows) {
        // Check if this user's shift start is >10m ago local? Use server time as baseline
        const startIsoLocal = `${today}T${String(row.start_time).split('.')[0]}`;
        const start = new Date(startIsoLocal);
        if (isNaN(start.getTime())) continue;
        if (now.getTime() - start.getTime() < 10 * 60 * 1000) continue;
        // Check if any entry exists today for this user/account
        const e = await pool.query(
          `SELECT 1 FROM time_entries 
           WHERE user_id = $1 AND company_token = $2 
             AND clock_in_at >= $3::date AND clock_in_at < ($3::date + INTERVAL '1 day')
           LIMIT 1`,
          [row.user_id, row.company_token, today]
        );
        if (e.rowCount > 0) continue; // already clocked something
        // De-dup: has admin already been notified about this lateness today? Use notification_logs tag
        const exists = await pool.query(
          `SELECT 1 FROM notification_logs 
           WHERE event_type = 'late_employee_alert' 
             AND payload->>'userId' = $1 
             AND payload->>'companyToken' = $2
             AND created_at >= CURRENT_DATE`,
          [row.user_id, row.company_token]
        );
        if (exists.rowCount > 0) continue;

        // Notify company admins: find push subscriptions for admins of the same company
        const admins = await pool.query(
          `SELECT ps.* , u.email, u.name
           FROM push_subscriptions ps
           JOIN users u ON u.id = ps.user_id
           WHERE ps.is_active = TRUE AND u.role IN ('admin','super-admin')
             AND (u.company_id = $1 OR u.role = 'super-admin')`,
          [row.company_id]
        );
        if (admins.rowCount === 0) continue;
        const payload = {
          title: '⏰ Employee late',
          body: `${row.user_name} is late`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: `late-${row.user_id}-${today}`,
          data: { type: 'late-employee', userId: row.user_id, companyToken: row.company_token, date: today, timestamp: Date.now(), url: '/admin/payroll' }
        };
        let notified = 0;
        for (const admin of admins.rows) {
          try {
            await webpush.sendNotification({ endpoint: admin.endpoint, keys: { p256dh: admin.p256dh_key, auth: admin.auth_key } }, JSON.stringify(payload));
            notified++;
          } catch (err) {
            await trackNotificationError(admin.user_id, err.message);
            if (err.statusCode === 410) await removeSpecificPushSubscription(admin.endpoint);
          }
        }
        if (notified > 0) {
          await logNotificationEvent('00000000-0000-0000-0000-000000000000', 'late_employee_alert', `${row.user_name} is late`, { userId: row.user_id, companyToken: row.company_token, date: today, notified }, true);
        }
      }
    } catch (err) {
      await logNotificationEvent('00000000-0000-0000-0000-000000000000', 'late_employee_alert_error', 'Failed late employee check', { error: err.message }, false, err.message);
    }
  });
  console.log('⏰ Late employee alerts scheduled to run every 10 minutes');
}

// Notify company admins that an employee clocked in/out
export async function notifyAdminsClockEvent({ companyId, companyToken, userId, userName, action, timestamp, timezone, punctuality, shiftStart }) {
  try {
    // Resolve account name
    const acct = await pool.query(`SELECT account_name FROM company_accounts WHERE company_id = $1 AND company_token = $2 LIMIT 1`, [companyId, companyToken])
    const accountName = acct.rows[0]?.account_name || companyToken

    // Find admin recipients in this company and all super-admins
    const admins = await pool.query(
      `SELECT ps.* , u.email, u.name
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id
        WHERE ps.is_active = TRUE AND u.is_active = TRUE
          AND (u.role = 'super-admin' OR (u.role = 'admin' AND u.company_id = $1))`,
      [companyId]
    )
    if (admins.rowCount === 0) {
      await logNotificationEvent(userId, 'clock_event_admin_notify', 'No admin subscribers for company', { companyId, companyToken, userId, action }, true)
      return { sent: 0, devices: 0 }
    }

    // Build enhanced notification message
    const titleAction = action === 'clock_in' ? '🔓 Clock In' : '🔒 Clock Out'
    let body = `${userName || 'Employee'} ${action === 'clock_in' ? 'clocked in' : 'clocked out'} at ${timestamp}`
    
    // Add punctuality information for clock-in events
    if (action === 'clock_in' && punctuality) {
      if (punctuality.type === 'late') {
        body += ` (${punctuality.minutes} min late)`
      } else if (punctuality.type === 'early') {
        body += ` (${punctuality.minutes} min early)`
      } else if (punctuality.type === 'on_time') {
        body += ` (on time)`
      }
    }
    
    body += ` • ${accountName}`
    
    const payload = {
      title: titleAction,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `clock-${userId}-${action}-${companyToken}`,
      data: { 
        type: 'clock-event', 
        userId, 
        userName, 
        action, 
        companyToken, 
        accountName, 
        timestamp, 
        timezone,
        punctuality,
        shiftStart,
        url: '/admin/payroll' 
      }
    }

    let sent = 0
    for (const admin of admins.rows) {
      try {
        await webpush.sendNotification({ endpoint: admin.endpoint, keys: { p256dh: admin.p256dh_key, auth: admin.auth_key } }, JSON.stringify(payload))
        sent++
      } catch (err) {
        await trackNotificationError(admin.user_id, err.message)
        if (err.statusCode === 410) await removeSpecificPushSubscription(admin.endpoint)
      }
    }
    await logNotificationEvent(userId, 'clock_event_admin_notify', `Clock ${action} sent to admins`, { companyId, companyToken, userId, userName, sent }, true)
    return { sent, devices: admins.rowCount }
  } catch (err) {
    await logNotificationEvent(userId, 'clock_event_admin_notify_error', 'Failed to notify admins of clock event', { error: err.message, companyId, companyToken, userId, action }, false, err.message)
    return { sent: 0, devices: 0, error: err.message }
  }
}

// Generate daily report for a specific user
async function generateUserDailyReport(user, subscriptionData) {
  try {
    const timezone = subscriptionData.timezone || 'America/Lima';
    const currency = subscriptionData.currency || 'PEN';
    const currencySymbol = subscriptionData.currencySymbol || 'S/';
    const frequency = subscriptionData.notificationFrequency || 30;
    
    // Get today's date in user's timezone (properly timezone-aware)
    const todayString = getTimezoneAwareDate(null, timezone);
    
    // Prepare parameters for OlaClick API
    const baseParams = {
      'filter[start_date]': todayString,
      'filter[end_date]': todayString,
      'filter[timezone]': timezone
    };
    
    console.log(`📊 Generating ${frequency}-minute report for ${user.email}`);
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Currency: ${currency} (${currencySymbol})`);
    console.log(`   Date: ${todayString}`);
    
    // Fetch data from all user's accounts
    const promises = user.accounts.map(account => 
      fetchOlaClickData(account, baseParams)
    );
    
    const results = await Promise.all(promises);
    
    // Filter successful results
    const successfulResults = results.filter(result => result.success);
    
    if (successfulResults.length === 0) {
      console.log(`📊 No successful data for ${user.email}`);
      return null;
    }
    
    // Calculate totals
    let totalAmount = 0;
    let totalPayments = 0;
    let totalAccounts = successfulResults.length;
    
    successfulResults.forEach(result => {
      if (result.data && result.data.data) {
        result.data.data.forEach(method => {
          totalAmount += method.sum || 0;
          totalPayments += method.count || 0;
        });
      }
    });
    
    // Format currency
    const formattedAmount = `${currencySymbol} ${totalAmount.toFixed(2)}`;
    
    // Determine notification title based on frequency
    const getFrequencyLabel = (freq) => {
      switch(freq) {
        case 30: return '30-Minute';
        case 60: return 'Hourly';
        case 240: return '4-Hour';
        case 480: return '8-Hour';
        default: return 'Regular';
      }
    };
    
    const frequencyLabel = getFrequencyLabel(frequency);
    
    // Create notification payload
    const notificationPayload = {
      title: `📊 ${frequencyLabel} Sales Report`,
      body: `${formattedAmount} from ${totalPayments} payments across ${totalAccounts} account${totalAccounts > 1 ? 's' : ''}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `${frequency}-minute-report`,
      data: {
        url: '/',
        type: 'sales-report',
        frequency: frequency,
        timestamp: Date.now(),
        stats: {
          totalAmount,
          totalPayments,
          totalAccounts,
          currency,
          currencySymbol
        }
      },
      actions: [
        {
          action: 'view',
          title: 'View Dashboard'
        },
        {
          action: 'settings',
          title: 'Notification Settings'
        }
      ]
    };
    
    console.log(`📨 ${frequencyLabel} report generated for ${user.email}: ${formattedAmount}, ${totalPayments} payments`);
    
    return notificationPayload;
    
  } catch (error) {
    console.error(`❌ Error generating ${subscriptionData.notificationFrequency || 30}-minute report for ${user.email}:`, error);
    
    await logNotificationEvent(
      '00000000-0000-0000-0000-000000000000',
      'report_generation_error',
      `Failed to generate ${subscriptionData.notificationFrequency || 30}-minute report for ${user.email}`,
      { 
        error: error.message,
        userEmail: user.email,
        frequency: subscriptionData.notificationFrequency || 30
      },
      false,
      error.message
    );
    
    return null;
  }
}

// Send daily reports to all subscribers (legacy function for manual triggering)
export async function sendDailyReports() {
  console.log('📊 Starting manual daily report generation...');
  
  try {
    const subscriptions = await getAllActivePushSubscriptions();
    
    // Group subscriptions by user to avoid duplicate notifications
    const userSubscriptionsMap = new Map();
    subscriptions.forEach(sub => {
      if (!userSubscriptionsMap.has(sub.userId)) {
        userSubscriptionsMap.set(sub.userId, {
          user: sub.user,
          devices: []
        });
      }
      userSubscriptionsMap.get(sub.userId).devices.push(sub);
    });
    
    console.log(`📊 Manual report for ${userSubscriptionsMap.size} users with ${subscriptions.length} total devices`);
    
    for (const [userId, {user, devices}] of userSubscriptionsMap) {
      if (!user.accounts || user.accounts.length === 0) {
        console.log(`📊 Skipping user ${user.email} - no accounts assigned`);
        continue;
      }
      
      try {
        // Use the most recent device for report generation
        const latestDevice = devices.sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt))[0];
        
        // Generate report for this user
        const report = await generateUserDailyReport(user, latestDevice);
        
        if (report) {
          // Send notification to ALL user devices
          let successCount = 0;
          
          for (const deviceSub of devices) {
            try {
              await webpush.sendNotification(
                deviceSub.subscription,
                JSON.stringify(report)
              );
              successCount++;
              console.log(`📨 Manual report sent to ${user.email} (${deviceSub.deviceName || 'Unknown Device'})`);
            } catch (deviceError) {
              console.error(`❌ Failed to send manual report to device ${deviceSub.deviceName}: ${deviceError.message}`);
              
              // Track error for this specific device
              await trackNotificationError(userId, `Manual report - Device ${deviceSub.deviceName}: ${deviceError.message}`);
              
              // Remove invalid subscription (410 = Gone)
              if (deviceError.statusCode === 410) {
                await removeSpecificPushSubscription(deviceSub.endpoint);
                console.log(`🗑️ Removed invalid device subscription: ${deviceSub.deviceName}`);
              }
            }
          }
          
          // Track notification sent for the user (if at least one device succeeded)
          if (successCount > 0) {
            await trackNotificationSent(userId);
            console.log(`✅ Manual report sent to ${successCount}/${devices.length} devices for: ${user.email}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error generating manual report for ${user.email}:`, error);
        await trackNotificationError(userId, error.message);
      }
    }
    
    console.log('✅ Manual daily reports generation completed');
    
  } catch (error) {
    console.error('❌ Error in manual daily reports generation:', error);
    
    await logNotificationEvent(
      '00000000-0000-0000-0000-000000000000',
      'manual_daily_reports_error',
      'Manual daily reports generation failed',
      { error: error.message },
      false,
      error.message
    );
  }
} 