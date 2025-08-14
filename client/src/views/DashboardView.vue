<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Dashboard Overview Component -->
                <DashboardOverview
              :analytics-data="analyticsDataWithServiceMetrics"
              :orders-data="ordersData"
              :profitability-data="profitabilityData"
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
      :analytics-data="analyticsDataWithServiceMetrics"
      :orders-data="ordersData"
      :profitability-data="profitabilityData"
      :current-date-range="currentDateRange"
      :selected-date-range="selectedDateRange"
      :loading="loading"
      :key="`${currentDateRange.start}-${currentDateRange.end}-${profitabilityData?.period?.start || ''}-${profitabilityData?.period?.end || ''}`"
    />

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <div class="card">
        <div class="card-body">
          <div class="animate-pulse space-y-2">
            <div class="h-3 w-24 bg-gray-200 rounded"></div>
            <div class="h-6 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="animate-pulse space-y-2">
            <div class="h-3 w-24 bg-gray-200 rounded"></div>
            <div class="h-6 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="animate-pulse space-y-2">
            <div class="h-3 w-24 bg-gray-200 rounded"></div>
            <div class="h-6 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="animate-pulse space-y-2">
            <div class="h-3 w-24 bg-gray-200 rounded"></div>
            <div class="h-6 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
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
const ordersData = ref(null)
const profitabilityData = ref(null)
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
  
  // Use a more reliable method to get current date in timezone
  const now = new Date()
  
  // Get the date parts in the target timezone
  const timezoneString = now.toLocaleString('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  
  // Parse the timezone string (format: YYYY-MM-DD)
  const [year, month, day] = timezoneString.split('-')
  
  // Validate the parsed values
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error(`❌ Failed to parse timezone date: ${timezoneString}, timezone: ${timezone}`)
    // Fallback to UTC date
    const utcDate = new Date()
    const fallbackYear = utcDate.getUTCFullYear()
    const fallbackMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
    const fallbackDay = String(utcDate.getUTCDate()).padStart(2, '0')
    const fallbackResult = `${fallbackYear}-${fallbackMonth}-${fallbackDay}`
    console.log(`🔍 getCurrentDateInTimezone fallback: ${fallbackResult} (timezone: ${timezone})`)
    return fallbackResult
  }
  
  const result = `${year}-${month}-${day}`
  console.log(`🔍 getCurrentDateInTimezone: ${result} (timezone: ${timezone})`)
  return result
}

// Get date in user's timezone
const getDateInTimezone = (date, timezone) => {
  // Use a more reliable method to get date in timezone
  const timezoneString = date.toLocaleString('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  
  // Parse the timezone string (format: YYYY-MM-DD)
  const [year, month, day] = timezoneString.split('-')
  
  // Validate the parsed values
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error(`❌ Failed to parse timezone date: ${timezoneString}, input: ${date}, timezone: ${timezone}`)
    // Fallback to current date in timezone
    return getCurrentDateInTimezone()
  }
  
  const result = `${year}-${month}-${day}`
  console.log(`🔍 getDateInTimezone: ${result} (input: ${date}, timezone: ${timezone})`)
  return result
}

const getDateRange = (rangeType) => {
  const timezone = authStore.user?.timezone || 'America/Lima'
  const today = new Date()
  
  console.log(`🔍 getDateRange called with rangeType: ${rangeType}, timezone: ${timezone}`)
  
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
  }
  fetchAnalyticsData()
  fetchOrdersData(currentDateRange.value)
  fetchServiceMetricsData()
  fetchProfitabilityData()
}

const onCustomDateChange = () => {
  // Auto-apply if both dates are selected
  if (customStartDate.value && customEndDate.value) {
    currentDateRange.value = {
      start: customStartDate.value,
      end: customEndDate.value
    }
    fetchAnalyticsData()
    fetchOrdersData(currentDateRange.value)
    fetchServiceMetricsData()
    fetchProfitabilityData()
  }
}

const applyCustomDateRange = () => {
  if (customStartDate.value && customEndDate.value) {
    currentDateRange.value = {
      start: customStartDate.value,
      end: customEndDate.value
    }
    fetchAnalyticsData()
    fetchOrdersData(currentDateRange.value)
    fetchServiceMetricsData()
    fetchProfitabilityData()
  }
}

