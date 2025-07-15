// Service Worker for OlaClick Analytics PWA - NO CACHE VERSION
// This version disables all caching to ensure fresh content after deployments
// Version: 3.0.0 - NO CACHE MODE

const CACHE_NAME = 'disabled'; // Not used but kept for cleanup
const SW_VERSION = '3.0.0-no-cache';

console.log(`🚀 Service Worker ${SW_VERSION}: Loading...`);

// Install event - skip caching
self.addEventListener('install', event => {
  console.log(`🔧 Service Worker ${SW_VERSION}: Installing (no cache mode)...`);
  
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        console.log(`✅ Service Worker ${SW_VERSION}: Installed without caching`);
        // Force immediate activation
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up any existing caches
self.addEventListener('activate', event => {
  console.log(`🚀 Service Worker ${SW_VERSION}: Activating (no cache mode)...`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log(`🗑️ Service Worker ${SW_VERSION}: Deleting cache:`, cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log(`✅ Service Worker ${SW_VERSION}: Activated successfully - all caches cleared`);
        // Force immediate control of all clients
        return self.clients.claim();
      })
      .catch(error => {
        console.error(`❌ Service Worker ${SW_VERSION}: Error during activation:`, error);
      })
  );
});

// Fetch event - always fetch from network, no caching
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Always fetch from network - no caching
  event.respondWith(
    fetch(request)
      .then(response => {
        console.log('🌐 Service Worker: Fresh fetch for:', url.pathname);
        return response;
      })
      .catch(error => {
        console.log('❌ Service Worker: Network failed for:', url.pathname);
        
        // Return basic offline response
        if (request.mode === 'navigate') {
          return new Response(`
            <!DOCTYPE html>
            <html>
              <head><title>Offline</title></head>
              <body>
                <h1>Offline</h1>
                <p>Please check your internet connection and try again.</p>
                <button onclick="window.location.reload()">Retry</button>
              </body>
            </html>
          `, {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        return new Response('Network unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// Push notification event handler
self.addEventListener('push', event => {
  console.log('📨 Service Worker: Push notification received');
  
  let notificationData = {
    title: 'OlaClick Analytics',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'olaclick-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Dashboard',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/icon-96x96.png'
      }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
      console.log('📊 Service Worker: Push data parsed:', pushData);
    } catch (error) {
      console.error('❌ Service Worker: Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('✅ Service Worker: Notification displayed successfully');
      })
      .catch(error => {
        console.error('❌ Service Worker: Error showing notification:', error);
      })
  );
});

// Notification click event handler
self.addEventListener('notificationclick', event => {
  console.log('👆 Service Worker: Notification clicked');
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Close the notification
  notification.close();
  
  if (action === 'dismiss') {
    console.log('🚫 Service Worker: Notification dismissed');
    return;
  }
  
  // Determine URL to open
  let urlToOpen = data.url || '/';
  if (action === 'view') {
    urlToOpen = data.url || '/';
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            console.log('🎯 Service Worker: Focusing existing window');
            return client.focus();
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          console.log('🆕 Service Worker: Opening new window');
          return clients.openWindow(urlToOpen);
        }
      })
      .catch(error => {
        console.error('❌ Service Worker: Error handling notification click:', error);
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  console.log('💬 Service Worker: Message received:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
      
    default:
      console.log('❓ Service Worker: Unknown message type:', type);
  }
});

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('🗑️ Service Worker: All caches cleared');
  } catch (error) {
    console.error('❌ Service Worker: Error clearing caches:', error);
  }
}

console.log(`🚀 Service Worker ${SW_VERSION}: Loaded and ready (no cache mode)!`); 