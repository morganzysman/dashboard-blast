<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">📊 Performance Overview</h2>
        <p class="text-sm sm:text-base text-gray-600">Real-time analytics from your OlaClick accounts</p>
      </div>
    </div>

    <!-- Date Range Picker -->
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <label class="text-sm font-medium text-gray-700">📅 Date Range:</label>
            <select 
              :value="selectedDateRange" 
              @input="$emit('update:selectedDateRange', $event.target.value)"
              @change="onDateRangeChange" 
              class="form-input w-full sm:w-auto text-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisweek">This Week</option>
              <option value="lastweek">Last Week</option>
              <option value="thismonth">This Month</option>
              <option value="lastmonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <!-- Custom Date Inputs -->
          <div v-if="selectedDateRange === 'custom'" class="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-1">
              <label class="text-xs sm:text-sm text-gray-600">From:</label>
              <input 
                type="date" 
                :value="customStartDate"
                @input="$emit('update:customStartDate', $event.target.value)"
                @change="onCustomDateChange"
                class="form-input w-full sm:w-auto text-sm"
                :max="todayString"
              />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-1">
              <label class="text-xs sm:text-sm text-gray-600">To:</label>
              <input 
                type="date" 
                :value="customEndDate"
                @input="$emit('update:customEndDate', $event.target.value)"
                @change="onCustomDateChange"
                class="form-input w-full sm:w-auto text-sm"
                :min="customStartDate"
                :max="todayString"
              />
            </div>
          </div>

          <!-- Current Range Display -->
          <div class="flex items-center text-xs sm:text-sm text-gray-600">
            <span v-if="currentDateRange.start === currentDateRange.end">
              📊 {{ formatDisplayDate(currentDateRange.start) }}
            </span>
            <span v-else>
              📊 {{ formatDisplayDate(currentDateRange.start) }} → {{ formatDisplayDate(currentDateRange.end) }}
            </span>
          </div>

          <!-- Refresh Button -->
          <button @click="refreshData" class="btn-secondary btn-sm w-full sm:w-auto" :disabled="loading">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>

          <!-- Apply Button (for custom range) -->
          <button 
            v-if="selectedDateRange === 'custom' && customStartDate && customEndDate" 
            @click="applyCustomDateRange" 
            class="btn-primary btn-sm w-full sm:w-auto"
            :disabled="loading"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>

    <!-- Overall Performance Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6" v-if="analyticsData">
      <!-- Total Orders -->
      <div class="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-blue-100 text-xs sm:text-sm font-medium">TOTAL ORDERS</p>
              <p class="text-2xl sm:text-3xl font-bold truncate">{{ getTotalOrders() }}</p>
              <div class="flex items-center mt-1" v-if="getOrdersComparison()">
                <span class="text-xs sm:text-sm" :class="getOrdersComparison().trend === 'up' ? 'text-green-200' : 'text-red-200'">
                  {{ getOrdersComparison().trend === 'up' ? '↗' : '↘' }}
                  {{
                    getTotalOrders()
                      ? ((Math.abs(getOrdersComparison().difference) / getTotalOrders()) * 100).toFixed(1)
                      : '0.0'
                  }}%
                </span>
                <span class="text-xs text-blue-200 ml-1">vs Prev. same period</span>
              </div>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Amount with Account Distribution --> 
      <div class="card bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-green-100 text-xs sm:text-sm font-medium">TOTAL AMOUNT</p>
              <p class="text-xl sm:text-3xl font-bold truncate">{{ formatCurrency(analyticsData.aggregated.totalAmount) }}</p>
              <div class="flex items-center mt-1" v-if="analyticsData.comparison">
                <span class="text-xs sm:text-sm" :class="analyticsData.comparison.amount.trend === 'up' ? 'text-green-200' : 'text-red-200'">
                  {{ analyticsData.comparison.amount.trend === 'up' ? '↗' : '↘' }}
                  {{
                    analyticsData.aggregated.totalAmount
                      ? ((Math.abs(analyticsData.comparison.amount.difference) / analyticsData.aggregated.totalAmount) * 100).toFixed(1)
                      : '0.0'
                  }}%
                </span>
                <span class="text-xs text-green-200 ml-1">vs Prev. same period</span>
              </div>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
          </div>
          
          <!-- Account Distribution Bar -->
          <div v-if="analyticsData && analyticsData.accounts.length > 1" class="mt-3">
            <div class="relative w-full bg-green-700 bg-opacity-30 rounded-full h-6 overflow-hidden">
              <div class="flex h-full relative">
                <div v-for="account in getAccountTotalsForChart()" 
                     :key="account.accountKey"
                     class="h-full transition-all duration-300 relative group"
                     :style="{ 
                       width: account.percent + '%',
                       backgroundColor: getAccountColor(account.accountKey)
                     }">
                  <!-- Account label overlay - only show for segments > 15% -->
                  <div v-if="account.percent > 15" 
                       class="absolute inset-0 flex flex-col items-center justify-center px-1">
                    <span class="text-white text-xs font-semibold truncate leading-tight">{{ account.account.split(' ')[0] }}</span>
                    <span class="text-white text-xs opacity-90 leading-tight">{{ formatCurrency(account.totalAmount) }}</span>
                  </div>
                  
                  <!-- Tooltip for all segments -->
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    {{ account.account }}<br/>
                    {{ formatCurrency(account.totalAmount) }} ({{ account.percent.toFixed(1) }}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Single account message -->
          <div v-else-if="analyticsData && analyticsData.accounts.length === 1" class="mt-3">
            <span class="text-green-100 text-xs">{{ analyticsData.accounts[0].account }}</span>
          </div>
        </div>
      </div>

      <!-- Total Tips -->
      <div class="card bg-gradient-to-r from-amber-500 to-orange-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-amber-100 text-xs sm:text-sm font-medium">TOTAL TIPS</p>
              <p class="text-xl sm:text-3xl font-bold truncate">{{ formatCurrency(analyticsData.aggregated.totalTips || 0) }}</p>
              <p class="text-xs sm:text-sm text-amber-200 mt-1">From all accounts</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-amber-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Methods Distribution -->
      <div class="card bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-purple-100 text-xs sm:text-sm font-medium">PAYMENT METHODS</p>
              <p class="text-lg sm:text-xl font-bold truncate">{{ analyticsData.aggregated.paymentMethods.length }} Methods</p>
              <p class="text-xs sm:text-sm text-purple-200 mt-1">{{ formatCurrency(analyticsData.aggregated.totalAmount) }} total</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-purple-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
            </div>
          </div>
          
          <!-- Payment Methods Pie Chart -->
          <div v-if="analyticsData && analyticsData.aggregated.paymentMethods.length > 0" class="mt-3">
            <div class="flex items-center justify-center">
              <div class="relative w-16 h-16 sm:w-20 sm:h-20">
                <!-- Pie Chart using conic-gradient -->
                <div 
                  class="w-full h-full rounded-full"
                  :style="{ background: getPaymentMethodsPieChart() }"
                ></div>
                <!-- Center hole for donut effect -->
                <div class="absolute inset-2 bg-purple-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.aggregated.paymentMethods.length }}</span>
                </div>
              </div>
              
              <!-- Legend -->
              <div class="ml-4 space-y-1 text-xs max-w-24">
                <div v-for="method in analyticsData.aggregated.paymentMethods.slice(0, 3)" :key="method.name" 
                     class="flex items-center space-x-1">
                  <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
                  <span class="text-purple-100 truncate capitalize">{{ method.name }}</span>
                  <span class="text-purple-200">{{ method.percent.toFixed(0) }}%</span>
                </div>
                <div v-if="analyticsData.aggregated.paymentMethods.length > 3" class="text-purple-200">
                  +{{ analyticsData.aggregated.paymentMethods.length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>




    <!-- Service Metrics -->
    <div class="card" v-if="serviceMetricsData && serviceMetricsData.aggregated.services.length > 0">
      <div class="card-header">
        <div class="flex items-center justify-between">
          <h3 class="text-base sm:text-lg font-medium text-gray-900">📊 Service Metrics</h3>
          <button 
            @click="toggleServiceMetrics"
            class="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
          >
            <span class="text-gray-600">{{ isServiceMetricsVisible ? 'Hide' : 'Show' }}</span>
            <svg 
              class="w-4 h-4 text-gray-600 transition-transform duration-200" 
              :class="{ 'rotate-180': isServiceMetricsVisible }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="card-body" v-show="isServiceMetricsVisible">
        <!-- Service Distribution Chart -->
        <div class="mb-6">
          <div class="flex items-center space-x-2 mb-2">
            <h4 class="text-sm font-medium text-gray-700">Orders Distribution by Service Type</h4>
            <span class="text-xs text-gray-500">({{ serviceMetricsData.aggregated.totalOrders }} total orders)</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div class="flex h-full">
              <div v-for="service in getServiceMetricsForChart()" 
                   :key="service.type"
                   class="h-full transition-all duration-300"
                   :style="{ 
                     width: service.percent + '%',
                     backgroundColor: getServiceColor(service.type)
                   }"
                   :title="`${service.type}: ${service.orders} orders (${service.percent.toFixed(1)}%)`">
              </div>
            </div>
          </div>
        </div>

        <!-- Service Metrics Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div v-for="service in serviceMetricsData.aggregated.services" :key="service.type" 
               class="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div class="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getServiceColor(service.type) }"></div>
              <p class="font-medium text-gray-900 text-sm sm:text-base">{{ service.type }}</p>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Orders</span>
                <span class="font-bold text-gray-900 text-sm">{{ service.orders }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Sales</span>
                <span class="font-bold text-gray-900 text-sm">{{ formatCurrency(service.sales) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Avg. Ticket</span>
                <span class="font-bold text-gray-900 text-sm">{{ formatCurrency(service.averageTicket) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  analyticsData: Object,
  serviceMetricsData: Object,
  loading: Boolean,
  selectedDateRange: String,
  customStartDate: String,
  customEndDate: String,
  currentDateRange: Object
})

const emit = defineEmits([
  'update:selectedDateRange',
  'update:customStartDate',
  'update:customEndDate',
  'date-range-change',
  'custom-date-change', 
  'apply-custom-date-range',
  'refresh-data'
])

const authStore = useAuthStore()

// Service Metrics visibility state (hidden by default)
const isServiceMetricsVisible = ref(false)

const paymentMethodColors = {
  'cash': '#10B981',
  'card': '#3B82F6', 
  'bitcoin': '#F59E0B',
  'yape': '#8B5CF6',
  'plin': '#06B6D4',
  'transfer': '#EF4444'
}

// Computed properties
const todayString = computed(() => {
  return getCurrentDateInTimezone()
})

// Date helper functions
const formatDisplayDate = (dateString) => {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
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

const formatCurrency = (amount) => {
  const currencySymbol = authStore.user?.currencySymbol || 'S/'
  const num = Number(amount) || 0
  return `${currencySymbol} ${num.toFixed(2)}`
}

const getPaymentMethodColor = (methodName) => {
  return paymentMethodColors[methodName.toLowerCase()] || '#6B7280'
}

const getAccountColor = (accountKey) => {
  // Generate a hash from the account key to ensure consistent colors
  let hash = 0
  for (let i = 0; i < accountKey.length; i++) {
    const char = accountKey.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Use the hash to generate a color
  const hue = Math.abs(hash) % 360
  const saturation = 70 + (Math.abs(hash) % 20) // 70-90%
  const lightness = 45 + (Math.abs(hash) % 15) // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

const getAccountTotalsForChart = () => {
  if (!props.analyticsData || props.analyticsData.aggregated.accountsCount === 0) {
    return []
  }

  const accountTotals = props.analyticsData.accounts.map(account => {
    const totalPayments = getAccountTotalPayments(account)
    const totalAmount = getAccountTotalAmount(account)
    return {
      accountKey: account.accountKey,
      account: account.account,
      totalPayments: totalPayments,
      totalAmount: totalAmount,
      percent: 0 // Will be calculated below
    }
  })

  // Calculate total amount across all accounts for the chart
  const totalAmountAcrossAllAccounts = accountTotals.reduce((sum, account) => sum + account.totalAmount, 0)

  return accountTotals.map(account => ({
    ...account,
    percent: totalAmountAcrossAllAccounts > 0 ? (account.totalAmount / totalAmountAcrossAllAccounts) * 100 : 0
  })).sort((a, b) => b.totalAmount - a.totalAmount) // Sort by total amount descending
}

const getAccountTotalPayments = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.count || 0), 0)
}

const getAccountTotalAmount = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
}

const getServiceColor = (serviceType) => {
  const colors = {
    'TABLE': '#4F46E5', // Indigo
    'ONSITE': '#10B981', // Green
    'TAKEAWAY': '#F59E0B', // Amber
    'DELIVERY': '#EF4444' // Red
  }
  return colors[serviceType] || '#6B7280' // Default color
}

const getServiceMetricsForChart = () => {
  if (!props.serviceMetricsData || props.serviceMetricsData.aggregated.totalOrders === 0) {
    return []
  }

  const totalOrders = props.serviceMetricsData.aggregated.totalOrders
  return props.serviceMetricsData.aggregated.services
    .filter(service => service.orders > 0)
    .map(service => ({
      ...service,
      percent: totalOrders > 0 ? (service.orders / totalOrders) * 100 : 0
    }))
    .sort((a, b) => b.orders - a.orders) // Sort by orders descending
}

const getTotalOrders = () => {
  // Use service metrics data if available, otherwise fall back to payment data
  if (props.serviceMetricsData && props.serviceMetricsData.aggregated) {
    return props.serviceMetricsData.aggregated.totalOrders
  }
  // Fallback to payment data
  if (props.analyticsData) {
    return props.analyticsData.aggregated.totalPayments
  }
  return 0
}

const getOrdersComparison = () => {
  // Use service metrics comparison data if available
  if (props.serviceMetricsData && props.serviceMetricsData.comparison) {
    return {
      trend: props.serviceMetricsData.comparison.orders.trend,
      difference: props.serviceMetricsData.comparison.orders.difference
    }
  }
  
  // Fallback to payment data comparison if available
  if (props.analyticsData && props.analyticsData.comparison) {
    return {
      trend: props.analyticsData.comparison.payments.trend,
      difference: props.analyticsData.comparison.payments.difference
    }
  }
  
  return null
}

// Event handlers
const onDateRangeChange = () => {
  emit('date-range-change')
}

const onCustomDateChange = () => {
  emit('custom-date-change')
}

const applyCustomDateRange = () => {
  emit('apply-custom-date-range')
}

const refreshData = () => {
  emit('refresh-data')
}

// Toggle Service Metrics visibility
const toggleServiceMetrics = () => {
  isServiceMetricsVisible.value = !isServiceMetricsVisible.value
}

// Generate pie chart for payment methods using conic-gradient
const getPaymentMethodsPieChart = () => {
  if (!props.analyticsData || !props.analyticsData.aggregated.paymentMethods.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  const methods = props.analyticsData.aggregated.paymentMethods
  let currentAngle = 0
  const gradientStops = []

  methods.forEach((method, index) => {
    const color = getPaymentMethodColor(method.name)
    const percentage = method.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
}
</script> 