const fetchOrdersData = async (dateRange = null) => {
  try {
    const timezone = authStore.user?.timezone || 'America/Lima'
    
    // Always use explicit dates - frontend is responsible for calculating them
    const effectiveDateRange = dateRange || currentDateRange.value
    
    console.log('🔍 Orders request params:', {
      start: effectiveDateRange.start,
      end: effectiveDateRange.end,
      timezone: timezone,
      startType: typeof effectiveDateRange.start,
      endType: typeof effectiveDateRange.end,
      startValid: !isNaN(new Date(effectiveDateRange.start)),
      endValid: !isNaN(new Date(effectiveDateRange.end))
    })
    
    const params = new URLSearchParams({
      'filter[start_date]': effectiveDateRange.start,
      'filter[end_date]': effectiveDateRange.end,
      'filter[timezone]': timezone
    })

    // Use new /api/orders endpoint for order-related data
    const url = `/api/orders?${params.toString()}`
    console.log('🔍 Orders request URL:', url)
    console.log('🔍 Orders params.toString():', params.toString())
    console.log('🔍 Orders params entries:', Array.from(params.entries()))

    const data = await api.get(url)
    
    if (data.success) {
      ordersData.value = data
      console.log('📊 Orders data loaded:', data)
    } else {
      throw new Error(data.error || 'Failed to load orders data')
    }
  } catch (err) {
    console.error('❌ Orders fetch error:', err)
    // Clear orders data when endpoint fails
    ordersData.value = null
    // Don't show error notification for orders as it's optional
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

    // Use new /api/payments endpoint (refactored version of /all)
    const data = await api.get(`/api/payments?${params.toString()}`)
    
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

// Check if current date range corresponds to "today"
const isToday = computed(() => {
  if (!currentDateRange.value.start || !currentDateRange.value.end) return false
  
  const timezone = authStore.user?.timezone || 'America/Lima'
  const todayInTimezone = getCurrentDateInTimezone()
  
  return currentDateRange.value.start === todayInTimezone && 
         currentDateRange.value.end === todayInTimezone
})

// Fetch service metrics data (only available for "today")
const fetchServiceMetricsData = async () => {
  if (selectedDateRange.value !== 'today') {
    serviceMetricsData.value = null
    return
  }
  try {
    const timezone = authStore.user?.timezone || 'America/Lima'
    const params = new URLSearchParams({
      timezone: timezone
    })
    const data = await api.get(`/api/orders/service-metrics?${params.toString()}`)
    if (data.success) {
      serviceMetricsData.value = data.data
      console.log('📊 Service metrics data loaded:', data.data)
    } else {
      console.warn('⚠️ Service metrics data failed to load:', data.error)
      serviceMetricsData.value = null
    }
  } catch (err) {
    console.error('❌ Service metrics fetch error:', err)
    serviceMetricsData.value = null
  }
}

// Attach service metrics data to account data
const attachServiceMetricsToAccounts = (accounts) => {
  if (!accounts || !serviceMetricsData.value) return accounts
  
  return accounts.map(account => {
    // Find matching service metrics data for this account
    const accountServiceMetrics = serviceMetricsData.value[account.accountKey] || null
    
    return {
      ...account,
      serviceMetrics: accountServiceMetrics
    }
  })
}

// Enhanced analytics data with service metrics
const analyticsDataWithServiceMetrics = computed(() => {
  if (!analyticsData.value) return null
  // Copy all properties, but replace accounts with the version that has service metrics
  return {
    ...analyticsData.value,
    accounts: attachServiceMetricsToAccounts(analyticsData.value.accounts || [])
  }
})

const refreshData = () => {
  fetchAnalyticsData()
  fetchOrdersData(currentDateRange.value)
  fetchServiceMetricsData()
  fetchProfitabilityData()
}

onMounted(() => {
  currentDateRange.value = getDateRange('today')
  fetchAnalyticsData()
  fetchOrdersData(currentDateRange.value)
  fetchServiceMetricsData()
  fetchProfitabilityData()
})

// Fetch server-side aggregated profitability data
const fetchProfitabilityData = async () => {
  try {
    const timezone = authStore.user?.timezone || 'America/Lima'
    console.log('📊 Fetching profitability data for:', {
      start: currentDateRange.value.start,
      end: currentDateRange.value.end,
      timezone
    })
    
    const data = await api.getProfitability(
      currentDateRange.value.start,
      currentDateRange.value.end,
      timezone
    )
    
    if (data.success) {
      console.log('✅ Profitability data received:', {
        period: data.data?.period,
        accountsCount: data.data?.accounts?.length || 0,
        companyProfit: data.data?.company?.operatingProfit || 0
      })
      // Add timestamp to ensure reactivity
      profitabilityData.value = {
        ...data.data,
        timestamp: Date.now()
      }
    } else {
      console.warn('❌ Profitability data failed:', data.error)
      profitabilityData.value = null
    }
  } catch (err) {
    console.warn('⚠️ Profitability fetch failed:', err)
    profitabilityData.value = null
  }
}
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style> 