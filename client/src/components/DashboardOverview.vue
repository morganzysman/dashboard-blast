<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header with Date Picker -->
    <div class="card">
      <div class="card-body">
        <!-- Header and Date Range on same line -->
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
          <div class="min-w-0">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">📊 {{ $t('dashboard.overview') }}</h2>
            <p class="text-xs sm:text-sm text-gray-600">{{ $t('dashboard.realtimeAnalytics') }}</p>
          </div>
          
          <!-- Date Range Picker -->
          <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
            <label class="text-xs sm:text-sm font-medium text-gray-700">📅 {{ $t('common.dateRange') }}:</label>
            <select 
              :value="selectedDateRange" 
              @input="$emit('update:selectedDateRange', $event.target.value)"
              @change="onDateRangeChange" 
              class="form-input w-full sm:w-auto text-xs sm:text-sm"
            >
              <option value="today">{{ $t('common.today') }}</option>
              <option value="yesterday">{{ $t('common.yesterday') }}</option>
              <option value="last7days">{{ $t('dashboard.last7Days') }}</option>
              <option value="last30days">{{ $t('dashboard.last30Days') }}</option>
              <option value="thisweek">{{ $t('common.thisWeek') }}</option>
              <option value="lastweek">{{ $t('common.lastWeek') }}</option>
              <option value="thismonth">{{ $t('common.thisMonth') }}</option>
              <option value="lastmonth">{{ $t('common.lastMonth') }}</option>
              <option value="custom">{{ $t('common.customRange') }}</option>
            </select>
          </div>
          <!-- Close header flex and title container -->
        </div>
       
        <!-- Custom Date Inputs and Actions -->
        <div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <!-- Custom Date Inputs -->

          <!-- Custom Date Inputs -->
          <div v-if="selectedDateRange === 'custom'" class="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-1">
              <label class="text-xs sm:text-sm text-gray-600">{{ $t('common.from') }}:</label>
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
              <label class="text-xs sm:text-sm text-gray-600">{{ $t('common.to') }}:</label>
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
            {{ loading ? $t('common.loading') : $t('common.refresh') }}
          </button>

          <!-- Apply Button (for custom range) -->
          <button 
            v-if="selectedDateRange === 'custom' && customStartDate && customEndDate" 
            @click="applyCustomDateRange" 
            class="btn-primary btn-sm w-full sm:w-auto"
            :disabled="loading"
          >
            {{ $t('dashboard.applyRange') }}
          </button>
          </div>
          <!-- Close card-body and card for header block -->
        </div>
      </div>

    <!-- Overall Performance Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6" v-if="analyticsData">
      <!-- TOTAL ORDERS KPI with embedded chart -->
      <KpiCard :label="`${formatGainPeriodLabel()} ORDERS`" :value="String(totalOrders)" tone="neutral" :key="`total-orders-${forceRecompute}`">
        <template #icon>
          <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
        </template>
        <template #extra>
          <div v-if="analyticsData && analyticsData.accounts.length > 1" class="w-full">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <div class="w-full h-full rounded-full" :style="{ background: getOrdersPieChart }"></div>
                <div class="absolute inset-2 sm:inset-3 bg-blue-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.accounts.length }}</span>
                </div>
              </div>
              <div class="flex-1 space-y-1 text-xs sm:text-sm min-w-0">
                <div v-for="account in getOrdersDistributionForChart" :key="account.accountKey" class="min-w-0">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-1 min-w-0 flex-1">
                      <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getAccountColor(account.accountKey) }"></div>
                      <div class="relative group min-w-0 flex-1">
                        <span class="text-gray-600 dark:text-gray-400 truncate cursor-pointer block" :title="account.account">
                          {{ account.account }}
                        </span>
                        <!-- Custom tooltip -->
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 invisible group-hover:visible">
                          {{ account.account }}
                        </div>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-1">
                      <span class="text-gray-900 dark:text-gray-100 font-semibold">{{ account.totalOrders }}</span>
                      <span class="text-gray-500 ml-1">({{ account.percent.toFixed(0) }}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </KpiCard>
          
          

      <!-- TOTAL AMOUNT KPI with embedded chart --> 
      <KpiCard :label="`${formatGainPeriodLabel()} AMOUNT`" :value="formatCurrency(aggregatedGrossSales)" tone="neutral" :key="`total-amount-${forceRecompute}`">
        <template #icon>
          <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
          </svg>
        </template>
        <template #extra>
          <div v-if="analyticsData && analyticsData.accounts.length > 1" class="w-full">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <div class="w-full h-full rounded-full" :style="{ background: getAccountsPieChart }"></div>
                <div class="absolute inset-2 sm:inset-3 bg-green-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.accounts.length }}</span>
                </div>
              </div>
              <div class="flex-1 space-y-1 text-xs sm:text-sm min-w-0" :key="`chart-content-${forceRecompute}`">
                <div v-for="account in getAccountTotalsForChart" :key="account.accountKey" class="min-w-0">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-1 min-w-0 flex-1">
                      <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getAccountColor(account.accountKey) }"></div>
                      <div class="relative group min-w-0 flex-1">
                        <span class="text-gray-600 dark:text-gray-400 truncate cursor-pointer block" :title="account.account">
                          {{ account.account }}
                        </span>
                        <!-- Custom tooltip -->
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 invisible group-hover:visible">
                          {{ account.account }}
                        </div>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-1">
                      <span class="text-gray-900 dark:text-gray-100 font-semibold">{{ formatCurrency(account.totalAmount) }}</span>
                      <span class="text-gray-500 ml-1">({{ account.percent.toFixed(0) }}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </KpiCard>
          
          

      <!-- Payment Methods Distribution -->
      <div class="card bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div class="card-body p-3 sm:p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="min-w-0 flex-1">
              <p class="text-purple-100 text-xs sm:text-sm font-medium">PAYMENT METHODS</p>
            </div>
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-purple-400 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
            </div>
          </div>

          <!-- Payment Methods Pie Chart -->
          <div v-if="analyticsData && analyticsData.aggregated.paymentMethods.length > 0" class="mt-2">
            <div class="flex items-center">
              <div class="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <div class="w-full h-full rounded-full" :style="{ background: getPaymentMethodsPieChart }"></div>
                <div class="absolute inset-1.5 sm:inset-2 bg-purple-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">{{ analyticsData.aggregated.paymentMethods.length }}</span>
                </div>
              </div>
              <div class="ml-2 sm:ml-3 space-y-0.5 text-xs min-w-0 flex-1">
                <div v-for="method in analyticsData.aggregated.paymentMethods.slice(0, 3)" :key="method.name" class="min-w-0">
                  <div class="flex items-center justify-between min-w-0">
                    <div class="flex items-center space-x-1 min-w-0 flex-1">
                      <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
                      <span class="text-purple-100 capitalize truncate text-xs">{{ method.name }}</span>
                    </div>
                    <div class="text-purple-200 text-xs flex-shrink-0 ml-1">
                      <span class="font-medium">{{ method.percent.toFixed(0) }}%</span>
                      <span class="text-purple-100 ml-1">{{ formatCurrency(method.sum) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="analyticsData.aggregated.paymentMethods.length > 3" class="text-purple-200 text-xs">+{{ analyticsData.aggregated.paymentMethods.length - 3 }} more</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Aggregated Daily Gain using KpiCard -->
      <KpiCard
        :label="`${formatGainPeriodLabel()} GAIN`"
        :value="formatCurrency(aggregatedDailyGain)"
        :tone="aggregatedDailyGain > 0 ? 'positive' : (aggregatedDailyGain < 0 ? 'negative' : 'neutral')"
        subtext="Includes fees, 30% food costs, utility costs, and payroll (closed + projected open entries when end date is today)"
        :key="`daily-gain-${forceRecompute}`"
      >
        <template #icon>
          <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
          </svg>
        </template>
      </KpiCard>
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
import KpiCard from './ui/KpiCard.vue'
import OrderEvolutionChart from './OrderEvolutionChart.vue'
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

// Force re-computation trigger for KPI values
const forceRecompute = ref(0)

// Watch for data changes that should trigger KPI updates
watch(
  [() => props.analyticsData, () => props.profitabilityData, () => props.currentDateRange],
  (newValues, oldValues) => {
    const [newAnalytics, newProfitability, newDateRange] = newValues
    const [oldAnalytics, oldProfitability, oldDateRange] = oldValues
    
    console.log('👀 DashboardOverview watcher triggered:', {
      analyticsChanged: newAnalytics !== oldAnalytics,
      profitabilityChanged: newProfitability !== oldProfitability,
      dateRangeChanged: newDateRange !== oldDateRange,
      analyticsTimestamp: newAnalytics?.timestamp,
      profitabilityTimestamp: newProfitability?.timestamp,
      newDateRange: newDateRange
    })
    
    // Force recomputation of all computed properties
    forceRecompute.value++
  },
  { deep: true, immediate: false }
)



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

// Aggregated gain across all accounts - REACTIVE SUM of per-account gains
// Uses hybrid logic: prefer client revenue with server-side cost configs; falls back to server-only when needed
const aggregatedDailyGain = computed(() => {
  const trigger = forceRecompute.value
  const profitabilityData = props.profitabilityData
  const analyticsData = props.analyticsData
  const currentDateRange = props.currentDateRange

  // If we don't have account analytics, try server in-sync value as a last resort
  if (!analyticsData?.accounts || analyticsData.accounts.length === 0) {
    const pdStart = profitabilityData?.period?.start
    const pdEnd = profitabilityData?.period?.end
    const curStart = currentDateRange?.start
    const curEnd = currentDateRange?.end
    const profitabilityInSync = !!(pdStart && pdEnd && curStart && curEnd && pdStart === curStart && pdEnd === curEnd)
    if (profitabilityInSync) {
      const fromAccounts = Array.isArray(profitabilityData?.accounts)
        ? profitabilityData.accounts.reduce((sum, acc) => sum + (acc.operatingProfit || 0), 0)
        : 0
      return fromAccounts || (profitabilityData?.company?.operatingProfit || 0)
    }
    return 0
  }

  const currentDays = calculateDaysInPeriod()
  let totalGain = 0

  analyticsData.accounts.forEach(account => {
    const serverAcc = profitabilityData?.accounts?.find(a => a.accountKey === account.accountKey)

    // 1) Build client-side revenue and fees using server cost configs per payment method
    let clientSideRevenue = 0
    let clientSidePaymentMethods = []
    if (account.success && account.data?.data) {
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
        return { method: methodName, revenue, fees, transactionCount, costConfig }
      })
      clientSideRevenue = clientSidePaymentMethods.reduce((s, m) => s + (m.revenue || 0), 0)
    }

    // 2) Hybrid preference when server costs available
    if (serverAcc) {
      if (clientSideRevenue > 0) {
        const serverDays = serverAcc?.daysInPeriod || currentDays
        const serverUtilTotal = serverAcc?.utilityCosts || 0
        const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
        const utilityCostsForPeriod = utilityPerDay * currentDays
        const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
        const netRevenue = clientSideRevenue - paymentFees
        const foodCosts = netRevenue * 0.3
        const totalCosts = paymentFees + foodCosts + utilityCostsForPeriod + (serverAcc.payrollCosts || 0)
        totalGain += clientSideRevenue - totalCosts
        return
      } else {
        // Server-only fallback (scale utilities/entries to period)
        const serverDays = serverAcc?.daysInPeriod || currentDays
        const serverUtilTotal = serverAcc?.utilityCosts || 0
        const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
        const utilityCostsForPeriod = utilityPerDay * currentDays
        const finalGain = (serverAcc.grossSales || 0) - ((serverAcc.paymentFees || 0) + (serverAcc.foodCosts || 0) + utilityCostsForPeriod + (serverAcc.payrollCosts || 0))
        totalGain += finalGain
        return
      }
    }

    // 3) Pure client-side fallback when no server account is available
    if (clientSideRevenue > 0) {
      const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
      const netRevenue = clientSideRevenue - paymentFees
      const foodCosts = netRevenue * 0.3
      const finalGain = clientSideRevenue - (paymentFees + foodCosts)
      totalGain += finalGain
    }
  })

  console.log('💰 aggregatedDailyGain (reactive sum) computed:', {
    totalGain,
    accounts: analyticsData.accounts.length,
    currentDateRange,
    forceRecomputeTrigger: trigger
  })

  return totalGain
})

const getAggregatedGainClass = () => {
  const gain = aggregatedDailyGain.value
  if (gain > 0) return 'text-green-100'
  if (gain < 0) return 'text-red-100'
  return 'text-white'
}

// Gain is always enabled; server includes projected payroll when end date is today
const isGainDisabled = () => false

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
  
  // Debug log for TOTAL AMOUNT
  if (amount !== 0) {
    console.log('💰 formatCurrency called with non-zero amount:', {
      amount,
      num,
      result: `${currencySymbol} ${num.toFixed(2)}`
    })
  }
  
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

// CONVERTED TO COMPUTED PROPERTY for reactivity
const getAccountTotalsForChart = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const analyticsData = props.analyticsData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (!analyticsData || analyticsData.aggregated.accountsCount === 0) {
    return []
  }

  const accountTotals = analyticsData.accounts.map(account => {
    const totalPayments = getAccountTotalPayments.value(account)
    const totalAmount = getAccountTotalAmount.value(account)
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

  console.log('📊 getAccountTotalsForChart computed:', {
    accountCount: accountTotals.length,
    totalAmountAcrossAllAccounts,
    selectedDateRange,
    currentDateRange,
    forceRecomputeTrigger: trigger,
    accountTotals: accountTotals.map(acc => ({
      accountKey: acc.accountKey,
      totalAmount: acc.totalAmount
    }))
  })

  return accountTotals.map(account => ({
    ...account,
    percent: totalAmountAcrossAllAccounts > 0 ? (account.totalAmount / totalAmountAcrossAllAccounts) * 100 : 0
  })).sort((a, b) => b.totalAmount - a.totalAmount) // Sort by total amount descending
})

// CONVERTED TO COMPUTED PROPERTIES for reactivity
const getAccountTotalPayments = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const analyticsData = props.analyticsData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  return (account) => {
    if (!account.success || !account.data?.data) return 0
    return account.data.data.reduce((sum, method) => sum + (method.count || 0), 0)
  }
})

