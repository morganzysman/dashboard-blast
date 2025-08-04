<template>
  <div class="space-y-4" v-if="analyticsData && analyticsData.accounts.length > 0">
    <h3 class="text-base sm:text-lg font-medium text-gray-900">🏪 Account Details</h3>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="account in analyticsData.accounts" :key="account.accountKey" class="card">
        <div class="card-body">
          <!-- Account Header -->
          <div class="flex items-center gap-2 mb-4">
            <span class="badge" :class="account.success ? 'badge-success' : 'badge-danger'">
              {{ account.success ? 'Active' : 'Error' }}
            </span>
            <h4 class="font-medium text-gray-900 text-sm sm:text-base truncate">
              {{ account.account }}
            </h4>
          </div>

          <!-- Account Indicators -->
          <div class="mb-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div class="bg-indigo-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-indigo-600 truncate">{{ formatCurrency(getAccountAvgTicket(account)) }}</p>
                <p class="text-xs text-indigo-500">Avg Ticket</p>
              </div>

              <div class="bg-amber-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-amber-600 truncate">{{ formatCurrency(getAccountTotalTips(account)) }}</p>
                <p class="text-xs text-amber-500">Tips</p>
              </div>

              <div class="bg-emerald-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-emerald-600 truncate">{{ formatKitchenPerformance(getAccountKitchenPerformance(account)) }}</p>
                <p class="text-xs text-emerald-500">Kitchen Perf.</p>
              </div>

              <!-- Daily Gain KPI -->
              <div class="bg-purple-50 rounded-lg p-3 text-center relative group cursor-help">
                <p class="text-sm sm:text-lg font-bold truncate" :class="getDailyGainClass(account)">{{ formatCurrency(getAccountDailyGain(account)) }}</p>
                <p class="text-xs text-purple-500">{{ formatGainPeriodLabel() }} Gain</p>
                
                <!-- Detailed Tooltip -->
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 bg-gray-900 text-white text-xs rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  
                  <h4 class="font-bold text-purple-300 mb-2">💰 Gain Breakdown ({{ formatGainPeriodLabel() }})</h4>
                  
                  <div v-if="account.success && account.data?.data" class="space-y-2">
                    <!-- Revenue by Payment Method -->
                    <div>
                      <h5 class="font-semibold text-blue-300 mb-1">📊 Revenue by Payment Method:</h5>
                      <div v-for="method in getAccountGainBreakdown(account).paymentMethodBreakdown" :key="method.method" class="flex justify-between text-xs">
                        <span class="capitalize">{{ method.method }}:</span>
                        <span>{{ formatCurrency(method.revenue) }} - {{ formatCurrency(method.fees) }} = <span class="text-green-300">{{ formatCurrency(method.netRevenue) }}</span></span>
                      </div>
                    </div>
                    
                    <!-- Cost Breakdown -->
                    <div class="border-t border-gray-700 pt-2">
                      <h5 class="font-semibold text-red-300 mb-1">📉 Costs:</h5>
                      <div class="space-y-1 text-xs">
                        <div class="flex justify-between">
                          <span>Payment Fees:</span>
                          <span class="text-red-300">-{{ formatCurrency(getAccountGainBreakdown(account).paymentFees) }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span>Food Costs (30%):</span>
                          <span class="text-red-300">-{{ formatCurrency(getAccountGainBreakdown(account).foodCosts) }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span>Utility Costs ({{ getAccountGainBreakdown(account).daysInPeriod }} days):</span>
                          <span class="text-red-300">-{{ formatCurrency(getAccountGainBreakdown(account).utilityCosts) }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Final Result -->
                    <div class="border-t border-gray-700 pt-2">
                      <div class="flex justify-between font-bold">
                        <span>Final Gain:</span>
                        <span :class="getAccountDailyGain(account) > 0 ? 'text-green-300' : 'text-red-300'">
                          {{ formatCurrency(getAccountGainBreakdown(account).finalGain) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="text-gray-400 text-center">
                    No payment data available
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="account.success && account.data" class="space-y-3">
          
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

                      <!-- Account Service Metrics -->
                      <div v-if="account.serviceMetrics" class="bg-white border border-gray-100 rounded-lg p-3 mt-3">
              <div class="flex items-center justify-between mb-2">
                <h5 class="text-xs font-medium text-gray-700 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Service Metrics
                </h5>
                <button 
                  @click="toggleServiceMetricsCollapse(account.accountKey)" 
                  class="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg 
                    class="w-3 h-3 transition-transform" 
                    :class="{ 'rotate-180': !isServiceMetricsCollapsed(account.accountKey) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                  <span>{{ isServiceMetricsCollapsed(account.accountKey) ? 'Show Details' : 'Hide Details' }}</span>
                </button>
              </div>
              <div v-show="!isServiceMetricsCollapsed(account.accountKey)" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="type in ['TABLE','ONSITE','TAKEAWAY','DELIVERY']" :key="type" class="bg-gray-50 rounded p-2">
                  <div class="flex items-center space-x-2 mb-1">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getServiceColor(type) }"></div>
                    <p class="font-medium text-gray-900 text-xs">{{ type }}</p>
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>Orders</span>
                      <div class="text-right">
                        <span class="font-bold text-gray-900">{{ account.serviceMetrics[type]?.orders?.current_period ?? 0 }}</span>
                        <span class="text-gray-400 ml-1">({{ getAccountServiceOrderPercentage(account, type) }}%)</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>Sales</span>
                      <span class="font-bold text-gray-900">{{ formatCurrency(account.serviceMetrics[type]?.sales?.current_period ?? 0) }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>Avg. Ticket</span>
                      <span class="font-bold text-gray-900">{{ formatCurrency(account.serviceMetrics[type]?.average_ticket?.current_period ?? 0) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Service Metrics Not Available Message -->
            <div v-else-if="account.success && account.data" class="bg-white border border-gray-100 rounded-lg p-3 mt-3">
              <div class="flex items-center justify-between mb-2">
                <h5 class="text-xs font-medium text-gray-700 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Service Metrics
                </h5>
              </div>
              <div class="text-center py-4">
                <p class="text-xs sm:text-sm text-gray-500">Service metrics are only available for predefined periods (Today, Yesterday, etc.)</p>
                <p class="text-xs sm:text-sm text-gray-400 mt-1">Switch to a predefined date range to view detailed service metrics</p>
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
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const props = defineProps({
  analyticsData: Object,
  ordersData: Object,
  currentDateRange: Object,
  selectedDateRange: String
})

const authStore = useAuthStore()
const collapsedServiceMetrics = ref(new Set())
const utilityCosts = ref(new Map()) // Map of company_token -> utility cost data
const paymentMethodCosts = ref(new Map()) // Map of company_token -> payment method costs

const paymentMethodColors = {
  'cash': '#10B981',
  'card': '#3B82F6', 
  'bitcoin': '#F59E0B',
  'yape': '#8B5CF6',
  'plin': '#06B6D4',
  'transfer': '#EF4444'
}

// Fetch utility costs and payment method costs for all accounts
const fetchUtilityCosts = async () => {
  if (!props.analyticsData || !props.analyticsData.accounts) return
  
  for (const account of props.analyticsData.accounts) {
    if (account.success && account.accountKey) {
      try {
        // Fetch utility costs
        const utilityCostsData = await api.getUtilityCosts(account.accountKey)
        if (utilityCostsData.success && utilityCostsData.data) {
          utilityCosts.value.set(account.accountKey, utilityCostsData.data)
        }
        
        // Fetch payment method costs
        const paymentCostsData = await api.getPaymentMethodCosts(account.accountKey)
        if (paymentCostsData.success && paymentCostsData.data) {
          // Convert array to map for easy lookup
          const costsMap = new Map()
          paymentCostsData.data.forEach(cost => {
            costsMap.set(cost.payment_method_code, cost)
          })
          paymentMethodCosts.value.set(account.accountKey, costsMap)
        }
      } catch (err) {
        console.warn(`Failed to fetch costs for ${account.accountKey}:`, err)
      }
    }
  }
}

// Calculate realistic gain: considers payment fees, food costs, utility costs, and date range
const getAccountDailyGain = (account) => {
  if (!account.success || !account.data?.data) return 0
  
  // Calculate number of days in the selected period
  const daysInPeriod = calculateDaysInPeriod()
  
  // Get payment method costs for this account
  const accountPaymentCosts = paymentMethodCosts.value.get(account.accountKey) || new Map()
  
  // Calculate revenue after payment processing fees
  let totalRevenueAfterFees = 0
  
  for (const paymentMethod of account.data.data) {
    const methodName = paymentMethod.name?.toLowerCase() || 'other'
    const revenue = paymentMethod.sum || 0
    const transactionCount = paymentMethod.count || 0
    
    // Get cost configuration for this payment method
    const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
    
    // Calculate fees: (revenue * percentage) + (transaction_count * fixed_cost)
    const percentageFee = revenue * (costConfig.cost_percentage / 100)
    const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
    const totalFees = percentageFee + fixedFee
    
    // Revenue after payment processing fees
    totalRevenueAfterFees += (revenue - totalFees)
  }
  
  // Subtract food costs (30% of original revenue)
  const totalRevenue = account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  const foodCosts = totalRevenue * 0.3
  const revenueAfterFoodCosts = totalRevenueAfterFees - foodCosts
  
  // Get utility costs for this account
  const utilityCost = utilityCosts.value.get(account.accountKey)
  const dailyUtilityCost = utilityCost ? (utilityCost.total_daily || 0) : 0
  const totalUtilityCosts = dailyUtilityCost * daysInPeriod
  
  // Final gain = revenue after fees and food costs - utility costs
  const totalGain = revenueAfterFoodCosts - totalUtilityCosts
  
  return totalGain
}

// Calculate number of days in the current date range
const calculateDaysInPeriod = () => {
  if (!props.currentDateRange || !props.currentDateRange.start || !props.currentDateRange.end) {
    return 1 // Default to 1 day if no date range
  }
  
  const startDate = new Date(props.currentDateRange.start)
  const endDate = new Date(props.currentDateRange.end)
  const timeDiff = endDate.getTime() - startDate.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // +1 to include both start and end dates
  
  return Math.max(1, daysDiff) // At least 1 day
}

// Format gain period label based on selected date range and number of days
const formatGainPeriodLabel = () => {
  const daysInPeriod = calculateDaysInPeriod()
  
  if (props.selectedDateRange === 'today') {
    return 'Daily'
  } else if (daysInPeriod === 1) {
    return 'Daily'
  } else if (daysInPeriod <= 7) {
    return `${daysInPeriod}-Day`
  } else if (daysInPeriod <= 31) {
    return `${daysInPeriod}-Day`
  } else {
    return 'Period'
  }
}

// Get detailed gain breakdown for tooltip
const getAccountGainBreakdown = (account) => {
  if (!account.success || !account.data?.data) {
    return {
      totalRevenue: 0,
      paymentFees: 0,
      foodCosts: 0,
      utilityCosts: 0,
      finalGain: 0,
      daysInPeriod: 1,
      paymentMethodBreakdown: []
    }
  }
  
  const daysInPeriod = calculateDaysInPeriod()
  const accountPaymentCosts = paymentMethodCosts.value.get(account.accountKey) || new Map()
  
  let totalRevenue = 0
  let totalPaymentFees = 0
  const paymentMethodBreakdown = []
  
  // Calculate breakdown by payment method
  for (const paymentMethod of account.data.data) {
    const methodName = paymentMethod.name?.toLowerCase() || 'other'
    const revenue = paymentMethod.sum || 0
    const transactionCount = paymentMethod.count || 0
    
    const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
    
    const percentageFee = revenue * (costConfig.cost_percentage / 100)
    const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
    const totalFees = percentageFee + fixedFee
    const netRevenue = revenue - totalFees
    
    totalRevenue += revenue
    totalPaymentFees += totalFees
    
    paymentMethodBreakdown.push({
      method: methodName,
      revenue,
      fees: totalFees,
      netRevenue,
      transactionCount,
      costConfig
    })
  }
  
  const foodCosts = totalRevenue * 0.3
  const utilityCost = utilityCosts.value.get(account.accountKey)
  const dailyUtilityCost = utilityCost ? (utilityCost.total_daily || 0) : 0
  const totalUtilityCosts = dailyUtilityCost * daysInPeriod
  
  const finalGain = (totalRevenue - totalPaymentFees - foodCosts - totalUtilityCosts)
  
  return {
    totalRevenue,
    paymentFees: totalPaymentFees,
    foodCosts,
    utilityCosts: totalUtilityCosts,
    finalGain,
    daysInPeriod,
    paymentMethodBreakdown
  }
}

// Get CSS class for daily gain (green for positive, red for negative)
const getDailyGainClass = (account) => {
  const gain = getAccountDailyGain(account)
  if (gain > 0) return 'text-green-600'
  if (gain < 0) return 'text-red-600'
  return 'text-gray-600'
}

const formatCurrency = (amount) => {
  const currencySymbol = authStore.user?.currencySymbol || 'S/'
  const num = Number(amount) || 0
  return `${currencySymbol} ${num.toFixed(2)}`
}

const getPaymentMethodColor = (methodName) => {
  return paymentMethodColors[methodName.toLowerCase()] || '#6B7280'
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



const getAccountTotalAmount = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
}

const getAccountTotalTips = (account) => {
  if (!account.success || !account.tipsData?.success || !account.tipsData.data?.data) return 0
  return account.tipsData.data.data.reduce((sum, tip) => sum + (tip.sum || 0), 0)
}

const getAccountKitchenPerformance = (account) => {
  if (!account.success) return { averagePreparationTime: 0, ordersWithPrepTime: 0 }
  
  // Get kitchen performance data from orders data
  if (props.ordersData && props.ordersData.accounts) {
    const accountData = props.ordersData.accounts.find(acc => acc.accountKey === account.accountKey)
    if (accountData && accountData.kitchenPerformance) {
      return accountData.kitchenPerformance
    }
  }
  
  return { averagePreparationTime: 0, ordersWithPrepTime: 0 }
}

const formatKitchenPerformance = (performanceData) => {
  if (!performanceData || performanceData.averagePreparationTime === 0) {
    return 'N/A'
  }
  
  const avgMinutes = performanceData.averagePreparationTime
  
  if (avgMinutes < 60) {
    return `${Math.round(avgMinutes)}m`
  } else {
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.round(avgMinutes % 60)
    return `${hours}h ${minutes}m`
  }
}

const getAccountTotalOrders = (account) => {
  if (!account.success) return 0
  
  // Use the new simplified orders data structure
  if (props.ordersData && props.ordersData.accounts) {
    const accountData = props.ordersData.accounts.find(acc => acc.accountKey === account.accountKey)
    if (accountData) {
      return accountData.orders || 0
    }
  }
  
  return 0
}

const getAccountAvgTicket = (account) => {
  if (!account.success || !account.data?.data) return 0
  const totalAmount = account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  const totalOrders = account.data.data.reduce((sum, method) => sum + (method.count || 0), 0)
  return totalOrders > 0 ? totalAmount / totalOrders : 0
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

const getAccountServiceOrderPercentage = (account, serviceType) => {
  if (!account.serviceMetrics || !account.serviceMetrics[serviceType]) {
    return 0
  }

  // Calculate total orders for this account across all services
  const accountTotalOrders = ['TABLE', 'ONSITE', 'TAKEAWAY', 'DELIVERY'].reduce((total, type) => {
    return total + (account.serviceMetrics[type]?.orders?.current_period ?? 0)
  }, 0)

  const serviceOrders = account.serviceMetrics[serviceType]?.orders?.current_period ?? 0
  
  return accountTotalOrders > 0 ? ((serviceOrders / accountTotalOrders) * 100).toFixed(1) : '0.0'
}



const isServiceMetricsCollapsed = (accountKey) => {
  return collapsedServiceMetrics.value.has(accountKey)
}

const toggleServiceMetricsCollapse = (accountKey) => {
  if (collapsedServiceMetrics.value.has(accountKey)) {
    collapsedServiceMetrics.value.delete(accountKey)
  } else {
    collapsedServiceMetrics.value.add(accountKey)
  }
}

// Fetch utility costs when component mounts or analytics data changes
onMounted(() => {
  fetchUtilityCosts()
})

// Watch for analytics data changes and refetch utility costs
watch(
  () => props.analyticsData?.accounts?.map(acc => acc.accountKey).join(','),
  (newAccountKeys) => {
    if (newAccountKeys) {
      fetchUtilityCosts()
    }
  }
)


</script>

<style scoped>
.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-danger {
  @apply bg-red-100 text-red-800;
}
</style>
