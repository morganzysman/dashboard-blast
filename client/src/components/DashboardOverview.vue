<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header with Date Picker -->
    <div class="card">
      <div class="card-body">
        <!-- Header and Date Range on same line -->
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
          <div class="min-w-0">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">📊 Performance Overview</h2>
            <p class="text-xs sm:text-sm text-gray-600">Real-time analytics from your OlaClick accounts</p>
          </div>
          
          <!-- Date Range Picker -->
          <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
            <label class="text-xs sm:text-sm font-medium text-gray-700">📅 Date Range:</label>
            <select 
              :value="selectedDateRange" 
              @input="$emit('update:selectedDateRange', $event.target.value)"
              @change="onDateRangeChange" 
              class="form-input w-full sm:w-auto text-xs sm:text-sm"
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
        </div>
       
        <!-- Custom Date Inputs and Actions -->
        <div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <!-- Custom Date Inputs -->

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
      <!-- Total Orders with Account Distribution -->
      <div class="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-blue-100 text-xs sm:text-sm font-medium">TOTAL ORDERS</p>
              <p class="text-lg sm:text-xl font-bold truncate">{{ getTotalOrders() }}</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
          
          <!-- Orders Distribution Pie Chart -->
          <div v-if="analyticsData && analyticsData.accounts.length > 1" class="mt-3">
            <div class="flex items-center justify-center">
              <div class="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                <!-- Pie Chart using conic-gradient -->
                <div 
                  class="w-full h-full rounded-full"
                  :style="{ background: getOrdersPieChart() }"
                ></div>
                <!-- Center hole for donut effect -->
                <div class="absolute inset-2 bg-blue-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.accounts.length }}</span>
                </div>
              </div>
              
              <!-- Legend -->
              <div class="ml-3 space-y-1 text-xs min-w-0 flex-1">
                <div v-for="account in getOrdersDistributionForChart().slice(0, 3)" :key="account.accountKey" 
                     class="min-w-0">
                  <div class="flex items-center space-x-1 min-w-0">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getAccountColor(account.accountKey) }"></div>
                    <span class="text-blue-100 truncate whitespace-nowrap">{{ account.account }}</span>
                  </div>
                  <div class="text-blue-200 mt-0.5">
                    <span>{{ account.percent.toFixed(0) }}%</span>
                    <span class="text-blue-100 font-medium ml-2">{{ account.totalOrders }}</span>
                  </div>
                </div>
                <div v-if="getOrdersDistributionForChart().length > 3" class="text-blue-200">
                  +{{ getOrdersDistributionForChart().length - 3 }} more
                </div>
              </div>
            </div>
          </div>
          
          <!-- Single account message -->
          <div v-else-if="analyticsData && analyticsData.accounts.length === 1" class="mt-3">
            <span class="text-blue-100 text-xs">{{ analyticsData.accounts[0].account }}</span>
          </div>
        </div>
      </div>

      <!-- Total Amount with Account Distribution --> 
      <div class="card bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-green-100 text-xs sm:text-sm font-medium">TOTAL AMOUNT</p>
              <p class="text-lg sm:text-xl font-bold truncate">{{ formatCurrency(getAggregatedGrossSales()) }}</p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
          </div>
          
          <!-- Account Distribution Pie Chart -->
          <div v-if="analyticsData && analyticsData.accounts.length > 1" class="mt-3">
            <div class="flex items-center justify-center">
              <div class="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                <!-- Pie Chart using conic-gradient -->
                <div 
                  class="w-full h-full rounded-full"
                  :style="{ background: getAccountsPieChart() }"
                ></div>
                <!-- Center hole for donut effect -->
                <div class="absolute inset-2 bg-green-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.accounts.length }}</span>
                </div>
              </div>
              
              <!-- Legend -->
              <div class="ml-3 space-y-1 text-xs min-w-0 flex-1">
                <div v-for="account in getAccountTotalsForChart().slice(0, 3)" :key="account.accountKey" 
                     class="min-w-0">
                  <div class="flex items-center space-x-1 min-w-0">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getAccountColor(account.accountKey) }"></div>
                    <span class="text-green-100 truncate whitespace-nowrap">{{ account.account }}</span>
                  </div>
                  <div class="text-green-200 mt-0.5 ml-3">
                    <span>{{ account.percent.toFixed(0) }}%</span>
                    <span class="text-green-100 font-medium ml-2">{{ formatCurrency(account.totalAmount) }}</span>
                  </div>
                </div>
                <div v-if="getAccountTotalsForChart().length > 3" class="text-green-200">
                  +{{ getAccountTotalsForChart().length - 3 }} more
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

      <!-- Payment Methods Distribution -->
      <div class="card bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-purple-100 text-xs sm:text-sm font-medium">PAYMENT METHODS</p>
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
              <div class="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                <div class="w-full h-full rounded-full" :style="{ background: getPaymentMethodsPieChart() }"></div>
                <div class="absolute inset-2 bg-purple-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.aggregated.paymentMethods.length }}</span>
                </div>
              </div>
              <div class="ml-3 space-y-1 text-xs min-w-0 flex-1">
                <div v-for="method in analyticsData.aggregated.paymentMethods.slice(0, 3)" :key="method.name" class="min-w-0">
                  <div class="flex items-center space-x-1 min-w-0">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
                    <span class="text-purple-100 capitalize truncate whitespace-nowrap">{{ method.name }}</span>
                  </div>
                  <div class="text-purple-200 mt-0.5">
                    <span>{{ method.percent.toFixed(0) }}%</span>
                    <span class="text-purple-100 font-medium ml-2">{{ formatCurrency(method.sum) }}</span>
                  </div>
                </div>
                <div v-if="analyticsData.aggregated.paymentMethods.length > 3" class="text-purple-200">+{{ analyticsData.aggregated.paymentMethods.length - 3 }} more</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Aggregated Daily Gain (moved into top KPI row) -->
      <div class="card bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-purple-100 text-xs sm:text-sm font-medium">{{ formatGainPeriodLabel() }} GAIN</p>
              <p class="text-lg sm:text-xl font-bold truncate" :class="getAggregatedGainClass()">
                <span v-if="isGainDisabled()" class="opacity-60">Unavailable for today</span>
                <span v-else>{{ formatCurrency(getAggregatedDailyGain()) }}</span>
              </p>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
          </div>
          <p class="text-xs text-purple-100">Includes fees, 30% food costs, utility costs, and payroll (closed entries)</p>
        </div>
      </div>
    </div>

    <!-- Company-level Profitability KPIs (disabled) -->

    <!-- Fees and Net Revenue by Payment Method -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6" v-if="false && analyticsData">
      <!-- Fees by Method -->
      <div class="card bg-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-700">Fees by Payment Method</p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <div class="relative w-20 h-20 sm:w-24 sm:h-24">
              <div class="w-full h-full rounded-full" :style="{ background: getFeesByMethodPieChart() }"></div>
              <div class="absolute inset-3 bg-gray-50 rounded-full flex items-center justify-center">
                <span class="text-gray-700 text-xs font-bold">{{ Object.keys(getFeesByMethodDistribution()).length }}</span>
              </div>
            </div>
            <div class="ml-4 space-y-1 text-xs min-w-0 flex-1">
              <div v-for="item in getTopFeesByMethod(3)" :key="item.method" class="flex items-center justify-between min-w-0">
                <div class="flex items-center space-x-1 min-w-0">
                  <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(item.method) }"></div>
                  <span class="text-gray-700 capitalize">{{ item.method }}</span>
                  <span class="text-gray-500">{{ item.percent.toFixed(0) }}%</span>
                </div>
                <span class="text-gray-700 font-medium ml-2">{{ formatCurrency(item.fees) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Net Revenue by Method -->
      <div class="card bg-white">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-700">Net Revenue by Payment Method</p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <div class="relative w-20 h-20 sm:w-24 sm:h-24">
              <div class="w-full h-full rounded-full" :style="{ background: getNetRevenueByMethodPieChart() }"></div>
              <div class="absolute inset-3 bg-gray-50 rounded-full flex items-center justify-center">
                <span class="text-gray-700 text-xs font-bold">{{ Object.keys(getNetRevenueByMethodDistribution()).length }}</span>
              </div>
            </div>
            <div class="ml-4 space-y-1 text-xs min-w-0 flex-1">
              <div v-for="item in getTopNetRevenueByMethod(3)" :key="item.method" class="flex items-center justify-between min-w-0">
                <div class="flex items-center space-x-1 min-w-0">
                  <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(item.method) }"></div>
                  <span class="text-gray-700 capitalize">{{ item.method }}</span>
                  <span class="text-gray-500">{{ item.percent.toFixed(0) }}%</span>
                </div>
                <span class="text-gray-700 font-medium ml-2">{{ formatCurrency(item.netRevenue) }}</span>
              </div>
            </div>
          </div>
    </div>
      </div>
    </div>





  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { calculateDaysInPeriod as calcDays } from '../composables/useProfitability'

const props = defineProps({
  analyticsData: Object,
  ordersData: Object,
  profitabilityData: Object,
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

// Client-side cost fetching removed; server provides profitability and distributions

// Calculate number of days in the current date range
const calculateDaysInPeriod = () => calcDays(props.currentDateRange)

// Format gain period label
const formatGainPeriodLabel = () => {
  const daysInPeriod = calculateDaysInPeriod()
  if (props.selectedDateRange === 'today') return 'Daily'
  if (daysInPeriod === 1) return 'Daily'
  if (daysInPeriod <= 31) return `${daysInPeriod}-Day`
  return 'Period'
}

// Per-account gain is now provided by server; for overview aggregated card we rely on company.operatingProfit

// Aggregated gain across all accounts
const getAggregatedDailyGain = () => {
  // Prefer server-side profitability if available
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.operatingProfit || 0
  }
  // Fallback: estimate from analytics totals when server data missing
  const gross = props.analyticsData?.aggregated?.totalAmount || 0
  if (gross <= 0) return 0
  const food = gross * 0.3
  // No fees/utilities breakdown available in fallback; assume zero
  return gross - food
}

const getAggregatedGainClass = () => {
  const gain = getAggregatedDailyGain()
  if (gain > 0) return 'text-green-100'
  if (gain < 0) return 'text-red-100'
  return 'text-white'
}

// Disable gain if the selected range includes today
const isGainDisabled = () => {
  const today = todayString.value
  return props.currentDateRange?.end === today
}

// No client-side cost fetching
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

const getAccountTotalOrders = (account) => {
  if (!account.success) return 0
  
  // Only use service metrics data for orders - this is the correct source that updates with dates
  if (account.serviceMetrics) {
    const ordersFromServiceMetrics = Object.values(account.serviceMetrics).reduce((sum, service) => sum + (service?.orders?.current_period ?? 0), 0);
    return ordersFromServiceMetrics;
  }
  
  return 0
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

const getTotalOrders = () => {
  // Use the new simplified orders data structure
  if (props.ordersData && props.ordersData.aggregated) {
    return props.ordersData.aggregated.totalOrders || 0
  }
  return 0
}

// Aggregated gross sales
const getAggregatedGrossSales = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.grossSales || 0
  }
  return props.analyticsData?.aggregated?.totalAmount || 0
}

// Client-side fee computation removed

// Aggregated payment fees across all accounts
const getAggregatedPaymentFees = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.paymentFees || 0
  }
  return 0
}

