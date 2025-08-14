<template>
  <div class="space-y-6">
    <!-- Header -->

    <!-- Notification Status Card -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-lg font-medium text-gray-900">Notification Status</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0">
                <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zm-5-6h5l-5 5v-5zm-5-6h5l-5 5v-5z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h4 class="text-lg font-medium text-gray-900">Push Notifications</h4>
                <p class="text-sm text-gray-600">{{ isAdmin ? 'Get notified about sales reports and updates' : 'Receive important notifications from your company (shifts, payroll, updates)' }}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Status</span>
                <span class="badge" :class="notificationStatus.isSubscribed ? 'badge-success' : 'badge-gray'">
                  {{ notificationStatus.isSubscribed ? 'Active' : 'Inactive' }}
                </span>
              </div>
              
              <div v-if="notificationStatus.isSubscribed && notificationStatus.deviceCount" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Connected Devices</span>
                <span class="text-sm text-gray-600">{{ notificationStatus.deviceCount }} device{{ notificationStatus.deviceCount !== 1 ? 's' : '' }}</span>
              </div>
              
              <div v-if="notificationStatus.subscribedAt" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Latest Subscription</span>
                <span class="text-sm text-gray-600">{{ formatDate(notificationStatus.subscribedAt) }}</span>
              </div>
              
              <!-- Device List -->
              <div v-if="notificationStatus.devices && notificationStatus.devices.length > 1" class="border-t pt-4">
                <span class="text-sm font-medium text-gray-700 mb-2 block">All Devices:</span>
                <div class="space-y-2">
                  <div v-for="(device, index) in notificationStatus.devices" :key="index" 
                       class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span class="text-sm font-medium text-gray-900">{{ device.deviceName }}</span>
                      <div class="text-xs text-gray-500">{{ formatDate(device.subscribedAt) }}</div>
                    </div>
                    <div class="text-xs text-gray-400">
                      {{ device.endpoint.substring(0, 20) }}...
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else-if="notificationStatus.userAgent" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Current Device</span>
                <span class="text-sm text-gray-600">{{ getDeviceInfo(notificationStatus.userAgent) }}</span>
              </div>
            </div>
          </div>
          
          <div class="border-l pl-6">
            <div class="space-y-4">
              <div v-if="loading" class="space-y-2 animate-pulse">
                <div class="h-9 bg-gray-200 rounded"></div>
                <div class="h-9 bg-gray-200 rounded"></div>
              </div>
              <Button
                v-else-if="!notificationStatus.isSubscribed"
                @click="subscribeToNotifications"
                :disabled="loading"
                variant="primary" class="w-full"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zm-5-6h5l-5 5v-5zm-5-6h5l-5 5v-5z"></path>
                </svg>
                Enable Notifications
              </Button>
              
              <Button
                v-else
                @click="unsubscribeFromNotifications"
                :disabled="loading"
                variant="danger" class="w-full"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"></path>
                </svg>
                Disable Notifications
              </Button>
              
              <!-- <button
                v-if="notificationStatus.isSubscribed"
                @click="sendTestNotification"
                :disabled="loading"
                class="w-full btn-secondary"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Send Test Notification
              </button> -->
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Settings Card (admins only: frequency) -->
    <div v-if="notificationStatus.isSubscribed" class="card">
      <div class="card-header">
        <h3 class="text-lg font-medium text-gray-900">Notification Settings</h3>
      </div>
      <div class="card-body">
        <div class="space-y-4">
          <div v-if="isAdmin">
            <label class="form-label">Notification Frequency</label>
            <p class="text-sm text-gray-600 mb-2">Choose how often you want to receive sales reports</p>
            <select 
              v-model="selectedFrequency" 
              @change="updateNotificationFrequency"
              :disabled="loading"
              class="form-input"
            >
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 1 hour</option>
              <option value="240">Every 4 hours</option>
              <option value="480">Every 8 hours</option>
            </select>
          </div>
          
          <div v-if="isAdmin && notificationSettings.lastNotificationTime" class="bg-gray-50 rounded-lg p-3">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-gray-700">Last Notification:</span>
              <span class="text-gray-600">{{ formatDate(notificationSettings.lastNotificationTime) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm mt-1">
              <span class="font-medium text-gray-700">Next Notification:</span>
              <span class="text-gray-600">{{ getNextNotificationTime() }}</span>
            </div>
          </div>
          
          <div class="bg-blue-50 rounded-lg p-3">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p class="text-sm font-medium text-blue-800">Multi-Device Support</p>
                <p class="text-sm text-blue-700 mt-1">
                  You can enable notifications on multiple devices (phone, tablet, computer).
                  Admins receive sales reports based on frequency settings. Employees receive shift updates and pay notifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Button from '../components/ui/Button.vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'super-admin')

const loading = ref(false)
const notificationStatus = ref({
  isSubscribed: false,
  subscribedAt: null,
  userAgent: null,
  endpoint: null
})

const notificationSettings = ref({
  frequency: 30,
  lastNotificationTime: null
})

const selectedFrequency = ref(30)

const browserSupport = ref({
  notifications: false,
  serviceWorker: false,
  pushManager: false,
  pwaInstalled: false
})

const statusColor = computed(() => {
  return notificationStatus.value.isSubscribed ? 'bg-green-500' : 'bg-gray-400'
})

const statusText = computed(() => {
  return notificationStatus.value.isSubscribed ? 'Notifications Active' : 'Notifications Disabled'
})

const checkBrowserSupport = () => {
  browserSupport.value.notifications = 'Notification' in window
  browserSupport.value.serviceWorker = 'serviceWorker' in navigator
  browserSupport.value.pushManager = 'PushManager' in window
  browserSupport.value.pwaInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
}

const fetchNotificationStatus = async () => {
  try {
    const data = await api.get('/api/notifications/status')
    notificationStatus.value = data
  } catch (error) {
    console.error('Error fetching notification status:', error)
    // API wrapper handles session expiration automatically
  }
}

const fetchNotificationSettings = async () => {
  try {
    const response = await fetch('/api/notifications/settings', {
      headers: {
        'X-Session-ID': authStore.sessionId,
      },
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success && data.settings) {
        notificationSettings.value = data.settings
        selectedFrequency.value = data.settings.frequency
      }
    }
  } catch (error) {
    console.error('Error fetching notification settings:', error)
  }
}

const subscribeToNotifications = async () => {
  loading.value = true;
  
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    // Check existing permission first
    if (Notification.permission === 'denied') {
      throw new Error('Notifications are blocked. Please enable them in your browser settings.');
    }

    // If permission is default (not asked yet), request it
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Please allow notifications to receive updates.');
      }
    }

    // Only proceed if permission is granted
    if (Notification.permission === 'granted') {
      // Register service worker and get push subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await getVapidPublicKey()
      });

      // Send subscription to server with frequency setting
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': authStore.sessionId,
        },
        body: JSON.stringify({
          subscription,
          userAgent: navigator.userAgent,
          notificationFrequency: selectedFrequency.value
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save notification subscription');
      }

      // Update local status
      notificationStatus.value.isSubscribed = true;
      notificationStatus.value.subscribedAt = new Date().toISOString();
      notificationStatus.value.userAgent = navigator.userAgent;

      // Fetch updated settings
      await fetchNotificationSettings();

      // Show success message
      window.showNotification?.({
        type: 'success',
        title: 'Notifications Enabled',
        message: isAdmin.value ? `You will now receive sales reports every ${getFrequencyLabel(selectedFrequency.value)}` : 'You will now receive important notifications from your company.'
      });
    }
  } catch (error) {
    console.error('Subscription error:', error);
    
    // Show error message to user with instructions
    window.showNotification?.({
      type: 'error',
      title: 'Notification Setup Failed',
      message: error.message || 'Failed to enable notifications. Please try again.'
    });
  } finally {
    loading.value = false;
  }
};

