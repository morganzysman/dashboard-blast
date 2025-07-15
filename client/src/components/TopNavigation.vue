<template>
  <header class="page-header">
    <div class="flex items-center justify-between">
      <!-- Mobile menu button and page title -->
      <div class="flex items-center space-x-3">
        <!-- Mobile menu button -->
        <button @click="$emit('toggle-mobile-menu')" 
                class="mobile-menu-button">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        
        <!-- Page title -->
        <div class="min-w-0 flex-1">
          <h1 class="page-title truncate">
            {{ pageTitle }}
          </h1>
          <p class="page-subtitle truncate" v-if="pageSubtitle">
            {{ pageSubtitle }}
          </p>
        </div>
      </div>

      <!-- User menu -->
      <div class="flex items-center space-x-4">
        <!-- Notification status -->
        <div class="flex items-center space-x-2" v-if="!authStore.isSuperAdmin">
          <div class="h-2 w-2 rounded-full flex-shrink-0" :class="notificationStatusColor"></div>
          <span class="text-sm text-gray-600 hidden sm:block">{{ notificationStatusText }}</span>
        </div>

        <!-- User dropdown -->
        <div class="dropdown">
          <button
            @click="toggleUserMenu"
            class="flex items-center space-x-2 sm:space-x-3 bg-white rounded-lg px-2 sm:px-3 py-2 hover:bg-gray-50 transition-colors duration-200"
          >
            <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span class="text-sm font-medium text-primary-600">
                {{ authStore.user?.name?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="text-left hidden sm:block">
              <div class="flex items-center space-x-2">
                <p class="text-sm font-medium text-gray-900">
                  {{ authStore.user?.name }}
                </p>
                <span 
                  class="badge text-xs"
                  :class="{
                    'badge-primary': authStore.isSuperAdmin,
                    'badge-success': authStore.isAdmin,
                    'badge-warning': authStore.isUser,
                    'badge-gray': authStore.isViewer
                  }"
                >
                  {{ authStore.user?.role?.replace('-', ' ') || 'User' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 hidden md:block">
                {{ authStore.user?.email }}
              </p>
            </div>
            <svg class="w-4 h-4 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          <!-- Dropdown menu -->
          <div v-if="showUserMenu" class="dropdown-menu">
            <div class="border-t border-gray-200 my-1"></div>

            <button @click="handleLogout" class="dropdown-item w-full text-left">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showUserMenu = ref(false)
const notificationStatus = ref('unknown')

const emit = defineEmits(['toggle-mobile-menu'])

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const pageTitle = computed(() => {
  const routeNames = {
    Dashboard: 'Dashboard',
    Admin: 'Admin Dashboard',
    Notifications: 'Notifications'
  }
  return routeNames[route.name] || 'OlaClick Analytics'
})

const pageSubtitle = computed(() => {
  const routeSubtitles = {
    Dashboard: 'Real-time analytics and sales data',
    Admin: '',
    Notifications: 'Push notification settings and debug'
  }
  return routeSubtitles[route.name] || ''
})

const notificationStatusColor = computed(() => {
  switch (notificationStatus.value) {
    case 'active':
      return 'bg-success-500'
    case 'inactive':
      return 'bg-gray-400'
    case 'error':
      return 'bg-error-500'
    default:
      return 'bg-warning-500'
  }
})

const notificationStatusText = computed(() => {
  switch (notificationStatus.value) {
    case 'active':
      return 'Notifications Active'
    case 'inactive':
      return 'Notifications Off'
    case 'error':
      return 'Notification Error'
    default:
      return 'Checking...'
  }
})

const handleLogout = async () => {
  showUserMenu.value = false
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}

const checkNotificationStatus = async () => {
  try {
    const sessionId = authStore.sessionId
    if (!sessionId) return

    const response = await fetch('/api/notifications/status', {
      headers: {
        'X-Session-ID': sessionId,
      },
    })

    if (response.ok) {
      const data = await response.json()
      notificationStatus.value = data.isSubscribed ? 'active' : 'inactive'
    } else {
      notificationStatus.value = 'error'
    }
  } catch (error) {
    notificationStatus.value = 'error'
    console.error('Error checking notification status:', error)
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.dropdown')) {
    showUserMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  checkNotificationStatus()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 