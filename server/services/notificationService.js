import webpush from 'web-push';
import cron from 'node-cron';
import { config } from '../config/index.js';
import {
  getAllActivePushSubscriptions,
  storePushSubscription,
  removePushSubscription,
  trackNotificationSent,
  trackNotificationError,
  logNotificationEvent
} from '../database.js';
import { fetchOlaClickData } from './olaClickService.js';

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
      // Check for each frequency interval
      const frequencies = [30, 60, 240, 480]; // 30min, 1h, 4h, 8h
      
      for (const frequency of frequencies) {
        const subscriptions = await getAllActivePushSubscriptions(frequency);
        
        if (subscriptions.length > 0) {
          console.log(`📊 Found ${subscriptions.length} users ready for ${frequency}-minute notifications`);
          
          for (const subscriptionData of subscriptions) {
            const { userId, user } = subscriptionData;
            
            if (!user.accounts || user.accounts.length === 0) {
              console.log(`📊 Skipping user ${user.email} - no accounts assigned`);
              continue;
            }
            
            try {
              // Generate report for this user
              const report = await generateUserDailyReport(user, subscriptionData);
              
              if (report) {
                // Send notification
                await webpush.sendNotification(
                  subscriptionData.subscription,
                  JSON.stringify(report)
                );
                
                await trackNotificationSent(userId);
                console.log(`📨 ${frequency}-minute report sent to: ${user.email}`);
              }
              
            } catch (error) {
              console.error(`❌ Error sending ${frequency}-minute report to ${user.email}:`, error);
              
              await trackNotificationError(userId, error.message);
              
              // Remove invalid subscription (410 = Gone)
              if (error.statusCode === 410) {
                await removePushSubscription(userId);
                console.log(`🗑️ Removed invalid subscription for: ${user.email}`);
              }
            }
          }
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
    
    // Get today's date in user's timezone
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
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
    
    for (const subscriptionData of subscriptions) {
      const { userId, user } = subscriptionData;
      
      if (!user.accounts || user.accounts.length === 0) {
        console.log(`📊 Skipping user ${user.email} - no accounts assigned`);
        continue;
      }
      
      try {
        // Generate report for this user
        const report = await generateUserDailyReport(user, subscriptionData);
        
        if (report) {
          // Send notification
          await webpush.sendNotification(
            subscriptionData.subscription,
            JSON.stringify(report)
          );
          
          await trackNotificationSent(userId);
          console.log(`📨 Manual report sent to: ${user.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Error sending manual report to ${user.email}:`, error);
        
        await trackNotificationError(userId, error.message);
        
        // Remove invalid subscription (410 = Gone)
        if (error.statusCode === 410) {
          await removePushSubscription(userId);
          console.log(`🗑️ Removed invalid subscription for: ${user.email}`);
        }
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