const getAccountTotalAmount = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const analyticsData = props.analyticsData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  return (account) => {
    if (!account.success || !account.data?.data) return 0
    return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  }
})

// CONVERTED TO COMPUTED PROPERTY for reactivity
const getAccountTotalOrders = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const ordersData = props.ordersData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  return (account) => {
    if (!account.success) return 0
    
    // Only use service metrics data for orders - this is the correct source that updates with dates
    if (account.serviceMetrics) {
      const ordersFromServiceMetrics = Object.values(account.serviceMetrics).reduce((sum, service) => sum + (service?.orders?.current_period ?? 0), 0);
      return ordersFromServiceMetrics;
    }
    
    return 0
  }
})

const getServiceColor = (serviceType) => {
  const colors = {
    'TABLE': '#4F46E5', // Indigo
    'ONSITE': '#10B981', // Green
    'TAKEAWAY': '#F59E0B', // Amber
    'DELIVERY': '#EF4444' // Red
  }
  return colors[serviceType] || '#6B7280' // Default color
}

// Total Orders - CONVERTED TO COMPUTED PROPERTY
const totalOrders = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const ordersData = props.ordersData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  const ordersTotal = ordersData?.aggregated?.totalOrders || 0
  
  console.log('📊 totalOrders computed:', {
    ordersTotal,
    hasOrdersData: !!ordersData,
    selectedDateRange,
    currentDateRange,
    forceRecomputeTrigger: trigger
  })
  
  return ordersTotal
})

