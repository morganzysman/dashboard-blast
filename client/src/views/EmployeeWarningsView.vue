<template>
  <div class="container mx-auto px-4 py-6">
    <!-- Page Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">⚠️ {{ $t('employee.warnings.title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('employee.warnings.subtitle') }}
        </p>
      </div>
      <button @click="refreshWarnings" 
              class="btn-secondary"
              :disabled="loading">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        {{ $t('common.refresh') }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="p-2 bg-yellow-100 rounded-lg dark:bg-yellow-950/40">
              <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('employee.warnings.totalWarnings') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ warnings.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="p-2 bg-orange-100 rounded-lg dark:bg-orange-950/40">
              <svg class="w-6 h-6 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('employee.warnings.pendingAcknowledgment') }}</p>
              <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ pendingCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="p-2 bg-green-100 rounded-lg dark:bg-green-950/40">
              <svg class="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('employee.warnings.acknowledged') }}</p>
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ acknowledgedCount }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Warnings List -->
    <div class="card">
      <div class="card-header">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ $t('employee.warnings.allWarnings') }}</h2>
      </div>
      <div class="card-body">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-4">
          <div v-for="n in 3" :key="n" class="animate-pulse">
            <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="warnings.length === 0" class="text-center py-8">
          <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{{ $t('employee.warnings.noWarnings') }}</h3>
          <p class="text-gray-600 dark:text-gray-400">{{ $t('employee.warnings.keepUpGoodWork') }}</p>
        </div>

        <!-- Warnings List -->
        <div v-else class="space-y-4">
          <div v-for="warning in warnings" :key="warning.id" 
               class="border rounded-lg p-4 transition-colors duration-200"
               :class="warning.acknowledged_at ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'">
            
            <!-- Warning Header -->
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-1">
                  <span class="severity-badge" :class="getSeverityClass(warning.severity_level)">
                    {{ getSeverityIcon(warning.severity_level) }} {{ warning.severity_level }}
                  </span>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ warning.warning_motive }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ getWarningCategoryName(warning.warning_category) }}</p>
                </div>
              </div>
              
              <!-- Acknowledgment Button -->
              <div v-if="!warning.acknowledged_at">
                <button @click="acknowledgeWarning(warning.id)" 
                        class="btn-primary btn-sm"
                        :disabled="acknowledging === warning.id">
                  <svg v-if="acknowledging === warning.id" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {{ $t('employee.warnings.acknowledge') }}
                </button>
              </div>
              <div v-else class="text-green-600 dark:text-green-400 text-sm font-medium">
                ✓ {{ $t('employee.warnings.acknowledged') }}
              </div>
            </div>
            
            <!-- Warning Details -->
            <div v-if="warning.description" class="rounded-xl p-3 mb-3" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{{ $t('common.details') }}:</h4>
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ warning.description }}</p>
            </div>
            
            <!-- Warning Metadata -->
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div class="flex justify-between">
                <span><strong>{{ $t('employee.warnings.issuedAt') }}:</strong> {{ formatDate(warning.issued_at) }}</span>
                <span><strong>{{ $t('employee.warnings.issuedBy') }}:</strong> {{ warning.issued_by_name }}</span>
              </div>
              <div v-if="warning.acknowledged_at">
                <span><strong>{{ $t('employee.warnings.acknowledged') }}:</strong> {{ formatDate(warning.acknowledged_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Warning Categories Information -->
    <div class="card mt-6">
      <div class="card-header">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">📋 {{ $t('employee.warnings.warningCategories') }}</h2>
      </div>
      <div class="card-body">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ $t('employee.warnings.categoriesDescription') }}
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="(category, key) in warningCategories" :key="key" class="border rounded-lg p-4 dark:border-gray-700">
            <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">{{ category.name }}</h3>
            <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li v-for="motive in category.motives.slice(0, 3)" :key="motive" class="flex items-center">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                {{ motive }}
              </li>
              <li v-if="category.motives.length > 3" class="text-xs italic">
                {{ $t('employee.warnings.andMore', { count: category.motives.length - 3 }) }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
const { t } = useI18n()

// State
const warnings = ref([])
const warningCategories = ref({})
const loading = ref(false)
const acknowledging = ref(null)

// Computed
const pendingCount = computed(() => {
  return warnings.value.filter(w => !w.acknowledged_at).length
})

const acknowledgedCount = computed(() => {
  return warnings.value.filter(w => w.acknowledged_at).length
})

// Methods
const loadWarnings = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/warnings')
    if (response.success) {
      warnings.value = response.warnings || []
    }
  } catch (error) {
    console.error('Error loading warnings:', error)
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: t('employee.warnings.failedToLoad')
    })
  } finally {
    loading.value = false
  }
}

const loadWarningCategories = async () => {
  try {
    const response = await api.get('/api/warnings/categories')
    if (response.success) {
      warningCategories.value = response.categories || {}
    }
  } catch (error) {
    console.error('Error loading warning categories:', error)
  }
}

const acknowledgeWarning = async (warningId) => {
  acknowledging.value = warningId
  try {
    const response = await api.put(`/api/warnings/${warningId}/acknowledge`)
    if (response.success) {
      // Update the warning in the list
      const warningIndex = warnings.value.findIndex(w => w.id === warningId)
      if (warningIndex !== -1) {
        warnings.value[warningIndex] = response.warning
      }
      
      window.showNotification?.({
        type: 'success',
        title: t('employee.warnings.warningAcknowledged'),
        message: t('employee.warnings.thankYouForAcknowledging')
      })
    }
  } catch (error) {
    console.error('Error acknowledging warning:', error)
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: error.response?.data?.error || t('employee.warnings.failedToAcknowledge')
    })
  } finally {
    acknowledging.value = null
  }
}

const refreshWarnings = async () => {
  await Promise.all([loadWarnings(), loadWarningCategories()])
}

// Helper methods
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getSeverityClass = (severity) => {
  const classes = {
    low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
    medium: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    critical: 'bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300'
  }
  return classes[severity] || classes.low
}

const getSeverityIcon = (severity) => {
  const icons = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '⚫'
  }
  return icons[severity] || '🟡'
}

const getWarningCategoryName = (categoryKey) => {
  return warningCategories.value[categoryKey]?.name || categoryKey
}

// Lifecycle
onMounted(async () => {
  await refreshWarnings()
})
</script>

<style scoped>
.severity-badge {
  @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
}

.btn-sm {
  @apply px-3 py-1 text-sm;
}
</style>
