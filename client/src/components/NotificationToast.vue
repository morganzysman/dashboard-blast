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
          <MaterialIcon :name="iconFor(notification.type)" :size="20" filled />
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
            class="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 transition-colors duration-150"
          >
            <MaterialIcon name="close" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MaterialIcon from './ui/MaterialIcon.vue'

const { t } = useI18n()

const iconFor = (type) => {
  switch (type) {
    case 'success': return 'check_circle'
    case 'error': return 'error'
    case 'warning': return 'warning'
    default: return 'info'
  }
}
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