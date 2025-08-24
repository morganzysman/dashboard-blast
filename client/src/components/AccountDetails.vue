<template>
  <div class="space-y-4">
    <h3 class="text-base sm:text-lg font-medium text-gray-900">🏪 {{ $t('dashboard.accountDetails') }}</h3>

    <!-- Loading skeletons -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="n in 4" :key="`skeleton-${n}`" class="card">
        <div class="card-body">
          <div class="flex items-center gap-2 mb-4 animate-pulse">
            <div class="h-5 w-14 bg-gray-200 rounded-full"></div>
            <div class="h-4 w-40 bg-gray-200 rounded"></div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Accounts content -->
    <div v-else-if="analyticsData && analyticsData.accounts.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="account in analyticsData.accounts" :key="`${account.accountKey}-${forceRecompute}`" class="card">
        <div class="card-body">
          <!-- Account Header -->
          <div class="flex items-center gap-2 mb-4">
            <span class="badge" :class="account.success ? 'badge-success' : 'badge-danger'">
              {{ account.success ? $t('common.active') : $t('common.error') }}
            </span>
            <div class="relative group">
              <h4 class="font-medium text-gray-900 text-sm sm:text-base truncate cursor-pointer" :title="account.account">
                {{ account.account }}
              </h4>
              <!-- Custom tooltip -->
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 invisible group-hover:visible">
                {{ account.account }}
              </div>
            </div>
          </div>

          <!-- Account Indicators -->
          <div class="mb-4">
            <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div class="bg-indigo-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-indigo-600 truncate">{{ formatCurrency(getAccountAvgTicket(account)) }}</p>
                <p class="text-xs text-indigo-500">{{ $t('dashboard.avgTicket') }}</p>
              </div>

              <div class="bg-amber-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-amber-600 truncate">{{ formatCurrency(getAccountTotalTips(account)) }}</p>
                <p class="text-xs text-amber-500">{{ $t('dashboard.tips') }}</p>
              </div>

              <div class="bg-emerald-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-emerald-600 truncate">{{ formatKitchenPerformance(getAccountKitchenPerformance(account)) }}</p>
                <p class="text-xs text-emerald-500">Kitchen Perf.</p>
              </div>

              <!-- Daily Gain KPI -->
              <div class="bg-purple-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold truncate" :class="getDailyGainClass(account)">
                  {{ formatCurrency(accountDailyGains.get(account.accountKey) || 0) }}
                </p>
                <p class="text-xs text-purple-500">{{ formatGainPeriodLabel() }} Gain</p>

                <!-- Popover for details -->
                <Popover class="mt-2 inline-block" :panel-class="'left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0'" :key="`breakdown-${account.accountKey}-${forceRecompute}`">
                  <template #button>
                    <span class="text-xs text-purple-600 hover:text-purple-800 underline">{{ $t('dashboard.viewBreakdown') }}</span>
                  </template>
                  <template #title>
                    <h4 class="font-bold text-purple-300 text-sm">💰 Gain Breakdown ({{ formatGainPeriodLabel() }})</h4>
                  </template>
                  <div v-if="account.success && account.data?.data" class="space-y-4">
                    <!-- Revenue by Payment Method -->
                    <div>
                      <h5 class="font-semibold text-blue-300 mb-3 text-sm">📊 Revenue by Payment Method:</h5>
                      <div v-for="method in accountBreakdowns.get(account.accountKey)?.paymentMethodBreakdown || []" :key="method.method" class="mb-2">
                        <div class="flex justify-between items-center mb-1">
                          <span class="capitalize text-sm font-medium">{{ method.method }}:</span>
                          <span class="text-green-300 font-bold">{{ formatCurrency(method.netRevenue) }}</span>
                        </div>
                        <div class="text-xs text-gray-400 text-right">
                          {{ formatCurrency(method.revenue) }} 
                          <span v-if="method.fees > 0">- {{ formatCurrency(method.fees) }} fees</span>
                        </div>
                      </div>
                      <!-- Total Revenue -->
                      <div class="border-t border-blue-700 pt-2 mt-3">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-bold text-blue-300">Total Revenue:</span>
                          <span class="text-blue-300 font-bold">{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.totalRevenue || 0) }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Cost Breakdown -->
                    <div class="border-t border-gray-700 pt-3">
                      <h5 class="font-semibold text-red-300 mb-3 text-sm">📉 Costs:</h5>
                      <div class="space-y-2">
                        <div class="flex justify-between items-center">
                          <span class="text-sm">Payment Fees:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.paymentFees || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">Food Costs (30%):</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.foodCosts || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">Utility Costs ({{ accountBreakdowns.get(account.accountKey)?.daysInPeriod || 1 }} days):</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.utilityCosts || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">Payroll ({{ accountBreakdowns.get(account.accountKey)?.payrollEntries || 0 }} entries):</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.payrollCosts || 0) }}</span>
                        </div>
                      </div>
                      <!-- Total Costs -->
                      <div class="border-t border-red-700 pt-2 mt-3">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-bold text-red-300">Total Costs:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.totalCosts || 0) }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Final Result -->
                    <div class="border-t-2 border-gray-600 pt-3 mt-3">
                      <div class="flex justify-between items-center">
                        <span class="text-lg font-bold">Final Gain:</span>
                        <span class="text-lg font-bold" :class="(accountDailyGains.get(account.accountKey) || 0) > 0 ? 'text-green-300' : 'text-red-300'">
                          {{ formatCurrency(accountBreakdowns.get(account.accountKey)?.finalGain || 0) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="text-gray-400 text-center">
                    No payment data available
                  </div>
                </Popover>
              </div>
            </div>
          </div>

          <!-- Additional Profitability Chips (none currently) -->
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
                  <span>{{ isServiceMetricsCollapsed(account.accountKey) ? $t('common.showDetails') : $t('common.hideDetails') }}</span>
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
                      <span>{{ $t('dashboard.totalOrders') }}</span>
                      <div class="text-right">
                        <span class="font-bold text-gray-900">{{ account.serviceMetrics[type]?.orders?.current_period ?? 0 }}</span>
                        <span class="text-gray-400 ml-1">({{ getAccountServiceOrderPercentage(account, type) }}%)</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ $t('rentability.revenue') }}</span>
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
                <p class="text-xs sm:text-sm text-gray-400 mt-1">{{ $t('dashboard.switchDateRangeMessage') }}</p>
              </div>
            </div>

          </div>

          <div v-else class="text-center py-4">
            <p class="text-xs sm:text-sm text-gray-500">{{ account.error || $t('common.unableToFetchData') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card">
      <div class="card-body text-center text-sm text-gray-600">No account data for this period.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { calculateDaysInPeriod as calcDays } from '../composables/useProfitability'
import Popover from './ui/Popover.vue'

const props = defineProps({
  analyticsData: Object,
  ordersData: Object,
  profitabilityData: Object,
  currentDateRange: Object,
  selectedDateRange: String,
  loading: Boolean
})

const authStore = useAuthStore()
const collapsedServiceMetrics = ref(new Set())

// Force re-computation trigger
const forceRecompute = ref(0)

const paymentMethodColors = {
  'cash': '#10B981',
  'card': '#3B82F6', 
  'bitcoin': '#F59E0B',
  'yape': '#8B5CF6',
  'plin': '#06B6D4',
  'transfer': '#EF4444'
}

// Server provides profitability; no client-side cost fetching required

// Helper to get server profitability data for this account
const getServerAccount = (account) => {
  return props.profitabilityData?.accounts?.find(a => a.accountKey === account.accountKey)
}

// Daily/period gain from server - CONVERTED TO COMPUTED PROPERTY
const getAccountDailyGain = (account) => {
  // Access the trigger to ensure reactivity
  const trigger = forceRecompute.value
  // Use the reactive computed property for consistency
  const breakdown = accountBreakdowns.value.get(account.accountKey)
  
  console.log(`💰 getAccountDailyGain for ${account.accountKey}:`, {
    finalGain: breakdown?.finalGain || 0,
    forceRecomputeTrigger: trigger
  })
  
  return breakdown?.finalGain || 0
}

// Create reactive computed properties for each account's daily gain
const accountDailyGains = computed(() => {
  const gains = new Map()
  
  if (!props.analyticsData?.accounts) return gains
  
  props.analyticsData.accounts.forEach(account => {
    gains.set(account.accountKey, getAccountDailyGain(account))
  })
  
  return gains
})

// Calculate number of days in the current date range
const calculateDaysInPeriod = () => calcDays(props.currentDateRange)

// Format gain period label based on selected date range and number of days
const formatGainPeriodLabel = () => {
  const daysInPeriod = calcDays(props.currentDateRange)
  
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

// Watch for profitability data changes and force re-computation
watch(
  [() => props.profitabilityData, () => props.currentDateRange],
  (newValues, oldValues) => {
    const [newProfitabilityData, newDateRange] = newValues
    const [oldProfitabilityData, oldDateRange] = oldValues
    
    console.log('👀 Profitability data watcher triggered:', {
      profitabilityChanged: newProfitabilityData !== oldProfitabilityData,
      dateRangeChanged: newDateRange !== oldDateRange,
      newPeriod: newProfitabilityData?.period,
      oldPeriod: oldProfitabilityData?.period,
      newTimestamp: newProfitabilityData?.timestamp,
      oldTimestamp: oldProfitabilityData?.timestamp
    })
    
    // Force recomputation
    forceRecompute.value++
  },
  { deep: true, immediate: false }
)

// Ensure reactivity on analytics/orders/selected range changes as well
watch(
  [() => props.analyticsData, () => props.ordersData, () => props.selectedDateRange, () => props.currentDateRange],
  (newValues, oldValues) => {
    const [newAnalytics, newOrders, newSelectedRange, newCurrentRange] = newValues
    const [oldAnalytics, oldOrders, oldSelectedRange, oldCurrentRange] = oldValues
    console.log('👀 Analytics/Orders/Range watcher triggered:', {
      analyticsChanged: newAnalytics !== oldAnalytics,
      ordersChanged: newOrders !== oldOrders,
      selectedRangeChanged: newSelectedRange !== oldSelectedRange,
      currentRangeChanged: newCurrentRange !== oldCurrentRange
    })
    forceRecompute.value++
  },
  { deep: true, immediate: false }
)

// Create a reactive computed property for account gain breakdowns
const accountGainBreakdowns = computed(() => {
  const map = new Map()
  
  if (!props.analyticsData?.accounts) return map
  
  // Explicitly access all reactive props to ensure reactivity
  const profitabilityData = props.profitabilityData
  const currentDateRange = props.currentDateRange
  const analyticsData = props.analyticsData
  const trigger = forceRecompute.value // Access the trigger to force reactivity

  // Use server profitability only when its period matches the current date range
  const pdStart = profitabilityData?.period?.start
  const pdEnd = profitabilityData?.period?.end
  const curStart = currentDateRange?.start
  const curEnd = currentDateRange?.end
  const profitabilityInSync = !!(pdStart && pdEnd && curStart && curEnd && pdStart === curStart && pdEnd === curEnd)
  
  // Debug log to track profitability data changes
  console.log('🔄 AccountDetails: Computing gain breakdowns', {
    profitabilityDataPeriod: profitabilityData?.period,
    profitabilityInSync,
    currentDateRange: currentDateRange,
    profitabilityAccounts: profitabilityData?.accounts?.length || 0,
    profitabilityTimestamp: profitabilityData?.timestamp,
    analyticsTimestamp: analyticsData.timestamp,
    forceRecomputeTrigger: trigger
  })
  
  analyticsData.accounts.forEach(account => {
    
    const serverAcc = profitabilityData?.accounts?.find(a => a.accountKey === account.accountKey)
    
    // Calculate client-side revenue first for comparison
    let clientSideRevenue = 0
    let clientSidePaymentMethods = []
    if (account.success && account.data?.data) {
      // Get payment method costs from profitability data if available
      const serverPaymentCosts = new Map()
      if (serverAcc?.paymentMethodBreakdown) {
        serverAcc.paymentMethodBreakdown.forEach(pm => {
          serverPaymentCosts.set(pm.method, pm.costConfig || { cost_percentage: 0, fixed_cost: 0 })
        })
      }
      
      clientSidePaymentMethods = (account.data.data || []).map(pm => {
        const methodName = pm.name?.toLowerCase() || 'other'
        const revenue = pm.sum || 0
        const transactionCount = pm.count || 0
        const costConfig = serverPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
        const percentageFee = revenue * (costConfig.cost_percentage / 100)
        const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
        const fees = percentageFee + fixedFee
        
        return {
          method: methodName,
          revenue,
          fees,
          netRevenue: revenue - fees,
          transactionCount,
          costConfig
        }
      })
      clientSideRevenue = clientSidePaymentMethods.reduce((s, m) => s + (m.revenue || 0), 0)
    }
    
    if (serverAcc) {
      // Prefer hybrid: current-period revenue with server-side costs when we have revenue
      if (clientSideRevenue > 0) {
        // Derive utility costs for the selected period using server per-period or per-day if mismatched
        const currentDays = calcDays(currentDateRange) || 1
        const serverDays = serverAcc?.daysInPeriod || currentDays
        const serverUtilTotal = serverAcc?.utilityCosts || 0
        const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
        const utilityCostsForPeriod = utilityPerDay * currentDays
        // Derive payroll entries scaled to period
        const serverEntries = serverAcc?.payrollEntries || 0
        const entriesPerDay = serverDays > 0 ? (serverEntries / serverDays) : serverEntries
        const payrollEntriesForPeriod = Math.round(entriesPerDay * currentDays)
        // Use hybrid approach: client-side revenue with server-side costs
        // Calculate payment fees from client-side payment methods
        const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
        const netRevenue = clientSideRevenue - paymentFees
        const foodCosts = netRevenue * 0.3
        const totalCosts = paymentFees + foodCosts + utilityCostsForPeriod + (serverAcc.payrollCosts || 0)
        
        console.log(`🔄 Using hybrid data for ${account.accountKey}:`, {
          clientSideRevenue,
          paymentFees,
          serverPayrollCosts: serverAcc.payrollCosts,
          serverUtilityCosts: serverAcc.utilityCosts,
          calculatedFoodCosts: foodCosts,
          clientSidePaymentMethods
        })
        
        map.set(account.accountKey, {
          totalRevenue: clientSideRevenue,
          totalCosts,
          paymentFees,
          foodCosts,
          utilityCosts: utilityCostsForPeriod,
          payrollCosts: serverAcc.payrollCosts || 0,
          payrollEntries: payrollEntriesForPeriod,
          finalGain: clientSideRevenue - totalCosts,
          daysInPeriod: calcDays(currentDateRange) || 1,
          paymentMethodBreakdown: clientSidePaymentMethods
        })
        return
      }

      // Fallback to server-only figures when no client-side revenue is available
      console.log(`💰 Using server-only profitability for ${account.accountKey}:`, {
        operatingProfit: serverAcc.operatingProfit,
        grossSales: serverAcc.grossSales,
        paymentFees: serverAcc.paymentFees,
        payrollCosts: serverAcc.payrollCosts,
        payrollEntries: serverAcc.payrollEntries,
        utilityCosts: serverAcc.utilityCosts
      })
      const currentDays = calcDays(currentDateRange) || 1
      const serverDays = serverAcc?.daysInPeriod || currentDays
      const serverUtilTotal = serverAcc?.utilityCosts || 0
      const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
      const utilityCostsForPeriod = utilityPerDay * currentDays
      // Scale entries to selected days
      const serverEntries = serverAcc?.payrollEntries || 0
      const entriesPerDay = serverDays > 0 ? (serverEntries / serverDays) : serverEntries
      const payrollEntriesForPeriod = Math.round(entriesPerDay * currentDays)
      map.set(account.accountKey, {
        totalRevenue: serverAcc.grossSales || 0,
        totalCosts: (serverAcc.paymentFees || 0) + (serverAcc.foodCosts || 0) + utilityCostsForPeriod + (serverAcc.payrollCosts || 0),
        paymentFees: serverAcc.paymentFees || 0,
        foodCosts: serverAcc.foodCosts || 0,
        utilityCosts: utilityCostsForPeriod,
        payrollCosts: serverAcc.payrollCosts || 0,
        payrollEntries: payrollEntriesForPeriod,
        finalGain: (serverAcc.grossSales || 0) - ((serverAcc.paymentFees || 0) + (serverAcc.foodCosts || 0) + utilityCostsForPeriod + (serverAcc.payrollCosts || 0)),
        daysInPeriod: calcDays(currentDateRange) || 1,
        paymentMethodBreakdown: serverAcc.paymentMethodBreakdown || []
      })
      return
    }

    
    
    if (!account.success || !account.data?.data) {
      map.set(account.accountKey, {
        totalRevenue: 0,
        totalCosts: 0,
        paymentFees: 0,
        foodCosts: 0,
        utilityCosts: 0,
        finalGain: 0,
        daysInPeriod: calcDays(currentDateRange),
        paymentMethodBreakdown: []
      })
      return
    }
    
    // Fallback to pure client-side calculation
    const daysInPeriod = calcDays(currentDateRange)
    const totalRevenue = clientSideRevenue
    const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
    const netRevenue = totalRevenue - paymentFees
    const foodCosts = netRevenue * 0.3
    const utilityCosts = 0
    const totalCosts = paymentFees + foodCosts + utilityCosts
    const finalGain = totalRevenue - totalCosts
    
    console.log(`🎯 Using pure client-side data for ${account.accountKey}:`, {
      totalRevenue,
      paymentFees,
      foodCosts,
      finalGain,
      clientSidePaymentMethods
    })
    
    map.set(account.accountKey, {
      totalRevenue,
      totalCosts,
      paymentFees,
      foodCosts,
      utilityCosts,
      payrollCosts: 0,
      payrollEntries: 0,
      finalGain,
      daysInPeriod,
      paymentMethodBreakdown: clientSidePaymentMethods
    })
  })
  
  return map
})

// Get detailed gain breakdown for tooltip - ENHANCED FOR REACTIVITY
const getAccountGainBreakdown = (account) => {
  // Access the trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  const result = accountGainBreakdowns.value.get(account.accountKey) || {
    totalRevenue: 0,
    totalCosts: 0,
    paymentFees: 0,
    foodCosts: 0,
    utilityCosts: 0,
    payrollCosts: 0,
    payrollEntries: 0,
    finalGain: 0,
    daysInPeriod: 1,
    paymentMethodBreakdown: []
  }
  
  console.log(`🔄 getAccountGainBreakdown for ${account.accountKey}:`, {
    finalGain: result.finalGain,
    totalRevenue: result.totalRevenue,
    totalCosts: result.totalCosts,
    paymentFees: result.paymentFees,
    paymentMethodBreakdown: result.paymentMethodBreakdown,
    forceRecomputeTrigger: trigger
  })
  
  return result
}

// Create reactive computed properties for each account's breakdown to ensure reactivity in popover
const accountBreakdowns = computed(() => {
  const breakdowns = new Map()
  
  if (!props.analyticsData?.accounts) return breakdowns
  
  props.analyticsData.accounts.forEach(account => {
    breakdowns.set(account.accountKey, getAccountGainBreakdown(account))
  })
  
  return breakdowns
})

// Get CSS class for daily gain (green for positive, red for negative)
const getDailyGainClass = (account) => {
  if (isAccountGainDisabled()) return 'text-gray-400'
  const gain = accountDailyGains.value.get(account.accountKey) || 0
  if (gain > 0) return 'text-green-600'
  if (gain < 0) return 'text-red-600'
  return 'text-gray-600'
}

const isAccountGainDisabled = () => {
  // Always enabled; server now includes projected payroll for open entries
  return false
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

// Payment fees from server
const getAccountPaymentFees = (account) => getServerAccount(account)?.paymentFees || 0

// Net sales after fees
const getAccountNetSalesAfterFees = (account) => getServerAccount(account)?.netAfterFees || 0

// Operating margin = operating profit / gross
const getAccountOperatingMargin = (account) => getServerAccount(account)?.operatingMargin || 0

// Profit per order
const getAccountProfitPerOrder = (account) => {
  const acc = getServerAccount(account)
  const orders = acc?.orders ?? 0
  if (orders <= 0) return 0
  return (acc?.operatingProfit || 0) / orders
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

// No watchers required


</script>

<style scoped>
.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-danger {
  @apply bg-red-100 text-red-800;
}
</style>
