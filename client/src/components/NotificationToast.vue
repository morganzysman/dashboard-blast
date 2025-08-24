<template>
  <div class="fixed top-4 right-4 z-50 space-y-4">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      class="notification animate-slide-in"
      :class="getNotificationClass(notification.type)"
    >
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg
            v-if="notification.type === 'success'"
            class="h-5 w-5 text-success-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <svg
            v-else-if="notification.type === 'error'"
            class="h-5 w-5 text-error-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <svg
            v-else-if="notification.type === 'warning'"
            class="h-5 w-5 text-warning-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <svg
            v-else
            class="h-5 w-5 text-primary-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <p class="text-sm font-medium">
            {{ notification.title }}
          </p>
          <p v-if="notification.message" class="text-sm opacity-75">
            {{ notification.message }}
          </p>
        </div>
        <div class="ml-4 flex-shrink-0">
          <button
            @click="removeNotification(notification.id)"
            class="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 transition-colors duration-200"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const notifications = ref([])
let notificationId = 0

const addNotification = (notification) => {
  const id = ++notificationId
  const newNotification = {
    id,
    type: notification.type || 'info',
    title: notification.title || t('notifications.defaultTitle'),
    message: notification.message || '',
    duration: notification.duration || 5000
  }
  
  notifications.value.push(newNotification)
  
  // Auto-remove after duration
  if (newNotification.duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, newNotification.duration)
  }
  
  return id
}

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

const getNotificationClass = (type) => {
  switch (type) {
    case 'success':
      return 'notification-success'
    case 'error':
      return 'notification-error'
    case 'warning':
      return 'notification-warning'
    default:
      return 'notification-info'
  }
}

// Global notification function
const showNotification = (notification) => {
  return addNotification(notification)
}

// Expose notification function to global scope
onMounted(() => {
  window.showNotification = showNotification
})

onUnmounted(() => {
  if (window.showNotification) {
    delete window.showNotification
  }
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 