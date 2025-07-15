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
            <select v-model="selectedDateRange" @change="onDateRangeChange" class="form-input w-full sm:w-auto text-sm">
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
                v-model="customStartDate" 
                @change="onCustomDateChange"
                class="form-input w-full sm:w-auto text-sm"
                :max="todayString"
              />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-1">
              <label class="text-xs sm:text-sm text-gray-600">To:</label>
              <input 
                type="date" 
                v-model="customEndDate" 
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
      <!-- Total Payments -->
      <div class="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-blue-100 text-xs sm:text-sm font-medium">TOTAL TRANSACTIONs</p>
              <p class="text-2xl sm:text-3xl font-bold truncate">{{ analyticsData.aggregated.totalPayments }}</p>
              <div class="flex items-center mt-1" v-if="analyticsData.comparison">
                <span class="text-xs sm:text-sm" :class="analyticsData.comparison.payments.trend === 'up' ? 'text-green-200' : 'text-red-200'">
                  {{ analyticsData.comparison.payments.trend === 'up' ? '↗' : '↘' }} {{ Math.abs(analyticsData.comparison.payments.difference) }}
                </span>
                <span class="text-xs text-blue-200 ml-1">vs same period last week</span>
              </div>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
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
                  {{ analyticsData.comparison.amount.trend === 'up' ? '↗' : '↘' }} {{ formatCurrency(Math.abs(analyticsData.comparison.amount.difference)) }}
                </span>
                <span class="text-xs text-green-200 ml-1">vs same period last week</span>
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

    <!-- Account Details -->
    <div class="space-y-4" v-if="analyticsData && analyticsData.accounts.length > 0">
      <h3 class="text-base sm:text-lg font-medium text-gray-900">🏪 Account Details</h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div v-for="account in analyticsData.accounts" :key="account.accountKey" class="card">
          <div class="card-body">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 mb-4">
              <div class="min-w-0 flex-1">
                <h4 class="font-medium text-gray-900 text-sm sm:text-base truncate">{{ account.account }}</h4>
                <p class="text-xs sm:text-sm text-gray-500 truncate">{{ account.accountKey }}</p>
              </div>
              <span class="badge self-start" :class="account.success ? 'badge-success' : 'badge-danger'">
                {{ account.success ? 'Active' : 'Error' }}
              </span>
            </div>

            <div v-if="account.success && account.data" class="space-y-3">
              <!-- Account totals -->
              <div class="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                <div class="bg-blue-50 rounded-lg p-2 sm:p-3">
                  <p class="text-sm sm:text-lg font-bold text-blue-600">{{ getAccountTotalPayments(account) }}</p>
                  <p class="text-xs text-blue-500">Transactions</p>
                </div>
                <div class="bg-green-50 rounded-lg p-2 sm:p-3">
                  <p class="text-xs sm:text-lg font-bold text-green-600 truncate">{{ formatCurrency(getAccountTotalAmount(account)) }}</p>
                  <p class="text-xs text-green-500">Total</p>
                </div>
                <div class="bg-purple-50 rounded-lg p-2 sm:p-3">
                  <p class="text-sm sm:text-lg font-bold text-purple-600">{{ account.data.data?.length || 0 }}</p>
                  <p class="text-xs text-purple-500">Methods</p>
                </div>
              </div>

              <!-- Account comparison -->
              <div v-if="account.comparison" class="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-center">
                  <div>
                    <p class="text-xs sm:text-sm font-medium" :class="account.comparison.payments.trend === 'up' ? 'text-green-600' : 'text-red-600'">
                      {{ account.comparison.payments.trend === 'up' ? '+' : '' }}{{ account.comparison.payments.difference }} transactions
                    </p>
                    <p class="text-xs text-gray-500">vs same period last week</p>
                  </div>
                  <div>
                    <p class="text-xs sm:text-sm font-medium truncate" :class="account.comparison.amount.trend === 'up' ? 'text-green-600' : 'text-red-600'">
                      {{ account.comparison.amount.trend === 'up' ? '+' : '' }}{{ formatCurrency(account.comparison.amount.difference) }}
                    </p>
                    <p class="text-xs text-gray-500">vs same period last week</p>
                  </div>
                </div>
              </div>

              <!-- Account Payment Methods -->
              <div v-if="account.data.data && account.data.data.length > 0" class="bg-white border border-gray-100 rounded-lg p-3">
                <h5 class="text-xs font-medium text-gray-700 mb-2 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                  </svg>
                  Payment Methods
                </h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div v-for="method in getAccountPaymentMethods(account)" :key="method.name" 
                       class="bg-gray-50 rounded p-2">
                    <div class="flex items-center space-x-2 mb-1">
                      <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
                      <p class="font-medium text-gray-900 capitalize text-xs truncate">{{ method.name }}</p>
                    </div>
                    <div class="space-y-0.5">
                      <p class="font-bold text-gray-900 text-xs">{{ formatCurrency(method.sum) }}</p>
                      <div class="flex items-center justify-between text-xs text-gray-500">
                        <span>{{ method.count }} transactions</span>
                        <span>{{ method.percent.toFixed(1) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-4">
              <p class="text-xs sm:text-sm text-gray-500">{{ account.error || 'Unable to fetch data' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

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
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const analyticsData = ref(null)
const loading = ref(false)
const error = ref('')

// Date Range State
const selectedDateRange = ref('today')
const customStartDate = ref('')
const customEndDate = ref('')
const currentDateRange = ref({ start: '', end: '' })

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
const formatDate = (date) => {
  return date.toISOString().split('T')[0]
}

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

const formatCurrency = (amount) => {
  const currencySymbol = authStore.user?.currencySymbol || 'S/'
  return `${currencySymbol} ${(amount || 0).toFixed(2)}`
}

const formatDateRange = (period) => {
  if (!period) return ''
  if (period.start === period.end) {
    return period.start
  }
  return `${period.start} to ${period.end}`
}

const getPaymentMethodColor = (methodName) => {
  return paymentMethodColors[methodName.toLowerCase()] || '#6B7280'
}

const getAccountTotalPayments = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.count || 0), 0)
}

const getAccountTotalAmount = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
}

