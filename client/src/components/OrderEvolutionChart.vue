<template>
  <div class="card bg-white">
    <div class="card-body p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-gray-900">{{ $t('dashboard.orderEvolution') }}</h3>
          <p class="text-sm text-gray-500">{{ $t('dashboard.dailyOrderTrends') }}</p>
        </div>
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-48 sm:h-56">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p class="text-sm text-gray-500">{{ $t('dashboard.loadingOrderData') }}</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center h-48 sm:h-56">
        <div class="text-center">
          <svg class="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <p class="text-sm text-gray-500">{{ error }}</p>
        </div>
      </div>

      <!-- Chart Container (SVG) -->
      <div v-else-if="svgChart" class="relative">
        <svg :viewBox="`0 0 ${svgChart.width} ${svgChart.height}`" width="100%" preserveAspectRatio="xMidYMid meet">
          <!-- Axes -->
          <line :x1="svgChart.padding" :y1="svgChart.height - svgChart.padding" :x2="svgChart.width - svgChart.padding" :y2="svgChart.height - svgChart.padding" stroke="#E5E7EB" stroke-width="1" />
          <line :x1="svgChart.padding" :y1="svgChart.padding" :x2="svgChart.padding" :y2="svgChart.height - svgChart.padding" stroke="#E5E7EB" stroke-width="1" />

          <!-- Grid lines and Y-axis labels -->
          <g v-for="t in svgChart.ticks" :key="`tick-${t.value}`">
            <line :x1="svgChart.padding" :x2="svgChart.width - svgChart.padding" :y1="t.y" :y2="t.y" stroke="#F3F4F6" stroke-width="1" />
            <text :x="svgChart.padding - 6" :y="t.y + 3" fill="#6B7280" font-size="10" text-anchor="end">{{ t.value }}</text>
          </g>

          <!-- Lines and points -->
          <g v-for="ds in svgChart.datasets" :key="ds.label">
            <polyline
              :points="ds.points"
              fill="none"
              :stroke="ds.color"
              :stroke-opacity="ds.opacity || 1"
              stroke-width="2"
              :stroke-dasharray="ds.isBreakEven ? '4 4' : '0'"
            />
            <circle
              v-for="(pt, idx) in ds.circles"
              :key="`${ds.label}-${idx}`"
              :cx="pt.cx"
              :cy="pt.cy"
              r="2.5"
              :fill="ds.color"
              :fill-opacity="ds.opacity || 1"
            />
          </g>

          <!-- X labels: first/middle/last -->
          <g v-if="svgChart.labels.length" fill="#6B7280" font-size="10" text-anchor="middle">
            <text :x="svgChart.xAt(0)" :y="svgChart.height - svgChart.padding + 14">{{ svgChart.labels[0] }}</text>
            <text v-if="svgChart.labels.length > 2" :x="svgChart.xAt(Math.floor((svgChart.labels.length-1)/2))" :y="svgChart.height - svgChart.padding + 14">{{ svgChart.labels[Math.floor((svgChart.labels.length-1)/2)] }}</text>
            <text v-if="svgChart.labels.length > 1" :x="svgChart.xAt(svgChart.labels.length-1)" :y="svgChart.height - svgChart.padding + 14">{{ svgChart.labels[svgChart.labels.length-1] }}</text>
          </g>
        </svg>

        <!-- Legend -->
        <div class="mt-3 flex flex-wrap gap-3 justify-center">
          <div v-for="dataset in svgChart.datasets" :key="dataset.label" class="flex items-center space-x-1">
            <div
              class="w-2 h-2 rounded-full"
              :style="{ backgroundColor: dataset.color, opacity: dataset.opacity || 1 }"
            ></div>
            <span class="text-xs text-gray-600">{{ dataset.label }}</span>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="flex items-center justify-center h-48 sm:h-56">
        <div class="text-center">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          <p class="text-sm text-gray-500">{{ $t('dashboard.noOrderData') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../utils/api'

const props = defineProps({
  currentDateRange: {
    type: Object,
    required: true
  },
  timezone: {
    type: String,
    default: 'America/Lima'
  },
  accounts: {
    type: Array,
    default: () => []
  },
  // Used to compute per-account daily break-even (utility + payroll) for 🏠 line
  profitabilityData: {
    type: Object,
    default: null
  }
})

const authStore = useAuthStore()
const { t } = useI18n()
const loading = ref(false)
const error = ref(null)
const evolutionData = ref(null)
const chartKey = ref(0)
// Request de-duplication and debouncing
let debounceTimer = null
const lastRequestKey = ref('')

// Helper: parse labels like DD-MM-YYYY into a sortable timestamp
const parseDateLabelToTs = (label) => {
  if (!label || typeof label !== 'string') return 0
  const parts = label.split('-')
  if (parts.length !== 3) return 0
  const [dd, mm, yyyy] = parts
  // Build ISO date to avoid locale issues
  const iso = `${yyyy}-${mm}-${dd}T00:00:00`
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) ? ts : 0
}

// Helper: format Date -> DD-MM-YYYY in a given timezone
const formatDateToLabel = (date, timezone) => {
  try {
    const parts = date.toLocaleDateString('en-GB', {
      timeZone: timezone || 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).split('/')
    // en-GB => DD/MM/YYYY
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts
      return `${dd}-${mm}-${yyyy}`
    }
  } catch (_) {}
  // Fallback using UTC
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy}`
}

// Generate inclusive per-day labels from current range
const generateDateLabels = (startStr, endStr, timezone) => {
  if (!startStr || !endStr) return []
  const start = new Date(`${startStr}T00:00:00`)
  const end = new Date(`${endStr}T00:00:00`)
  const labels = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    labels.push(formatDateToLabel(d, timezone))
  }
  return labels
}

// Chart data computed property
const chartData = computed(() => {
  if (!evolutionData.value || !evolutionData.value.accounts) return null

  const accounts = evolutionData.value.accounts
  const successfulAccounts = accounts.filter(acc => acc.success && acc.data && acc.data.length > 0)
  
  if (successfulAccounts.length === 0) return null

  // Build full per-day labels from the selected date range
  const sortedDates = generateDateLabels(
    evolutionData.value?.period?.start || props.currentDateRange?.start,
    evolutionData.value?.period?.end || props.currentDateRange?.end,
    props.timezone
  )
  
  // Create a dataset for each successful account
  const accountDatasets = successfulAccounts.map((account, index) => {
    // Generate a color for this account
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16'  // Lime
    ]
    const color = colors[index % colors.length]
    
    // Create data points for this account, filling in missing dates with 0.
    // Prefer revenue amount over order count.
    const accountData = sortedDates.map(date => {
      const dataPoint = account.data.find(item => item.label === date)
      if (!dataPoint) return 0
      // OlaClick evolution_chart usually provides both qty_total (orders) and amount_total (revenue).
      // We want \"how much we charged\" per location, so prioritize amount_total / sales fields.
      const value =
        (dataPoint.amount_total != null ? dataPoint.amount_total : undefined) ??
        (dataPoint.sales_total != null ? dataPoint.sales_total : undefined) ??
        (dataPoint.sum != null ? dataPoint.sum : undefined) ??
        (dataPoint.qty_total != null ? dataPoint.qty_total : 0)
      return Number(value) || 0
    })
    
    return {
      label: account.account,
      data: accountData,
      borderColor: color,
      backgroundColor: color + '20',
      borderWidth: 2,
      fill: false,
      tension: 0.4
    }
  })

  console.log('📊 Chart data computed:', {
    accountCount: successfulAccounts.length,
    dateCount: sortedDates.length,
    datasets: accountDatasets.map(ds => ({
      label: ds.label,
      dataPoints: ds.data.length,
      color: ds.borderColor
    }))
  })

  return {
    labels: sortedDates,
    datasets: accountDatasets
  }
})

// Map of account label -> daily break-even (utility + payroll) from profitability data
const breakEvenByLabel = computed(() => {
  const map = new Map()
  const prof = props.profitabilityData
  const evo = evolutionData.value
  if (!prof?.accounts || !evo?.accounts) return map

  const profByKey = new Map(prof.accounts.map(a => [a.accountKey, a]))

  evo.accounts.forEach(acc => {
    const p = profByKey.get(acc.accountKey)
    if (!p) return
    const days = Number(p.daysInPeriod || prof.period?.days || 0)
    if (!days || !Number.isFinite(days)) return
    const dailyCost =
      (Number(p.utilityCosts || 0) + Number(p.payrollCosts || 0)) / days
    if (dailyCost > 0) {
      // Use account label from evolution API to match chart datasets
      map.set(acc.account, dailyCost)
    }
  })

  return map
})

// SVG chart builder
const svgChart = computed(() => {
  if (!chartData.value || !chartData.value.datasets?.length) return null
  const width = 800
  const height = 240
  const padding = 36
  const labels = chartData.value.labels
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  const beMap = breakEvenByLabel.value

  // Include both revenue series and break-even values in Y scaling
  const allVals = [
    ...chartData.value.datasets.flatMap(ds => ds.data),
    ...Array.from(beMap.values())
  ].filter(v => Number.isFinite(v))

  const maxY = Math.max(1, ...allVals)
  // Build nice ticks (5 steps)
  const steps = 5
  const rawStep = Math.max(1, Math.ceil(maxY / steps))
  const step = rawStep
  const tickValues = Array.from({ length: steps + 1 }, (_, i) => i * step)
  const xAt = (idx) => {
    if (labels.length <= 1) return padding + plotWidth / 2
    const step = plotWidth / (labels.length - 1)
    return padding + idx * step
  }
  const yAt = (val) => {
    const ratio = val / maxY
    return height - padding - ratio * plotHeight
  }
  const datasets = []

  chartData.value.datasets.forEach(ds => {
    // Revenue line for this account
    const pointsArr = labels.map((_, i) => ({
      cx: xAt(i),
      cy: yAt(ds.data[i] || 0)
    }))
    const points = pointsArr.map(p => `${p.cx},${p.cy}`).join(' ')
    datasets.push({
      label: ds.label,
      color: ds.borderColor || '#3B82F6',
      opacity: 1,
      circles: pointsArr,
      points,
      isBreakEven: false
    })

    // Break-even line (🏠 Custos Operacionais diário) for this account, if available
    const beVal = beMap.get(ds.label)
    if (beVal && Number.isFinite(beVal)) {
      const bePointsArr = labels.map((_, i) => ({
        cx: xAt(i),
        cy: yAt(beVal)
      }))
      const bePoints = bePointsArr.map(p => `${p.cx},${p.cy}`).join(' ')
      datasets.push({
        // Use house emoji + account name to differentiate in legend
        label: `🏠 ${ds.label}`,
        color: ds.borderColor || '#3B82F6',
        opacity: 0.35,
        circles: [], // no points for break-even line
        points: bePoints,
        isBreakEven: true
      })
    }
  })
  const ticks = tickValues.map(v => ({ value: v, y: yAt(v) }))
  return { width, height, padding, labels, plotHeight, datasets, xAt, ticks }
})

// Fetch evolution data
const fetchEvolutionData = async () => {
  if (!props.currentDateRange?.start || !props.currentDateRange?.end) {
    error.value = 'Date range not specified'
    return
  }

  loading.value = true
  error.value = null

  try {
    const startDate = props.currentDateRange.start
    const endDate = props.currentDateRange.end
    const requestKey = `${startDate}|${endDate}|${props.timezone}`
    // Skip duplicate requests for the same params
    if (requestKey === lastRequestKey.value && evolutionData.value) {
      console.log('⏭️ Skipping duplicate order-evolution fetch for', requestKey)
      loading.value = false
      return
    }
    lastRequestKey.value = requestKey
    
    // Use our server-side route instead of direct API call
    const url = new URL('/api/analytics/order-evolution', window.location.origin)
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)
    url.searchParams.set('timezone', props.timezone)

    console.log('📊 Fetching order evolution data:', {
      startDate,
      endDate,
      timezone: props.timezone,
      url: url.toString()
    })

    const response = await apiRequest(url.toString(), {
      method: 'GET'
    })
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch order evolution data')
    }
    
    // Ignore stale responses (if params changed mid-flight)
    if (lastRequestKey.value !== requestKey) {
      console.log('🗑️ Ignoring stale order-evolution response for', requestKey)
      return
    }
    evolutionData.value = response

    console.log('📊 Order evolution data received:', response)

  } catch (err) {
    console.error('❌ Error fetching order evolution data:', err)
    error.value = err.message || 'Failed to load order evolution data'
  } finally {
    loading.value = false
  }
}

// No chart library watchers required

// Single watcher keyed by the inputs that affect the request
const triggerFetch = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchEvolutionData()
  }, 150)
}

watch(() => [props.currentDateRange?.start, props.currentDateRange?.end, props.timezone], () => {
  triggerFetch()
}, { immediate: true })
</script>

<style scoped>
.card {
  @apply border border-gray-200 rounded-lg shadow-sm;
}

.card-body {
  @apply p-4;
}
</style>