const unsubscribeFromNotifications = async () => {
  loading.value = true
  
  try {
    await api.post('/api/notifications/unsubscribe')
    
    await fetchNotificationStatus()
    notificationSettings.value = { frequency: 30, lastNotificationTime: null }
    
    window.showNotification?.({
      type: 'success',
      title: 'Notifications Disabled',
      message: 'You will no longer receive push notifications'
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    
    // Only show error notification if it's not session expiration (handled by API wrapper)
    if (error.status !== 401) {
      window.showNotification?.({
        type: 'error',
        title: 'Unsubscribe Failed',
        message: error.message
      })
    }
  } finally {
    loading.value = false
  }
}

const updateNotificationFrequency = async () => {
  if (!notificationStatus.value.isSubscribed) return
  
  loading.value = true
  
  try {
    const response = await fetch('/api/notifications/settings/frequency', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId,
      },
      body: JSON.stringify({
        frequency: selectedFrequency.value
      })
    })

    if (response.ok) {
      notificationSettings.value.frequency = selectedFrequency.value
      
      window.showNotification?.({
        type: 'success',
        title: 'Settings Updated',
        message: `Notification frequency set to ${getFrequencyLabel(selectedFrequency.value)}`
      })
    } else {
      throw new Error('Failed to update notification frequency')
    }
  } catch (error) {
    console.error('Update frequency error:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Update Failed',
      message: error.message
    })
  } finally {
    loading.value = false
  }
}

const sendTestNotification = async () => {
  loading.value = true
  
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: {
        'X-Session-ID': authStore.sessionId,
      },
    })

    if (response.ok) {
      window.showNotification?.({
        type: 'success',
        title: 'Test Sent',
        message: 'Test notification sent successfully'
      })
    } else {
      throw new Error('Failed to send test notification')
    }
  } catch (error) {
    console.error('Test notification error:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Test Failed',
      message: error.message
    })
  } finally {
    loading.value = false
  }
}

const getVapidPublicKey = async () => {
  const response = await fetch('/api/notifications/vapid-public-key')
  const data = await response.json()
  return data.publicKey
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getDeviceInfo = (userAgent) => {
  if (!userAgent) return 'Unknown'
  if (userAgent.includes('Mobile')) return 'Mobile'
  if (userAgent.includes('iPad')) return 'iPad'
  if (userAgent.includes('iPhone')) return 'iPhone'
  if (userAgent.includes('Android')) return 'Android'
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  return 'Desktop'
}

const getFrequencyLabel = (frequency) => {
  switch(frequency) {
    case 30: return '30 minutes'
    case 60: return '1 hour'
    case 240: return '4 hours'
    case 480: return '8 hours'
    default: return '30 minutes'
  }
}

const getNextNotificationTime = () => {
  if (!notificationSettings.value.lastNotificationTime) return 'Within next check'
  
  const lastTime = new Date(notificationSettings.value.lastNotificationTime)
  const nextTime = new Date(lastTime.getTime() + (notificationSettings.value.frequency * 60 * 1000))
  const now = new Date()
  
  if (nextTime <= now) {
    return 'Within next check'
  }
  
  return nextTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Watch for subscription status changes to fetch settings
watch(() => notificationStatus.value.isSubscribed, (isSubscribed) => {
  if (isSubscribed) {
    fetchNotificationSettings()
  }
})

onMounted(() => {
  checkBrowserSupport()
  fetchNotificationStatus()
  fetchNotificationSettings()
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 