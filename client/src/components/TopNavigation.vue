<template>
  <div>
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
        <!-- Dark mode toggle -->
        <button
          class="touch-target rounded-xl px-2 sm:px-3 py-2 text-gray-700 transition-all duration-200 hover:shadow-glass-sm dark:bg-gray-800/60 dark:text-gray-200 dark:hover:bg-gray-700/60" style="background: rgba(255,255,255,0.5); border: 1px solid rgba(229,231,235,0.4);"
          @click="toggleDarkMode"
          :aria-pressed="isDark"
          :title="$t('navigation.toggleDarkMode')"
        >
          <svg v-if="!isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>


        <!-- User dropdown -->
        <div class="dropdown">
          <button
            @click="toggleUserMenu"
            class="flex items-center space-x-2 sm:space-x-3 rounded-xl px-2 sm:px-3 py-2 transition-all duration-200 hover:shadow-glass-sm" style="background: rgba(255,255,255,0.5); border: 1px solid rgba(229,231,235,0.4);"
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
                  {{ authStore.user?.role?.replace('-', ' ') || $t('common.user') }}
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
            <button @click="openChangePasswordModal" class="dropdown-item w-full text-left">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-6 6H6a6 6 0 01-6-6 6 6 0 016-6h7m1 0V3a2 2 0 014 0v4M9 12l2 2 4-4"></path>
              </svg>
              {{ $t('auth.changePassword') }}
            </button>
            
            <div class="border-t border-gray-200/40 my-1 mx-1"></div>

            <button @click="handleLogout" class="dropdown-item w-full text-left">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              {{ $t('common.logout') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Change Password Modal -->
  <ChangePasswordModal 
    :is-open="showChangePasswordModal" 
    @close="closeChangePasswordModal" 
  />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import ChangePasswordModal from './ChangePasswordModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const showUserMenu = ref(false)
const showChangePasswordModal = ref(false)

const emit = defineEmits(['toggle-mobile-menu'])

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const openChangePasswordModal = () => {
  showChangePasswordModal.value = true
  showUserMenu.value = false // Close the dropdown
}

const closeChangePasswordModal = () => {
  showChangePasswordModal.value = false
}

const pageTitle = computed(() => {
  const isAdminSuite = authStore.isSuperAdmin || authStore.isAdmin
  const base = isAdminSuite ? t('navigation.managementSuite') : t('navigation.workforce')
  const routeNames = {
    Admin: t('navigation.managementSuite'),
    Dashboard: base,
    Notifications: base,
    EmployeeClock: base,
    EmployeeTimesheet: base,
    Companies: t('navigation.managementSuite')
  }
  return routeNames[route.name] || base
})

const pageSubtitle = computed(() => {
  const routeSubtitles = {
    Dashboard: '',
    Admin: '',
    Notifications: t('notifications.pushSettings')
  }
  return routeSubtitles[route.name] || ''
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

// Dark mode handling
const isDark = computed(() => document.documentElement.classList.contains('dark'))
const toggleDarkMode = () => {
  const root = document.documentElement
  const next = !root.classList.contains('dark')
  root.classList.toggle('dark', next)
  try {
    localStorage.setItem('theme', next ? 'dark' : 'light')
  } catch {}
}

onMounted(() => {
  // Initialize theme from localStorage
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') document.documentElement.classList.add('dark')
  } catch {}
})



// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.dropdown')) {
    showUserMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 