// Aggregated gross sales - CONVERTED TO COMPUTED PROPERTY
const aggregatedGrossSales = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access all reactive dependencies to ensure proper tracking
  const profitabilityData = props.profitabilityData
  const analyticsData = props.analyticsData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  const profitabilityAmount = profitabilityData?.company?.grossSales || 0
  const analyticsAmount = analyticsData?.aggregated?.totalAmount || 0
  
  // Calculate from individual accounts if aggregated is 0 but accounts have data
  let calculatedFromAccounts = 0
  if (analyticsData?.accounts) {
    calculatedFromAccounts = analyticsData.accounts.reduce((total, account) => {
      if (account.success && account.data?.data) {
        return total + account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
      }
      return total
    }, 0)
  }
  
  const pdStart = profitabilityData?.period?.start
  const pdEnd = profitabilityData?.period?.end
  const curStart = currentDateRange?.start
  const curEnd = currentDateRange?.end
  const profitabilityInSync = !!(pdStart && pdEnd && curStart && curEnd && pdStart === curStart && pdEnd === curEnd)

  console.log('💰 aggregatedGrossSales computed:', {
    profitabilityPeriod: profitabilityData?.period,
    profitabilityAmount,
    analyticsAmount,
    calculatedFromAccounts,
    profitabilityInSync,
    selectedDateRange,
    currentDateRange,
    forceRecomputeTrigger: trigger,
    accountsData: analyticsData?.accounts?.map(acc => ({
      accountKey: acc.accountKey,
      success: acc.success,
      dataLength: acc.data?.data?.length || 0
    }))
  })
  
  // Priority: in-sync profitability > calculated from accounts > analytics aggregated
  let finalAmount = 0
  
  if (profitabilityData?.company && profitabilityInSync && profitabilityAmount > 0) {
    finalAmount = profitabilityAmount
    console.log('💰 Using profitability data (in sync):', finalAmount)
  } else if (calculatedFromAccounts > 0) {
    finalAmount = calculatedFromAccounts
    console.log('💰 Using calculated from accounts:', finalAmount)
  } else {
    finalAmount = analyticsAmount
    console.log('💰 Using analytics aggregated:', finalAmount)
  }
  
  console.log('💰 Final aggregatedGrossSales value:', finalAmount)
  return finalAmount
})

