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

      <!-- Total Amount --> 
      <div class="card bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
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
        </div>
      </div>

      <!-- Payment Methods -->
      <div class="card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-purple-100 text-xs sm:text-sm font-medium">PAYMENT METHODS</p>
              <p class="text-2xl sm:text-3xl font-bold">{{ analyticsData.aggregated.paymentMethods.length }}</p>
              <p class="text-xs sm:text-sm text-purple-200 mt-1">Active methods</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-purple-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Accounts -->
      <div class="card bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-indigo-100 text-xs sm:text-sm font-medium">ACTIVE ACCOUNTS</p>
              <p class="text-2xl sm:text-3xl font-bold">{{ analyticsData.aggregated.accountsCount }}</p>
              <p class="text-xs sm:text-sm text-indigo-200 mt-1">Connected accounts</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Methods Breakdown -->
    <div class="card" v-if="analyticsData && analyticsData.aggregated.paymentMethods.length > 0">
      <div class="card-header">
        <h3 class="text-base sm:text-lg font-medium text-gray-900">🏦 Payment Methods</h3>
      </div>
      <div class="card-body">
        <!-- Stacked Bar Chart -->
        <div class="mb-6">
          <div class="flex items-center space-x-2 mb-2">
            <h4 class="text-sm font-medium text-gray-700">Amount Distribution by Payment Method</h4>
            <span class="text-xs text-gray-500">({{ formatCurrency(analyticsData.aggregated.totalAmount) }} total)</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div class="flex h-full">
              <div v-for="method in analyticsData.aggregated.paymentMethods" 
                   :key="method.name"
                   class="h-full transition-all duration-300"
                   :style="{ 
                     width: method.percent + '%',
                     backgroundColor: getPaymentMethodColor(method.name)
                   }"
                   :title="`${method.name}: ${formatCurrency(method.sum)} (${method.percent.toFixed(1)}%)`">
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Methods Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div v-for="method in analyticsData.aggregated.paymentMethods" :key="method.name" 
               class="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div class="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
              <p class="font-medium text-gray-900 capitalize text-sm sm:text-base truncate">{{ method.name }}</p>
            </div>
            <div class="space-y-1">
              <p class="font-bold text-gray-900 text-sm sm:text-base">{{ formatCurrency(method.sum) }}</p>
              <div class="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                <span>{{ method.count }} transactions</span>
                <span>{{ method.percent.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Account Totals Breakdown -->
    <div class="card" v-if="analyticsData && analyticsData.accounts.length > 0">
      <div class="card-header">
        <h3 class="text-base sm:text-lg font-medium text-gray-900">🏪 Account Totals</h3>
      </div>
      <div class="card-body">
        <!-- Stacked Bar Chart -->
        <div class="mb-6">
          <div class="flex items-center space-x-2 mb-2">
            <h4 class="text-sm font-medium text-gray-700">Amount Distribution by Account</h4>
            <span class="text-xs text-gray-500">({{ formatCurrency(analyticsData.aggregated.totalAmount) }} total)</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div class="flex h-full">
              <div v-for="account in getAccountTotalsForChart()" 
                   :key="account.accountKey"
                   class="h-full transition-all duration-300"
                   :style="{ 
                     width: account.percent + '%',
                     backgroundColor: getAccountColor(account.accountKey)
                   }"
                   :title="`${account.account}: ${formatCurrency(account.totalAmount)} (${account.percent.toFixed(1)}%)`">
              </div>
            </div>
          </div>
        </div>

        <!-- Account Totals Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div v-for="account in getAccountTotalsForChart()" :key="account.accountKey" 
               class="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div class="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getAccountColor(account.accountKey) }"></div>
              <p class="font-medium text-gray-900 text-sm sm:text-base truncate">{{ account.account }}</p>
            </div>
            <div class="space-y-1">
              <p class="font-bold text-gray-900 text-sm sm:text-base">{{ formatCurrency(account.totalAmount) }}</p>
              <div class="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                <span>{{ account.totalPayments }} transactions</span>
                <span>{{ account.percent.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Service Metrics -->
    <div class="card" v-if="serviceMetricsData && serviceMetricsData.aggregated.services.length > 0">
      <div class="card-header">
        <h3 class="text-base sm:text-lg font-medium text-gray-900">📊 Service Metrics</h3>
      </div>
      <div class="card-body">
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
</script> 