// Net sales after fees
const getAggregatedNetSalesAfterFees = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.netAfterFees || 0
  }
  return getAggregatedGrossSales() - getAggregatedPaymentFees()
}

// Blended fee rate
const getAggregatedFeeRate = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.feeRate || 0
  }
  const gross = getAggregatedGrossSales()
  if (gross <= 0) return 0
  return getAggregatedPaymentFees() / gross
}

// Tips
const getAggregatedTips = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.tips || 0
  }
  return props.analyticsData?.aggregated?.totalTips || 0
}

const getAggregatedTipRate = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.tipRate || 0
  }
  const gross = getAggregatedGrossSales()
  if (gross <= 0) return 0
  return getAggregatedTips() / gross
}

// Operating margin = operating profit / gross
const getAggregatedOperatingMargin = () => {
  if (props.profitabilityData?.company) {
    return props.profitabilityData.company.operatingMargin || 0
  }
  const gross = getAggregatedGrossSales()
  if (gross <= 0) return 0
  const operatingProfit = getAggregatedDailyGain()
  return operatingProfit / gross
}

// Fees by payment method (distribution)
const getFeesByMethodDistribution = () => {
  // Prefer server-side distributions
  if (props.profitabilityData?.distributions?.feesByMethod) {
    return props.profitabilityData.distributions.feesByMethod
  }
  return {}
}

