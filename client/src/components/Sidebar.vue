<template>
  <nav :class="[
    'sidebar',
    { 'mobile-open': isMobileOpen }
  ]">
    <!-- Isologo — clear space kept equal to the height of the "B" -->
    <div class="sidebar-header">
      <div class="flex items-center justify-between w-full gap-3">
        <router-link :to="homeLink" class="min-w-0 flex items-center" :aria-label="$t('app.name')">
          <BlastLogo variant="isologo" :height="34" style="color: var(--nav-active-fg);" />
        </router-link>
        <!-- Mobile close button -->
        <button @click="$emit('close')"
                class="md:hidden p-2 rounded-md transition-colors flex-shrink-0"
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

    <!-- Firma de barra -->
    <div class="sidebar-footer">
      <span>Miraflores · Barranco</span>
      <span class="sidebar-footer__tag">#EstoEsBlast</span>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import MaterialIcon from './ui/MaterialIcon.vue'
import BlastLogo from './ui/BlastLogo.vue'

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
  { name: 'EmployeeClock', to: '/clock', icon: 'schedule', label: 'navigation.clock', show: isEmployee.value },
  { name: 'EmployeeTimesheet', to: '/timesheet', icon: 'event_note', label: 'navigation.timesheet', show: isEmployee.value },
  { name: 'EmployeeContracts', to: '/contracts', icon: 'description', label: 'navigation.contracts', show: isEmployee.value },
  { name: 'Notifications', to: '/notifications', icon: 'notifications', label: 'navigation.notifications', show: !isSuperAdmin.value },
  { name: 'GainCalendar', to: '/gain-calendar', icon: 'savings', label: 'navigation.gainCalendar', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'Achievements', to: '/achievements', icon: 'emoji_events', label: 'navigation.achievements', show: !isSuperAdmin.value && !isEmployee.value },
  { name: 'AdminPayroll', to: '/admin/payroll', icon: 'payments', label: 'navigation.payroll', show: isAdmin.value },
  { name: 'AdminHolidays', to: '/admin/holidays', icon: 'event', label: 'navigation.holidays', show: isAdmin.value },
  { name: 'AdminShiftsCalendar', to: '/admin/shifts', icon: 'calendar_month', label: 'navigation.shiftsCalendar', show: isAdmin.value },
  { name: 'AdminSalesImport', to: '/admin/sales-import', icon: 'upload_file', label: 'navigation.salesImport', show: isAdmin.value },
  { name: 'Admin', to: '/admin', icon: 'group', label: 'navigation.userManagement', show: isSuperAdmin.value || isAdmin.value },
  { name: 'Companies', to: '/companies', icon: 'apartment', label: 'navigation.companies', show: isSuperAdmin.value },
])

const visibleLinks = computed(() => links.value.filter(l => l.show))

const homeLink = computed(() => visibleLinks.value[0]?.to ?? '/')
</script>

<style scoped>
.sidebar-nav-icon {
  width: auto;
  height: auto;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--nav-border);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

/* Hashtags siempre en Verde Menta. */
.sidebar-footer__tag {
  color: var(--accent);
  text-transform: none;
  letter-spacing: 0.04em;
}
</style>
