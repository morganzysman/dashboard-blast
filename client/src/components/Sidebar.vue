<template>
  <nav :class="[
    'sidebar',
    { 'mobile-open': isMobileOpen }
  ]">
    <!-- Logo section -->
    <div class="sidebar-header">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex-shrink-0 flex items-center justify-center rounded-md" style="width: 28px; height: 28px; background: var(--brand-blue);">
            <span class="font-display font-bold text-white text-base leading-none">O</span>
          </div>
          <div class="min-w-0">
            <h1 class="font-bold truncate" style="font-size: 15px; color: var(--nav-text);">{{ $t('app.name') }}</h1>
            <p class="truncate" style="font-size: 11px; color: var(--nav-muted);">{{ $t('dashboard.analytics') }}</p>
          </div>
        </div>
        <!-- Mobile close button -->
        <button @click="$emit('close')"
                class="md:hidden p-2 rounded-md transition-colors"
                style="color: var(--nav-muted);">
          <MaterialIcon name="close" :size="22" />
        </button>
      </div>
    </div>

    <!-- Navigation items -->
    <nav class="sidebar-nav">
      <router-link
        v-for="link in visibleLinks"
        :key="link.name"
        :to="link.to"
        class="sidebar-nav-item"
        :class="{ active: $route.name === link.name }"
        @click="$emit('close')"
      >
        <MaterialIcon
          class="sidebar-nav-icon"
          :name="link.icon"
          :size="18"
          :filled="$route.name === link.name"
        />
        {{ $t(link.label) }}
      </router-link>
    </nav>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import MaterialIcon from './ui/MaterialIcon.vue'

const props = defineProps({
  isMobileOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()

const isEmployee = computed(() => authStore.user?.role === 'employee')
const isAdmin = computed(() => authStore.user?.role === 'admin')
const isSuperAdmin = computed(() => authStore.isSuperAdmin)

const links = computed(() => [
  { name: 'Dashboard', to: '/', icon: 'dashboard', label: 'navigation.dashboard', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'Setup', to: '/setup', icon: 'settings', label: 'navigation.setup', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'KitchenSla', to: '/kitchen-sla', icon: 'timer', label: 'navigation.kitchenSla', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'EmployeeClock', to: '/clock', icon: 'schedule', label: 'navigation.clock', show: isEmployee.value },
  { name: 'EmployeeTimesheet', to: '/timesheet', icon: 'event_note', label: 'navigation.timesheet', show: isEmployee.value },
  { name: 'Notifications', to: '/notifications', icon: 'notifications', label: 'navigation.notifications', show: !isSuperAdmin.value },
  { name: 'GainCalendar', to: '/gain-calendar', icon: 'savings', label: 'navigation.gainCalendar', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'Achievements', to: '/achievements', icon: 'emoji_events', label: 'navigation.achievements', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'AdminPayroll', to: '/admin/payroll', icon: 'payments', label: 'navigation.payroll', show: isAdmin.value },
  { name: 'AdminHolidays', to: '/admin/holidays', icon: 'event', label: 'navigation.holidays', show: isAdmin.value },
  { name: 'AdminShiftsCalendar', to: '/admin/shifts', icon: 'calendar_month', label: 'navigation.shiftsCalendar', show: isAdmin.value },
  { name: 'Admin', to: '/admin', icon: 'group', label: 'navigation.userManagement', show: isSuperAdmin.value || isAdmin.value },
  { name: 'Companies', to: '/companies', icon: 'apartment', label: 'navigation.companies', show: isSuperAdmin.value },
])

const visibleLinks = computed(() => links.value.filter(l => l.show))
</script>

<style scoped>
.sidebar-nav-icon {
  width: auto;
  height: auto;
}
</style>
