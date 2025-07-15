import { Router } from 'express';
import webpush from 'web-push';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { config } from '../config/index.js';
import {
  storePushSubscription,
  getPushSubscription,
  removePushSubscription,
  trackNotificationSent,
  trackNotificationError,
  logNotificationEvent,
  getNotificationLogs,
  updateNotificationFrequency,
  healthCheck
} from '../database.js';
import { sendDailyReports } from '../services/notificationService.js';

const router = Router();

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: config.vapid.publicKey
  });
});

// Subscribe to push notifications
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const { subscription, userAgent: clientUserAgent, notificationFrequency } = req.body;
    const userId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    await logNotificationEvent(userId, 'subscribe_attempt', 'Push notification subscription attempt', { 
      userAgent,
      endpoint: subscription?.endpoint,
      hasKeys: !!(subscription?.keys),
      hasP256dh: !!(subscription?.keys?.p256dh),
      hasAuth: !!(subscription?.keys?.auth)
    }, true, null, userAgent);
    
    if (!subscription || !subscription.endpoint) {
      const error = 'Invalid subscription data';
      await logNotificationEvent(userId, 'subscribe_error', error, { subscription, userAgent }, false, error, userAgent);
      return res.status(400).json({
        success: false,
        error,
        details: {
          hasSubscription: !!subscription,
          hasEndpoint: !!subscription?.endpoint,
          subscriptionKeys: subscription ? Object.keys(subscription) : []
        }
      });
    }
    
    // Validate required subscription properties
    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      const error = 'Missing required subscription keys';
      await logNotificationEvent(userId, 'subscribe_error', error, { subscription, userAgent }, false, error, userAgent);
      return res.status(400).json({
        success: false,
        error,
        details: {
          hasKeys: !!subscription.keys,
          hasP256dh: !!subscription.keys?.p256dh,
          hasAuth: !!subscription.keys?.auth
        }
      });
    }
    
    // Test the subscription by sending a test notification
    try {
      const testPayload = {
        title: '✅ Notifications Activated',
        body: 'You will now receive sales reports based on your frequency settings.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'subscription-test',
        data: {
          type: 'subscription-test',
          timestamp: Date.now()
        }
      };
      
      await webpush.sendNotification(subscription, JSON.stringify(testPayload));
      await logNotificationEvent(userId, 'test_notification_sent', 'Test notification sent successfully', { userAgent }, true, null, userAgent);
      
    } catch (testError) {
      await logNotificationEvent(userId, 'test_notification_error', 'Failed to send test notification', { 
        subscription, 
        userAgent,
        error: testError.message
      }, false, testError.message, userAgent);
      
      return res.status(400).json({
        success: false,
        error: 'Failed to send test notification',
        details: {
          error: testError.message,
          statusCode: testError.statusCode,
          headers: testError.headers
        }
      });
    }
    
    // Store subscription in database
    const subscriptionData = {
      subscription,
      userEmail: req.user.userEmail,
      userName: req.user.userName,
      timezone: req.user.userTimezone || config.olaClick.defaultTimezone,
      currency: req.user.userCurrency || config.olaClick.defaultCurrency,
      currencySymbol: req.user.userCurrencySymbol || config.olaClick.defaultCurrencySymbol,
      subscribedAt: new Date().toISOString(),
      userAgent,
      endpoint: subscription.endpoint,
      notificationFrequency: notificationFrequency || 30 // Default to 30 minutes
    };
    
    await storePushSubscription(userId, subscriptionData);
    
    await logNotificationEvent(userId, 'subscribe_success', 'Push notification subscription successful', { userAgent }, true, null, userAgent);
    
    console.log(`✅ Push subscription added for user: ${req.user.userEmail}`);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      testNotificationSent: true
    });
    
  } catch (error) {
    await logNotificationEvent(req.user.userId, 'subscribe_error', 'Push notification subscription failed', { 
      userAgent: req.headers['user-agent'],
      error: error.message
    }, false, error.message, req.headers['user-agent']);
    
    console.error('❌ Error subscribing to push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to push notifications',
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await removePushSubscription(userId);
    
    await logNotificationEvent(userId, 'unsubscribe', 'Push notification unsubscribed', {}, true, null, req.headers['user-agent']);
    
    console.log(`✅ Push subscription removed for user: ${req.user.userEmail}`);
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
    
  } catch (error) {
    await logNotificationEvent(req.user.userId, 'unsubscribe_error', 'Push notification unsubscribe failed', { error: error.message }, false, error.message, req.headers['user-agent']);
    
    console.error('❌ Error unsubscribing from push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
});

// Send test notification
router.post('/test', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    await logNotificationEvent(userId, 'test_notification_request', 'Test notification requested', { userAgent }, true, null, userAgent);
    
    const userSubscription = await getPushSubscription(userId);
    
    if (!userSubscription) {
      const error = 'No push subscription found for this user';
      await logNotificationEvent(userId, 'test_notification_error', error, { userAgent }, false, error, userAgent);
      return res.status(404).json({
        success: false,
        error,
        details: {
          subscriptionExists: false
        }
      });
    }
    
    const notificationPayload = {
      title: '🧪 Test Notification',
      body: `Hello ${req.user.userName}! This is a test notification from OlaClick Analytics.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test-notification',
      data: {
        url: '/',
        type: 'test',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: 'View Dashboard'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    await webpush.sendNotification(
      userSubscription.subscription,
      JSON.stringify(notificationPayload)
    );
    
    await trackNotificationSent(userId);
    await logNotificationEvent(userId, 'test_notification_sent', 'Test notification sent successfully', { userAgent }, true, null, userAgent);
    
    console.log(`📨 Test notification sent to: ${req.user.userEmail}`);
    
    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
    
  } catch (error) {
    await trackNotificationError(req.user.userId, error.message);
    await logNotificationEvent(req.user.userId, 'test_notification_error', 'Test notification failed', { 
      userAgent: req.headers['user-agent'],
      error: error.message
    }, false, error.message, req.headers['user-agent']);
    
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      details: {
        message: error.message,
        statusCode: error.statusCode,
        headers: error.headers
      }
    });
  }
});

// Send daily report to all subscribers (admin only)
router.post('/send-daily-reports', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    await sendDailyReports();
    
    res.json({
      success: true,
      message: 'Daily reports sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Error sending daily reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send daily reports'
    });
  }
});

// Get notification status for current user
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSubscription = await getPushSubscription(userId);
    
    res.json({
      success: true,
      isSubscribed: !!userSubscription,
      subscribedAt: userSubscription?.subscribedAt || null,
      userAgent: userSubscription?.userAgent || null,
      endpoint: userSubscription?.endpoint || null
    });
  } catch (error) {
    console.error('❌ Error getting notification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status'
    });
  }
});

// Get notification debug info for current user
router.get('/debug', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSubscription = await getPushSubscription(userId);
    const userLogs = await getNotificationLogs(userId, 10);
    
    res.json({
      success: true,
      user: {
        id: userId,
        email: req.user.userEmail,
        name: req.user.userName
      },
      subscription: userSubscription ? {
        subscribedAt: userSubscription.subscribedAt,
        userAgent: userSubscription.userAgent,
        endpoint: userSubscription.endpoint,
        hasValidKeys: !!(userSubscription.subscription?.keys?.p256dh && userSubscription.subscription?.keys?.auth)
      } : null,
      events: userLogs,
      browserInfo: {
        userAgent: req.headers['user-agent'],
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding']
      }
    });
  } catch (error) {
    console.error('❌ Error getting notification debug info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get debug information'
    });
  }
});

// Test notification capabilities
router.post('/test-capabilities', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    await logNotificationEvent(userId, 'capabilities_test', 'Testing notification capabilities', { userAgent }, true, null, userAgent);
    
    // Test VAPID configuration
    const vapidTest = {
      publicKey: !!config.vapid.publicKey,
      privateKey: !!config.vapid.privateKey,
      contact: !!config.vapid.contact
    };
    
    // Test user subscription
    const userSubscription = await getPushSubscription(userId);
    const subscriptionTest = {
      exists: !!userSubscription,
      hasEndpoint: !!userSubscription?.subscription?.endpoint,
      hasKeys: !!userSubscription?.subscription?.keys,
      hasP256dh: !!userSubscription?.subscription?.keys?.p256dh,
      hasAuth: !!userSubscription?.subscription?.keys?.auth
    };
    
    // Test environment
    const environmentTest = {
      nodeEnv: config.nodeEnv,
      hasVapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
      hasVapidContact: !!process.env.VAPID_CONTACT_EMAIL,
      databaseConnected: await healthCheck()
    };
    
    res.json({
      success: true,
      tests: {
        vapid: vapidTest,
        subscription: subscriptionTest,
        environment: environmentTest
      },
      browserInfo: {
        userAgent,
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding']
      }
    });
    
  } catch (error) {
    await logNotificationEvent(req.user.userId, 'capabilities_test_error', 'Notification capabilities test failed', { 
      userAgent: req.headers['user-agent'],
      error: error.message
    }, false, error.message, req.headers['user-agent']);
    
    res.status(500).json({
      success: false,
      error: 'Failed to test notification capabilities',
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Clear notification errors for current user
router.post('/clear-errors', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await logNotificationEvent(userId, 'errors_cleared', 'Notification errors cleared', { 
      userAgent: req.headers['user-agent'] 
    }, true, null, req.headers['user-agent']);
    
    res.json({
      success: true,
      message: 'Notification errors cleared'
    });
  } catch (error) {
    console.error('❌ Error clearing notification errors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear errors'
    });
  }
});

// Get notification settings for current user
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSubscription = await getPushSubscription(userId);
    
    res.json({
      success: true,
      isSubscribed: !!userSubscription,
      settings: userSubscription ? {
        frequency: userSubscription.notificationFrequency || 30,
        subscribedAt: userSubscription.subscribedAt,
        lastNotificationTime: userSubscription.lastNotificationTime
      } : null
    });
  } catch (error) {
    console.error('❌ Error getting notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification settings'
    });
  }
});

// Update notification frequency
router.put('/settings/frequency', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { frequency } = req.body;
    
    // Validate frequency
    const validFrequencies = [30, 60, 240, 480];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency. Must be one of: 30, 60, 240, 480 (minutes)'
      });
    }
    
    // Check if user has an active subscription
    const userSubscription = await getPushSubscription(userId);
    if (!userSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No active push subscription found. Please enable notifications first.'
      });
    }
    
    // Update frequency
    await updateNotificationFrequency(userId, frequency);
    
    await logNotificationEvent(userId, 'frequency_updated', `Notification frequency updated to ${frequency} minutes`, { 
      oldFrequency: userSubscription.notificationFrequency,
      newFrequency: frequency
    }, true, null, req.headers['user-agent']);
    
    console.log(`✅ Notification frequency updated for user: ${req.user.userEmail} to ${frequency} minutes`);
    
    res.json({
      success: true,
      message: 'Notification frequency updated successfully',
      frequency: frequency
    });
    
  } catch (error) {
    await logNotificationEvent(req.user.userId, 'frequency_update_error', 'Failed to update notification frequency', { 
      error: error.message
    }, false, error.message, req.headers['user-agent']);
    
    console.error('❌ Error updating notification frequency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification frequency'
    });
  }
});

export default router; 