const getTopFeesByMethod = (n = 3) => {
  const dist = getFeesByMethodDistribution()
  const entries = Object.entries(dist).map(([method, fees]) => ({ method, fees }))
  const totalFees = entries.reduce((s, e) => s + e.fees, 0)
  return entries
    .map(e => ({ ...e, percent: totalFees > 0 ? (e.fees / totalFees) * 100 : 0 }))
    .sort((a, b) => b.fees - a.fees)
    .slice(0, n)
}

const getFeesByMethodPieChart = () => {
  const dist = getFeesByMethodDistribution()
  const entries = Object.entries(dist).map(([method, fees]) => ({ method, fees }))
  if (entries.length === 0) return 'conic-gradient(#E5E7EB 0deg 360deg)'
  const total = entries.reduce((s, e) => s + e.fees, 0)
  let currentAngle = 0
  const stops = entries
    .map(e => ({ ...e, percent: total > 0 ? (e.fees / total) * 100 : 0 }))
    .sort((a, b) => b.fees - a.fees)
    .map(e => {
      const color = getPaymentMethodColor(e.method)
      const degrees = (e.percent / 100) * 360
      const stop = `${color} ${currentAngle}deg ${currentAngle + degrees}deg`
      currentAngle += degrees
      return stop
    })
  return `conic-gradient(${stops.join(', ')})`
}

