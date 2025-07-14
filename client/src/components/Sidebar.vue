<template>
  <nav :class="[
    'sidebar',
    { 'mobile-open': isMobileOpen }
  ]">
    <!-- Logo section -->
    <div class="sidebar-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="flex-shrink-0">
          </div>
          <div class="ml-3">
            <h1 class="text-xl font-bold text-gray-900">OlaClick</h1>
            <p class="text-sm text-gray-500">Analytics</p>
          </div>
        </div>
        <!-- Mobile close button -->
        <button @click="$emit('close')" 
                class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Navigation items -->
    <nav class="sidebar-nav">
      <!-- Dashboard - Hidden from super-admin -->
      <router-link
        v-if="!authStore.isSuperAdmin"
        to="/"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'Dashboard' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z"></path>
        </svg>
        Dashboard
      </router-link>

      <!-- Notifications - Hidden from super-admin -->
      <router-link
        v-if="!authStore.isSuperAdmin"
        to="/notifications"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'Notifications' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zm-5-6h5l-5 5v-5zm-5-6h5l-5 5v-5z"></path>
        </svg>
        Notifications
      </router-link>

      <!-- Super Admin only - User Management -->
      <router-link
        v-if="authStore.isSuperAdmin"
        to="/admin"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'Admin' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
        </svg>
        User Management
      </router-link>

      <!-- Accounts info -->
      <div class="px-6 py-3" v-if="authStore.user?.accountsCount > 0">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Accounts Access
        </div>
        <div class="mt-1 text-sm text-gray-900">
          {{ authStore.user.accountsCount }} restaurant{{ authStore.user.accountsCount > 1 ? 's' : '' }}
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
      <div class="text-xs text-gray-500">
        v2.0.0 - Vue.js Edition
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  isMobileOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 