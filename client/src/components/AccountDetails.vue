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
  analyticsData: Object,
  ordersData: Object
})

const authStore = useAuthStore()
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
  
  // Use the new simplified orders data structure
  if (props.ordersData && props.ordersData.accounts) {
    const accountData = props.ordersData.accounts.find(acc => acc.accountKey === account.accountKey)
    if (accountData) {
      return accountData.orders || 0
    }
  }
  
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
  // With the simplified orders structure, we don't have service type breakdown
  // Return 0 for now as this feature is not available in the simplified structure
  return '0.0'
}

const getAccountOrdersComparison = (account) => {
  if (!props.ordersData || !props.ordersData.comparison) return null
  
  return {
    trend: props.ordersData.comparison.orders.trend,
    difference: props.ordersData.comparison.orders.difference
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
  if (!props.ordersData || !props.ordersData.comparison) return '0.0'
  
  const percentChange = props.ordersData.comparison.orders.percentChange || 0
  const trend = props.ordersData.comparison.orders.trend || 'down'
  
  const percentageChange = Math.abs(percentChange).toFixed(1)
  return `${trend === 'up' ? '+' : '-'}${percentageChange}`
}

const getAccountAmountPercentageChange = (account) => {
  if (!account.comparison || !account.comparison.amount) return '0.0'
  
  const percentChange = account.comparison.amount.percentChange || 0
  const trend = account.comparison.amount.trend || 'down'
  
  const percentageChange = Math.abs(percentChange).toFixed(1)
  return `${trend === 'up' ? '+' : '-'}${percentageChange}`
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