// Net revenue by payment method (distribution)
const getNetRevenueByMethodDistribution = () => {
  if (props.profitabilityData?.distributions?.netRevenueByMethod) {
    return props.profitabilityData.distributions.netRevenueByMethod
  }
  return {}
}

const getTopNetRevenueByMethod = (n = 3) => {
  const dist = getNetRevenueByMethodDistribution()
  const entries = Object.entries(dist).map(([method, netRevenue]) => ({ method, netRevenue }))
  const totalNet = entries.reduce((s, e) => s + e.netRevenue, 0)
  return entries
    .map(e => ({ ...e, percent: totalNet > 0 ? (e.netRevenue / totalNet) * 100 : 0 }))
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .slice(0, n)
}

const getNetRevenueByMethodPieChart = () => {
  const dist = getNetRevenueByMethodDistribution()
  const entries = Object.entries(dist).map(([method, netRevenue]) => ({ method, netRevenue }))
  if (entries.length === 0) return 'conic-gradient(#E5E7EB 0deg 360deg)'
  const total = entries.reduce((s, e) => s + e.netRevenue, 0)
  let currentAngle = 0
  const stops = entries
    .map(e => ({ ...e, percent: total > 0 ? (e.netRevenue / total) * 100 : 0 }))
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .map(e => {
      const color = getPaymentMethodColor(e.method)
      const degrees = (e.percent / 100) * 360
      const stop = `${color} ${currentAngle}deg ${currentAngle + degrees}deg`
      currentAngle += degrees
      return stop
    })
  return `conic-gradient(${stops.join(', ')})`
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

// Generate pie chart for accounts using conic-gradient
const getAccountsPieChart = () => {
  const accounts = getAccountTotalsForChart()
  if (!accounts || !accounts.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  let currentAngle = 0
  const gradientStops = []

  accounts.forEach((account, index) => {
    const color = getAccountColor(account.accountKey)
    const percentage = account.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
}

// Get orders distribution for chart
const getOrdersDistributionForChart = () => {
  if (!props.ordersData || !props.ordersData.accounts || props.ordersData.accounts.length === 0) {
    return []
  }

  const ordersDistribution = props.ordersData.accounts.map(account => {
    return {
      accountKey: account.accountKey,
      account: account.account,
      totalOrders: account.orders || 0,
      percent: 0 // Will be calculated below
    }
  })

  // Calculate total orders across all accounts for the chart
  const totalOrdersAcrossAllAccounts = ordersDistribution.reduce((sum, account) => sum + account.totalOrders, 0)

  return ordersDistribution.map(account => ({
    ...account,
    percent: totalOrdersAcrossAllAccounts > 0 ? (account.totalOrders / totalOrdersAcrossAllAccounts) * 100 : 0
  })).sort((a, b) => b.totalOrders - a.totalOrders) // Sort by total orders descending
}

// Generate pie chart for orders distribution using conic-gradient
const getOrdersPieChart = () => {
  const ordersDistribution = getOrdersDistributionForChart()
  if (!ordersDistribution || !ordersDistribution.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  let currentAngle = 0
  const gradientStops = []

  ordersDistribution.forEach((account, index) => {
    const color = getAccountColor(account.accountKey)
    const percentage = account.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
}


</script> 

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style> 