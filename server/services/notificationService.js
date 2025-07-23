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