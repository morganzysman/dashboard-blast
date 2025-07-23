<template>
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
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
              <div class="bg-blue-50 rounded-lg p-2 sm:p-3">
                <p class="text-sm sm:text-lg font-bold text-blue-600">{{ getAccountTotalOrders(account) }}</p>
                <p class="text-xs text-blue-500">Total Orders</p>
                <div class="flex items-center justify-center mt-1" v-if="getAccountOrdersComparison(account)">
                  <span class="text-xs text-gray-500"> vs last week</span>
                  <span class="text-xs ml-1 font-medium" :class="getAccountOrdersComparison(account).trend === 'up' ? 'text-green-600' : 'text-red-600'">
                    {{ getAccountOrdersComparison(account).trend === 'up' ? '↗' : '↘' }} {{ getAccountOrdersPercentageChange(account) }}%
                  </span>
                </div>
              </div>

              <div class="bg-green-50 rounded-lg p-2 sm:p-3">
                <p class="text-xs sm:text-lg font-bold text-green-600 truncate">{{ formatCurrency(getAccountTotalAmount(account)) }}</p>
                <p class="text-xs text-green-500">Total</p>
                <div class="flex items-center justify-center mt-1" v-if="getAccountAmountComparison(account)">
                  <span class="text-xs text-gray-500"> vs last week</span>
                  <span class="text-xs ml-1 font-medium" :class="getAccountAmountComparison(account).trend === 'up' ? 'text-green-600' : 'text-red-600'">
                    {{ getAccountAmountComparison(account).trend === 'up' ? '↗' : '↘' }} {{ getAccountAmountPercentageChange(account) }}%
                  </span>
                </div>
              </div>

              <div class="bg-purple-50 rounded-lg p-2 sm:p-3">
                <p class="text-sm sm:text-lg font-bold text-purple-600">{{ account.data.data?.length || 0 }}</p>
                <p class="text-xs text-purple-500">Methods</p>
              </div>

              <div class="bg-amber-50 rounded-lg p-2 sm:p-3">
                <p class="text-xs sm:text-lg font-bold text-amber-600 truncate">{{ formatCurrency(getAccountTotalTips(account)) }}</p>
                <p class="text-xs text-amber-500">Tips</p>
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
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  analyticsData: Object
})

const authStore = useAuthStore()
const collapsedServiceMetrics = ref(new Set())

const paymentMethodColors = {
  'cash': '#10B981',
  'card': '#3B82F6', 
  'bitcoin': '#F59E0B',
  'yape': '#8B5CF6',
  'plin': '#06B6D4',
  'transfer': '#EF4444'
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

const getAccountTotalOrders = (account) => {
  if (!account.success) return 0
  
  console.log(`🔍 AccountDetails - Getting total orders for ${account.accountKey}:`);
  console.log(`   Has serviceMetrics: ${!!account.serviceMetrics}`);
  console.log(`   Has payment data: ${!!account.data?.data}`);
  
  // Try to get orders from service metrics first
  if (account.serviceMetrics) {
    const ordersFromServiceMetrics = Object.values(account.serviceMetrics).reduce((sum, service) => sum + (service?.orders?.current_period ?? 0), 0);
    console.log(`   Orders from service metrics: ${ordersFromServiceMetrics}`);
    return ordersFromServiceMetrics;
  }
  
  // Fallback to payment data if service metrics not available
  if (account.data?.data) {
    const ordersFromPayments = account.data.data.reduce((sum, method) => sum + (method.count || 0), 0);
    console.log(`   Orders from payment data: ${ordersFromPayments}`);
    return ordersFromPayments;
  }
  
  console.log(`   No orders data available`);
  return 0
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

const getAccountOrdersComparison = (account) => {
  if (!account.serviceMetrics) return null
  
  // Calculate current period total orders
  const currentOrders = Object.values(account.serviceMetrics).reduce((sum, service) => 
    sum + (service?.orders?.current_period ?? 0), 0)
  
  // Calculate previous period total orders
  const previousOrders = Object.values(account.serviceMetrics).reduce((sum, service) => 
    sum + (service?.orders?.previous_period ?? 0), 0)
  
  if (previousOrders === 0) return null
  
  const difference = currentOrders - previousOrders
  const trend = difference >= 0 ? 'up' : 'down'
  
  return {
    trend,
    difference: Math.abs(difference)
  }
}

const getAccountAmountComparison = (account) => {
  if (!account.comparison) return null
  
  return {
    trend: account.comparison.amount.trend,
    difference: account.comparison.amount.difference
  }
}

const getAccountOrdersPercentageChange = (account) => {
  if (!account.serviceMetrics) return '0.0'
  
  // Calculate current period total orders
  const currentOrders = Object.values(account.serviceMetrics).reduce((sum, service) => 
    sum + (service?.orders?.current_period ?? 0), 0)
  
  // Calculate previous period total orders
  const previousOrders = Object.values(account.serviceMetrics).reduce((sum, service) => 
    sum + (service?.orders?.previous_period ?? 0), 0)
  
  if (previousOrders === 0) return '0.0'
  
  const difference = currentOrders - previousOrders
  const percentageChange = ((Math.abs(difference) / previousOrders) * 100).toFixed(1)
  return `${difference >= 0 ? '+' : '-'}${percentageChange}`
}

const getAccountAmountPercentageChange = (account) => {
  if (!account.comparison || !account.comparison.amount) return '0.0'
  
  const percentChange = account.comparison.amount.percentChange || 0
  const trend = account.comparison.amount.trend || 'down'
  
  const percentageChange = Math.abs(percentChange).toFixed(1)
  return `${trend === 'up' ? '+' : '-'}${percentageChange}`
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
</script>

<style scoped>
.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-danger {
  @apply bg-red-100 text-red-800;
}
</style>