// Client-side fee computation removed

// CONVERTED TO COMPUTED PROPERTIES for reactivity
const getAggregatedPaymentFees = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  const fees = profitabilityData?.company?.paymentFees || 0
  
  console.log('💰 getAggregatedPaymentFees computed:', {
    fees,
    hasCompanyData: !!profitabilityData?.company,
    selectedDateRange,
    currentDateRange,
    forceRecomputeTrigger: trigger
  })
  
  return fees
})

const getAggregatedNetSalesAfterFees = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (profitabilityData?.company) {
    const netSales = profitabilityData.company.netAfterFees || 0
    console.log('💰 getAggregatedNetSalesAfterFees computed (server):', {
      netSales,
      forceRecomputeTrigger: trigger
    })
    return netSales
  }
  
  const netSales = aggregatedGrossSales.value - getAggregatedPaymentFees.value
  console.log('💰 getAggregatedNetSalesAfterFees computed (calculated):', {
    netSales,
    grossSales: aggregatedGrossSales.value,
    fees: getAggregatedPaymentFees.value,
    forceRecomputeTrigger: trigger
  })
  
  return netSales
})

const getAggregatedFeeRate = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (profitabilityData?.company) {
    const feeRate = profitabilityData.company.feeRate || 0
    console.log('💰 getAggregatedFeeRate computed (server):', {
      feeRate,
      forceRecomputeTrigger: trigger
    })
    return feeRate
  }
  
  const gross = aggregatedGrossSales.value
  if (gross <= 0) return 0
  
  const feeRate = getAggregatedPaymentFees.value / gross
  console.log('💰 getAggregatedFeeRate computed (calculated):', {
    feeRate,
    gross,
    fees: getAggregatedPaymentFees.value,
    forceRecomputeTrigger: trigger
  })
  
  return feeRate
})

