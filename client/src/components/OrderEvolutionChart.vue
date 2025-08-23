<template>
  <div class="card bg-white">
    <div class="card-body p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-gray-900">Order Evolution</h3>
          <p class="text-sm text-gray-500">Daily order trends over the selected period (separate lines for each account)</p>
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
          <p class="text-sm text-gray-500">Loading order evolution data...</p>
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

      <!-- Chart Container -->
      <div v-else-if="chartData" class="relative">
        <canvas ref="chartCanvas" class="w-full h-48 sm:h-56"></canvas>
        
        <!-- Chart Legend -->
        <div class="mt-3 flex flex-wrap gap-3 justify-center">
          <div v-for="dataset in chartData.datasets" :key="dataset.label" class="flex items-center space-x-1">
            <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: dataset.borderColor }"></div>
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
          <p class="text-sm text-gray-500">No order data available for the selected period</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAuthStore } from '../stores/auth'
import { apiRequest } from '../utils/api'

// Register Chart.js components
Chart.register(...registerables)

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
  }
})

const authStore = useAuthStore()
const chartCanvas = ref(null)
const chart = ref(null)
const loading = ref(false)
const error = ref(null)
const evolutionData = ref(null)

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

// Chart data computed property
const chartData = computed(() => {
  if (!evolutionData.value || !evolutionData.value.accounts) return null

  const accounts = evolutionData.value.accounts
  const successfulAccounts = accounts.filter(acc => acc.success && acc.data && acc.data.length > 0)
  
  if (successfulAccounts.length === 0) return null

  // Get all unique dates from all accounts to create consistent labels
  const allDates = new Set()
  successfulAccounts.forEach(account => {
    account.data.forEach(item => {
      allDates.add(item.label)
    })
  })
  
  const sortedDates = Array.from(allDates).sort((a, b) => parseDateLabelToTs(a) - parseDateLabelToTs(b))
  
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
    
    // Create data points for this account, filling in missing dates with 0
    const accountData = sortedDates.map(date => {
      const dataPoint = account.data.find(item => item.label === date)
      return dataPoint ? (dataPoint.qty_total || 0) : 0
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
    
    evolutionData.value = response

    console.log('📊 Order evolution data received:', response)

  } catch (err) {
    console.error('❌ Error fetching order evolution data:', err)
    error.value = err.message || 'Failed to load order evolution data'
  } finally {
    loading.value = false
  }
}

// Initialize chart
const initChart = () => {
  if (!chartCanvas.value || !chartData.value) return

  // Destroy existing chart
  if (chart.value) {
    chart.value.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  
  chart.value = new Chart(ctx, {
    type: 'line',
    data: chartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false // We'll use custom legend
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: (context) => {
              return `Date: ${context[0].label}`
            },
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y} orders`
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date',
            color: '#6B7280'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            color: '#6B7280',
            maxRotation: 45
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Orders',
            color: '#6B7280'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            color: '#6B7280',
            beginAtZero: true,
            stepSize: 1
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      elements: {
        point: {
          radius: 3,
          hoverRadius: 5
        }
      }
    }
  })
}

// Watch for data changes and update chart
watch(chartData, () => {
  if (chartData.value) {
    nextTick(() => {
      initChart()
    })
  }
}, { deep: true })

// Watch for date range changes
watch(() => props.currentDateRange, () => {
  fetchEvolutionData()
}, { deep: true })

// Watch for accounts changes
watch(() => props.accounts, () => {
  fetchEvolutionData()
}, { deep: true })

onMounted(() => {
  fetchEvolutionData()
})

onUnmounted(() => {
  if (chart.value) {
    chart.value.destroy()
  }
})
</script>

<style scoped>
.card {
  @apply border border-gray-200 rounded-lg shadow-sm;
}

.card-body {
  @apply p-4;
}
</style>
