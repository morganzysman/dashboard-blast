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
      <!-- Dashboard - Hidden from super-admin and employees -->
      <router-link
        v-if="!authStore.isSuperAdmin && authStore.user?.role !== 'employee'"
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

      <!-- Notifications - Hidden from super-admin and employees -->
      <router-link
        v-if="!authStore.isSuperAdmin && authStore.user?.role !== 'employee'"
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

      <!-- Rentability - Hidden from super-admin and employees -->
      <router-link
        v-if="!authStore.isSuperAdmin && authStore.user?.role !== 'employee'"
        to="/rentability"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'Rentability' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Rentability
      </router-link>

      <!-- Employee: Clock (removed from sidebar) -->

      <!-- Employee: Timesheet -->
      <router-link
        v-if="authStore.user?.role === 'employee'"
        to="/timesheet"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'EmployeeTimesheet' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3M5 11h14M5 19h14M5 7h14M7 15h10" />
        </svg>
        My Timesheet
      </router-link>

      <!-- Admin: Payroll (hidden for super-admin) -->
      <router-link
        v-if="authStore.user?.role === 'admin'"
        to="/admin/payroll"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'AdminPayroll' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h10M7 20h10M7 5h10" />
        </svg>
        Payroll
      </router-link>

      <!-- Admin and Super Admin - User Management -->
      <router-link
        v-if="authStore.isSuperAdmin || authStore.user?.role === 'admin'"
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

      <!-- Super Admin - Companies -->
      <router-link
        v-if="authStore.isSuperAdmin"
        to="/companies"
        class="sidebar-nav-item"
        :class="{ active: $route.name === 'Companies' }"
        @click="$emit('close')"
      >
        <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h10M7 20h10M7 5h10" />
        </svg>
        Companies
      </router-link>

      <!-- Company info -->
      <div class="px-6 py-3" v-if="authStore.user?.company_id">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Company
        </div>
        <div class="mt-1 text-sm text-gray-900">
          Company ID: {{ authStore.user.company_id.substring(0, 8) }}...
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