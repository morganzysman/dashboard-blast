<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Dashboard Overview Component -->
    <DashboardOverview
      :analytics-data="analyticsData"
      :service-metrics-data="serviceMetricsData"
      :loading="loading"
      v-model:selected-date-range="selectedDateRange"
      v-model:custom-start-date="customStartDate"
      v-model:custom-end-date="customEndDate"
      :current-date-range="currentDateRange"
      @date-range-change="onDateRangeChange"
      @custom-date-change="onCustomDateChange"
      @apply-custom-date-range="applyCustomDateRange"
      @refresh-data="refreshData"
    />

    <!-- Account Details Component -->
    <AccountDetails
      :analytics-data="analyticsData"
      :key="analyticsData?.timestamp || Date.now()"
    />

    <!-- Loading State -->
    <div v-if="loading" class="card">
      <div class="card-body text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-600">Fetching analytics data...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="card border-red-200 bg-red-50">
      <div class="card-body text-center py-12">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-red-900 mb-2">Failed to Load Analytics</h3>
        <p class="text-red-700 mb-4">{{ error }}</p>
        <button @click="refreshData" class="btn-primary">Try Again</button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !error && (!analyticsData || analyticsData.aggregated.accountsCount === 0)" class="card">
      <div class="card-body text-center py-12">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p class="text-gray-600 mb-4">No accounts are assigned to your user or no data is available for the selected period.</p>
        <button @click="refreshData" class="btn-secondary">Refresh Data</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import DashboardOverview from '../components/DashboardOverview.vue'
import AccountDetails from '../components/AccountDetails.vue'
import api from '../utils/api'

const authStore = useAuthStore()

const analyticsData = ref(null)
const serviceMetricsData = ref(null)
const loading = ref(false)
const error = ref('')

// Date Range State
const selectedDateRange = ref('today')
const customStartDate = ref('')
const customEndDate = ref('')
const currentDateRange = ref({ start: '', end: '' })

// Date helper functions
const formatDate = (date) => {
  return date.toISOString().split('T')[0]
}

