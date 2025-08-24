<template>
  <div class="space-y-6">
    <!-- Header -->

    <!-- Notification Status Card -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-lg font-medium text-gray-900">{{ $t('notifications.title') }}</h3>
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
                <h4 class="text-lg font-medium text-gray-900">{{ $t('notifications.pushNotifications') }}</h4>
                <p class="text-sm text-gray-600">{{ isAdmin ? $t('notifications.adminDescription') : $t('notifications.employeeDescription') }}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">{{ $t('common.status') }}</span>
                <span class="badge" :class="notificationStatus.isSubscribed ? 'badge-success' : 'badge-gray'">
                  {{ notificationStatus.isSubscribed ? $t('common.active') : $t('common.inactive') }}
                </span>
              </div>
              
              <div v-if="notificationStatus.isSubscribed && notificationStatus.deviceCount" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">{{ $t('notifications.connectedDevices') }}</span>
                <span class="text-sm text-gray-600">{{ $t('notifications.deviceCount', { count: notificationStatus.deviceCount }) }}</span>
              </div>
              
              <div v-if="notificationStatus.subscribedAt" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">{{ $t('notifications.latestSubscription') }}</span>
                <span class="text-sm text-gray-600">{{ formatDate(notificationStatus.subscribedAt) }}</span>
              </div>
              
              <!-- Device List -->
              <div v-if="notificationStatus.devices && notificationStatus.devices.length > 1" class="border-t pt-4">
                <span class="text-sm font-medium text-gray-700 mb-2 block">{{ $t('notifications.allDevices') }}:</span>
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
                <span class="text-sm font-medium text-gray-700">{{ $t('notifications.currentDevice') }}</span>
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
                {{ $t('notifications.enable') }}
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
                {{ $t('notifications.disable') }}
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
        <h3 class="text-lg font-medium text-gray-900">{{ $t('notifications.settings') }}</h3>
      </div>
      <div class="card-body">
        <div class="space-y-4">
          <div v-if="isAdmin">
            <label class="form-label">{{ $t('notifications.frequency') }}</label>
            <p class="text-sm text-gray-600 mb-2">{{ $t('notifications.frequencyDescription') }}</p>
            <select 
              v-model="selectedFrequency" 
              @change="updateNotificationFrequency"
              :disabled="loading"
              class="form-input"
            >
              <option value="5">{{ $t('notifications.every5Minutes') }}</option>
              <option value="30">{{ $t('notifications.every30Minutes') }}</option>
              <option value="60">{{ $t('notifications.every1Hour') }}</option>
              <option value="240">{{ $t('notifications.every4Hours') }}</option>
              <option value="480">{{ $t('notifications.every8Hours') }}</option>
            </select>
          </div>
          
          <div v-if="isAdmin && notificationSettings.lastNotificationTime" class="bg-gray-50 rounded-lg p-3">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-gray-700">{{ $t('notifications.lastNotification') }}:</span>
              <span class="text-gray-600">{{ formatDate(notificationSettings.lastNotificationTime) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm mt-1">
              <span class="font-medium text-gray-700">{{ $t('notifications.nextNotification') }}:</span>
              <span class="text-gray-600">{{ getNextNotificationTime() }}</span>
            </div>
          </div>
          
          <div class="bg-blue-50 rounded-lg p-3">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p class="text-sm font-medium text-blue-800">{{ $t('notifications.multiDeviceSupport') }}</p>
                <p class="text-sm text-blue-700 mt-1">
                  {{ $t('notifications.multiDeviceDescription') }}
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
import { useI18n } from 'vue-i18n'
import Button from '../components/ui/Button.vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const authStore = useAuthStore()
const { t } = useI18n()
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
  return notificationStatus.value.isSubscribed ? t('notifications.active') : t('notifications.disabled')
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
      throw new Error(t('notifications.browserNotSupported'));
    }

    // Check existing permission first
    if (Notification.permission === 'denied') {
      throw new Error(t('notifications.notificationsBlocked'));
    }

    // If permission is default (not asked yet), request it
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error(t('notifications.pleaseAllowNotifications'));
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
          notificationFrequency: Number(selectedFrequency.value)
        })
      });

      if (!response.ok) {
        throw new Error(t('notifications.failedToSave'));
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
        title: t('notifications.enabled'),
        message: isAdmin.value ? t('notifications.salesReportsEnabled', { frequency: getFrequencyLabel(selectedFrequency.value) }) : t('notifications.importantNotificationsEnabled')
      });
    }
  } catch (error) {
    console.error('Subscription error:', error);
    
    // Show error message to user with instructions
    window.showNotification?.({
      type: 'error',
      title: t('notifications.setupFailed'),
      message: error.message || t('notifications.enableFailed')
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
      title: t('notifications.disabled'),
      message: t('notifications.noLongerReceive')
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    
    // Only show error notification if it's not session expiration (handled by API wrapper)
    if (error.status !== 401) {
      window.showNotification?.({
        type: 'error',
        title: t('notifications.unsubscribeFailed'),
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
        frequency: Number(selectedFrequency.value)
      })
    })

    if (response.ok) {
      notificationSettings.value.frequency = selectedFrequency.value
      
      window.showNotification?.({
        type: 'success',
        title: t('notifications.settingsUpdated'),
        message: t('notifications.frequencySet', { frequency: getFrequencyLabel(selectedFrequency.value) })
      })
    } else {
      throw new Error('Failed to update notification frequency')
    }
  } catch (error) {
    console.error('Update frequency error:', error)
    window.showNotification?.({
      type: 'error',
      title: t('notifications.updateFailed'),
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
        title: t('notifications.testSent'),
        message: t('notifications.testSentSuccessfully')
      })
    } else {
      throw new Error('Failed to send test notification')
    }
  } catch (error) {
    console.error('Test notification error:', error)
    window.showNotification?.({
      type: 'error',
      title: t('notifications.testFailed'),
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
  if (!dateString) return t('notifications.never')
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getDeviceInfo = (userAgent) => {
  if (!userAgent) return t('notifications.unknown')
  if (userAgent.includes('Mobile')) return t('notifications.devices.mobile')
  if (userAgent.includes('iPad')) return t('notifications.devices.ipad')
  if (userAgent.includes('iPhone')) return t('notifications.devices.iphone')
  if (userAgent.includes('Android')) return t('notifications.devices.android')
  if (userAgent.includes('Chrome')) return t('notifications.devices.chrome')
  if (userAgent.includes('Firefox')) return t('notifications.devices.firefox')
  if (userAgent.includes('Safari')) return t('notifications.devices.safari')
  return t('notifications.devices.desktop')
}

const getFrequencyLabel = (frequency) => {
  switch(frequency) {
    case 5: return t('notifications.5minutes')
    case 30: return t('notifications.30minutes')
    case 60: return t('notifications.1hour')
    case 240: return t('notifications.4hours')
    case 480: return t('notifications.8hours')
    default: return t('notifications.30minutes')
  }
}

const getNextNotificationTime = () => {
  if (!notificationSettings.value.lastNotificationTime) return 'Within next check'
  
  const lastTime = new Date(notificationSettings.value.lastNotificationTime)
  const nextTime = new Date(lastTime.getTime() + (notificationSettings.value.frequency * 60 * 1000))
  const now = new Date()
  
  if (nextTime <= now) {
    return t('notifications.withinNextCheck')
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