const getAggregatedTips = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const analyticsData = props.analyticsData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (profitabilityData?.company) {
    const tips = profitabilityData.company.tips || 0
    console.log('💰 getAggregatedTips computed (server):', {
      tips,
      forceRecomputeTrigger: trigger
    })
    return tips
  }
  
  const tips = analyticsData?.aggregated?.totalTips || 0
  console.log('💰 getAggregatedTips computed (analytics):', {
    tips,
    forceRecomputeTrigger: trigger
  })
  
  return tips
})

const getAggregatedTipRate = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (profitabilityData?.company) {
    const tipRate = profitabilityData.company.tipRate || 0
    console.log('💰 getAggregatedTipRate computed (server):', {
      tipRate,
      forceRecomputeTrigger: trigger
    })
    return tipRate
  }
  
  const gross = aggregatedGrossSales.value
  if (gross <= 0) return 0
  
  const tipRate = getAggregatedTips.value / gross
  console.log('💰 getAggregatedTipRate computed (calculated):', {
    tipRate,
    gross,
    tips: getAggregatedTips.value,
    forceRecomputeTrigger: trigger
  })
  
  return tipRate
})

const getAggregatedOperatingMargin = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  // Explicitly access reactive dependencies
  const profitabilityData = props.profitabilityData
  const selectedDateRange = props.selectedDateRange
  const currentDateRange = props.currentDateRange
  
  if (profitabilityData?.company) {
    const margin = profitabilityData.company.operatingMargin || 0
    console.log('💰 getAggregatedOperatingMargin computed (server):', {
      margin,
      forceRecomputeTrigger: trigger
    })
    return margin
  }
  
  const gross = aggregatedGrossSales.value
  if (gross <= 0) return 0
  
  const operatingProfit = aggregatedDailyGain.value
  const margin = operatingProfit / gross
  console.log('💰 getAggregatedOperatingMargin computed (calculated):', {
    margin,
    gross,
    operatingProfit,
    forceRecomputeTrigger: trigger
  })
  
  return margin
})

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
// CONVERTED TO COMPUTED PROPERTY for reactivity
const getPaymentMethodsPieChart = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  if (!props.analyticsData || !props.analyticsData.aggregated.paymentMethods.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  const methods = props.analyticsData.aggregated.paymentMethods
  let currentAngle = 0
  const gradientStops = []

  console.log('💳 getPaymentMethodsPieChart computed:', {
    methodsCount: methods.length,
    forceRecomputeTrigger: trigger,
    methods: methods.map(m => ({ name: m.name, percent: m.percent, sum: m.sum }))
  })

  methods.forEach((method, index) => {
    const color = getPaymentMethodColor(method.name)
    const percentage = method.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
})

// CONVERTED TO COMPUTED PROPERTY for reactivity
const getAccountsPieChart = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  const accounts = getAccountTotalsForChart.value
  if (!accounts || !accounts.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  let currentAngle = 0
  const gradientStops = []

  console.log('💰 getAccountsPieChart computed:', {
    accountCount: accounts.length,
    forceRecomputeTrigger: trigger
  })

  accounts.forEach((account, index) => {
    const color = getAccountColor(account.accountKey)
    const percentage = account.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
})

// CONVERTED TO COMPUTED PROPERTY for reactivity
const getOrdersDistributionForChart = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
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

  console.log('📦 getOrdersDistributionForChart computed:', {
    accountCount: ordersDistribution.length,
    totalOrdersAcrossAllAccounts,
    forceRecomputeTrigger: trigger,
    ordersDistribution: ordersDistribution.map(acc => ({
      accountKey: acc.accountKey,
      totalOrders: acc.totalOrders
    }))
  })

  return ordersDistribution.map(account => ({
    ...account,
    percent: totalOrdersAcrossAllAccounts > 0 ? (account.totalOrders / totalOrdersAcrossAllAccounts) * 100 : 0
  })).sort((a, b) => b.totalOrders - a.totalOrders) // Sort by total orders descending
})

// CONVERTED TO COMPUTED PROPERTY for reactivity
const getOrdersPieChart = computed(() => {
  // Access the force recompute trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  const ordersDistribution = getOrdersDistributionForChart.value
  if (!ordersDistribution || !ordersDistribution.length) {
    return 'conic-gradient(#6B7280 0deg 360deg)'
  }

  let currentAngle = 0
  const gradientStops = []

  console.log('📊 getOrdersPieChart computed:', {
    distributionCount: ordersDistribution.length,
    forceRecomputeTrigger: trigger
  })

  ordersDistribution.forEach((account, index) => {
    const color = getAccountColor(account.accountKey)
    const percentage = account.percent
    const degrees = (percentage / 100) * 360
    
    gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + degrees}deg`)
    currentAngle += degrees
  })

  return `conic-gradient(${gradientStops.join(', ')})`
})


</script> 

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style> 