// Get current date in user's timezone
const getCurrentDateInTimezone = () => {
  const timezone = authStore.user?.timezone || 'America/Lima'
  
  // Create a date object for the current time in the user's timezone
  const now = new Date()
  const timezoneDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  
  // Format as YYYY-MM-DD
  const year = timezoneDate.getFullYear()
  const month = String(timezoneDate.getMonth() + 1).padStart(2, '0')
  const day = String(timezoneDate.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// Get date in user's timezone
const getDateInTimezone = (date, timezone) => {
  const timezoneDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  
  const year = timezoneDate.getFullYear()
  const month = String(timezoneDate.getMonth() + 1).padStart(2, '0')
  const day = String(timezoneDate.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

const getDateRange = (rangeType) => {
  const timezone = authStore.user?.timezone || 'America/Lima'
  const today = new Date()
  
  switch (rangeType) {
    case 'today':
      return { 
        start: getCurrentDateInTimezone(), 
        end: getCurrentDateInTimezone() 
      }
    
    case 'yesterday':
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { 
        start: getDateInTimezone(yesterday, timezone), 
        end: getDateInTimezone(yesterday, timezone) 
      }
    
    case 'last7days':
      const week = new Date(today)
      week.setDate(week.getDate() - 6)
      return { 
        start: getDateInTimezone(week, timezone), 
        end: getCurrentDateInTimezone() 
      }
    
    case 'last30days':
      const month = new Date(today)
      month.setDate(month.getDate() - 29)
      return { 
        start: getDateInTimezone(month, timezone), 
        end: getCurrentDateInTimezone() 
      }
    
    case 'thisweek':
      const startOfWeek = new Date(today)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is Sunday
      startOfWeek.setDate(diff)
      return { 
        start: getDateInTimezone(startOfWeek, timezone), 
        end: getCurrentDateInTimezone() 
      }
    
    case 'lastweek':
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekStart.getDate() - 6)
      return { 
        start: getDateInTimezone(lastWeekStart, timezone), 
        end: getDateInTimezone(lastWeekEnd, timezone) 
      }
    
    case 'thismonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { 
        start: getDateInTimezone(startOfMonth, timezone), 
        end: getCurrentDateInTimezone() 
      }
    
    case 'lastmonth':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return { 
        start: getDateInTimezone(lastMonth, timezone), 
        end: getDateInTimezone(lastMonthEnd, timezone) 
      }
    
    case 'custom':
      return { 
        start: customStartDate.value, 
        end: customEndDate.value 
      }
    
    default:
      return { 
        start: getCurrentDateInTimezone(), 
        end: getCurrentDateInTimezone() 
      }
  }
}

// Date range handlers
const onDateRangeChange = () => {
  if (selectedDateRange.value !== 'custom') {
    currentDateRange.value = getDateRange(selectedDateRange.value)
    fetchAnalyticsData()
    fetchServiceMetricsData(currentDateRange.value)
  }
}

const onCustomDateChange = () => {
  // Auto-apply if both dates are selected
  if (customStartDate.value && customEndDate.value) {
    currentDateRange.value = {
      start: customStartDate.value,
      end: customEndDate.value
    }
    fetchAnalyticsData()
    fetchServiceMetricsData(currentDateRange.value)
  }
}

const applyCustomDateRange = () => {
  if (customStartDate.value && customEndDate.value) {
    currentDateRange.value = {
      start: customStartDate.value,
      end: customEndDate.value
    }
    fetchAnalyticsData()
    fetchServiceMetricsData(currentDateRange.value)
  }
}

const fetchServiceMetricsData = async (dateRange = null) => {
  try {
    const timezone = authStore.user?.timezone || 'America/Lima'
    const params = new URLSearchParams({
      'timezone': timezone
    })

    // If date range is provided, use custom date parameters
    if (dateRange) {
      params.set('filter[start_date]', dateRange.start)
      params.set('filter[end_date]', dateRange.end)
    } else {
      // Only set period when no custom date range is provided
      params.set('period', 'today')
    }

    const data = await api.get(`/api/payments/general-indicators?${params.toString()}`)
    
    if (data.success) {
      serviceMetricsData.value = data
      console.log('📊 Service metrics data loaded:', data)
    } else {
      throw new Error(data.error || 'Failed to load service metrics data')
    }
  } catch (err) {
    console.error('❌ Service metrics fetch error:', err)
    // Don't show error notification for service metrics as it's optional
    // The api wrapper already handles session expiration
  }
}

const fetchAnalyticsData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const timezone = authStore.user?.timezone || 'America/Lima'
    const params = new URLSearchParams({
      'filter[start_date]': currentDateRange.value.start,
      'filter[end_date]': currentDateRange.value.end,
      'filter[timezone]': timezone
    })

    const data = await api.get(`/api/payments/all?${params.toString()}`)
    
    if (data.success) {
      analyticsData.value = data
      analyticsData.value.timestamp = Date.now()
      console.log('📊 Analytics data loaded:', data)
    } else {
      throw new Error(data.error || 'Failed to load analytics data')
    }
  } catch (err) {
    console.error('❌ Analytics fetch error:', err)
    
    // Only show error if it's not a session expiration (handled by api wrapper)
    if (err.status !== 401) {
      error.value = err.message
      
      window.showNotification?.({
        type: 'error',
        title: 'Analytics Error',
        message: 'Failed to load analytics data'
      })
    }
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  fetchAnalyticsData()
  fetchServiceMetricsData(currentDateRange.value)
}

onMounted(() => {
  console.log('🚀 Dashboard mounted, initializing...')
  // Initialize with today's date range
  currentDateRange.value = getDateRange('today')
  fetchAnalyticsData()
  fetchServiceMetricsData()
})
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style> 