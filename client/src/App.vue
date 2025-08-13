<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Global loading overlay -->
    <div v-if="authStore.isLoading" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-8 shadow-xl">
        <div class="flex items-center space-x-4">
          <div class="loading-spinner"></div>
          <span class="text-gray-700">Loading...</span>
        </div>
      </div>
    </div>

    <!-- App content -->
    <div class="flex h-screen">
      <!-- Mobile sidebar overlay -->
      <div v-if="authStore.isAuthenticated && isMobileSidebarOpen" 
           class="sidebar-overlay"
           @click="closeMobileSidebar"></div>
      
      <!-- Sidebar (show when authenticated) -->
      <Sidebar v-if="authStore.isAuthenticated" 
               :is-mobile-open="isMobileSidebarOpen"
               @close="closeMobileSidebar" />
      
      <!-- Main content area -->
      <main class="main-content" :class="{ 'flex items-start justify-start': $route.name === 'EmployeeClock' }">
        <!-- Top navigation (show when authenticated) -->
        <TopNavigation v-if="authStore.isAuthenticated" 
                       @toggle-mobile-menu="toggleMobileSidebar" />
        
        <!-- Page content -->
        <div class="page-content" :class="{ 'w-full max-w-2xl': $route.name === 'EmployeeClock' }">
          <router-view />
        </div>
      </main>
    </div>

    <!-- Global notifications -->
    <NotificationToast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import Sidebar from './components/Sidebar.vue'
import TopNavigation from './components/TopNavigation.vue'
import NotificationToast from './components/NotificationToast.vue'

const authStore = useAuthStore()
const isMobileSidebarOpen = ref(false)

const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}

const closeMobileSidebar = () => {
  isMobileSidebarOpen.value = false
}

onMounted(() => {
  // Initialize any global features here
  console.log('🚀 OlaClick Analytics Dashboard initialized')
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 