const getAccountPaymentMethods = (account) => {
  if (!account.success || !account.data?.data) return []
  const totalSum = account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  return account.data.data.map(method => ({
    name: method.name,
    sum: method.sum,
    count: method.count,
    percent: totalSum > 0 ? (method.sum / totalSum) * 100 : 0
  })).sort((a, b) => b.sum - a.sum) // Sort by sum descending
}

// Date range handlers
const onDateRangeChange = () => {
  if (selectedDateRange.value !== 'custom') {
    currentDateRange.value = getDateRange(selectedDateRange.value)
    fetchAnalyticsData()
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
  }
}

const applyCustomDateRange = () => {
  if (customStartDate.value && customEndDate.value) {
    currentDateRange.value = {
      start: customStartDate.value,
      end: customEndDate.value
    }
    fetchAnalyticsData()
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

    const response = await fetch(`/api/payments/all?${params.toString()}`, {
      headers: {
        'X-Session-ID': authStore.sessionId
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics data: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.success) {
      analyticsData.value = data
      console.log('📊 Analytics data loaded:', data)
    } else {
      throw new Error(data.error || 'Failed to load analytics data')
    }
  } catch (err) {
    console.error('❌ Analytics fetch error:', err)
    error.value = err.message
    
    // Show notification
    window.showNotification?.({
      type: 'error',
      title: 'Analytics Error',
      message: 'Failed to load analytics data'
    })
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  fetchAnalyticsData()
}

const goToLegacyDashboard = () => {
  window.open('/index.html', '_blank')
}

onMounted(() => {
  console.log('🚀 Dashboard mounted, initializing...')
  // Initialize with today's date range
  currentDateRange.value = getDateRange('today')
  fetchAnalyticsData()
})
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}

.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-danger {
  @apply bg-red-100 text-red-800;
}
</style> 