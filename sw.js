// Service Worker for OlaClick Analytics PWA
const CACHE_NAME = 'olaclick-analytics-v1';
const STATIC_CACHE = 'olaclick-static-v1';
const DYNAMIC_CACHE = 'olaclick-dynamic-v1';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// API endpoints that should be cached
const CACHEABLE_APIS = [
  '/api/auth/verify',
  '/api/orders/all'
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ Service Worker: Static files cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('❌ Service Worker: Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activated successfully');
        return self.clients.claim(); // Take control of all clients
      })
      .catch(error => {
        console.error('❌ Service Worker: Error during activation:', error);
      })
  );
});

// Fetch event - handle network requests with cache strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static files
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses for cacheable APIs
    if (networkResponse.ok && CACHEABLE_APIS.some(api => url.pathname.includes(api))) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Service Worker: Network failed, trying cache for:', url.pathname);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response if no cache
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Network unavailable. Please check your connection.' 
      }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response for future use
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Service Worker: Request failed for:', request.url);
    
    // For navigation requests, return the cached index.html
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    // Return a generic offline page or error
    return new Response('Offline - Please check your internet connection', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

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

// Background sync for offline actions (optional)
self.addEventListener('sync', event => {
  console.log('🔄 Service Worker: Background sync triggered');
  
  if (event.tag === 'sync-analytics-data') {
    event.waitUntil(syncAnalyticsData());
  }
});

// Sync analytics data when back online
async function syncAnalyticsData() {
  try {
    console.log('📊 Service Worker: Syncing analytics data...');
    
    // Get all clients (open tabs)
    const clients = await self.clients.matchAll();
    
    // Notify clients to refresh data
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_DATA',
        message: 'Connection restored. Refreshing data...'
      });
    });
    
    console.log('✅ Service Worker: Analytics data sync completed');
  } catch (error) {
    console.error('❌ Service Worker: Error syncing analytics data:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
  console.log('💬 Service Worker: Message received:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ANALYTICS_DATA':
      // Cache important analytics data for offline use
      cacheAnalyticsData(data);
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
      
    default:
      console.log('❓ Service Worker: Unknown message type:', type);
  }
});

// Cache analytics data for offline use
async function cacheAnalyticsData(data) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/offline-analytics-data', response);
    console.log('💾 Service Worker: Analytics data cached for offline use');
  } catch (error) {
    console.error('❌ Service Worker: Error caching analytics data:', error);
  }
}

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

console.log('🚀 Service Worker: Loaded and ready!'); 