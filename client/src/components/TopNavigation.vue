<template>
  <div>
  <header class="page-header">
    <div class="flex items-center justify-between">
      <!-- Mobile menu button and page title -->
      <div class="flex items-center space-x-3">
        <!-- Mobile menu button -->
        <button @click="$emit('toggle-mobile-menu')" 
                class="mobile-menu-button">
          <MaterialIcon name="menu" :size="24" />
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
        <!-- Language selector -->
        <div class="relative" ref="langDropdownRef">
          <button
            class="touch-target rounded-md px-2 sm:px-3 py-2 transition-colors duration-150 flex items-center gap-1 text-sm font-medium"
            style="color: var(--nav-text); border: 1px solid var(--border);"
            @click="toggleLangMenu"
            :title="$t('navigation.language')"
          >
            <MaterialIcon name="language" :size="18" />
            <span class="hidden sm:inline uppercase">{{ currentLocale }}</span>
          </button>
          <Teleport to="body">
            <div v-if="showLangMenu" class="fixed w-40 overflow-hidden" style="z-index: 9999; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-pop);" :style="langDropdownPosition">
              <button
                v-for="lang in languages"
                :key="lang.code"
                class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-surface-2"
                :class="currentLocale === lang.code ? 'font-medium' : ''"
                :style="currentLocale === lang.code ? 'color: var(--brand-blue); background: var(--tint-blue);' : 'color: var(--fg1);'"
                @click="switchLanguage(lang.code)"
              >
                <span class="uppercase text-xs font-semibold w-6" style="color: var(--fg3);">{{ lang.code }}</span>
                <span>{{ lang.label }}</span>
              </button>
            </div>
          </Teleport>
        </div>

        <!-- Dark mode toggle -->
        <button
          class="touch-target rounded-md px-2 sm:px-3 py-2 transition-colors duration-150"
          style="color: var(--nav-text); border: 1px solid var(--border);"
          @click="toggleDarkMode"
          :aria-pressed="isDark"
          :title="$t('navigation.toggleDarkMode')"
        >
          <MaterialIcon :name="isDark ? 'dark_mode' : 'light_mode'" :size="20" :filled="isDark" />
        </button>


        <!-- User dropdown -->
        <div class="dropdown">
          <button
            @click="toggleUserMenu"
            class="flex items-center space-x-2 sm:space-x-3 rounded-md px-2 sm:px-3 py-2 transition-colors duration-150"
            style="border: 1px solid var(--border);"
          >
            <div class="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: var(--tint-blue);">
              <span class="text-sm font-medium" style="color: var(--brand-blue);">
                {{ authStore.user?.name?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="text-left hidden sm:block">
              <div class="flex items-center space-x-2">
                <p class="text-sm font-medium" style="color: var(--fg1);">
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
              <p class="text-xs hidden md:block" style="color: var(--fg3);">
                {{ authStore.user?.email }}
              </p>
            </div>
            <MaterialIcon name="expand_more" :size="18" class="hidden sm:block" style="color: var(--fg-muted);" />
          </button>

          <!-- Dropdown menu -->
          <div v-if="showUserMenu" class="dropdown-menu">
            <button @click="openChangePasswordModal" class="dropdown-item w-full text-left">
              <MaterialIcon name="lock" :size="18" class="mr-2" />
              {{ $t('auth.changePassword') }}
            </button>
            
            <div class="my-1 mx-1" style="border-top: 1px solid var(--border);"></div>

            <button @click="handleLogout" class="dropdown-item w-full text-left" style="color: var(--danger);">
              <MaterialIcon name="logout" :size="18" class="mr-2" />
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
import MaterialIcon from './ui/MaterialIcon.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const showUserMenu = ref(false)
const showChangePasswordModal = ref(false)
const showLangMenu = ref(false)
const langDropdownRef = ref(null)

const languages = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' }
]

const { locale } = useI18n()
const currentLocale = computed(() => locale.value)

const langDropdownPosition = ref({})

const toggleLangMenu = () => {
  showLangMenu.value = !showLangMenu.value
  if (showLangMenu.value && langDropdownRef.value) {
    const rect = langDropdownRef.value.getBoundingClientRect()
    langDropdownPosition.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`
    }
  }
}

const switchLanguage = (lang) => {
  locale.value = lang
  showLangMenu.value = false
  try {
    localStorage.setItem('user_language', lang)
  } catch {}
}

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

// Dark mode handling — driven by [data-theme="dark"] (OlaClick DS)
const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')
const toggleDarkMode = () => {
  const root = document.documentElement
  const next = root.getAttribute('data-theme') !== 'dark'
  if (next) {
    root.setAttribute('data-theme', 'dark')
  } else {
    root.removeAttribute('data-theme')
  }
  isDark.value = next
  try {
    localStorage.setItem('theme', next ? 'dark' : 'light')
  } catch {}
}

onMounted(() => {
  // Sync indicator with the attribute set pre-paint in index.html
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
})



// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.dropdown')) {
    showUserMenu.value = false
  }
  if (langDropdownRef.value && !langDropdownRef.value.contains(event.target)) {
    showLangMenu.value = false
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