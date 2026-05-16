<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">💰 {{ $t('rentability.title') }}</h1>
        <p class="text-sm text-gray-600 mt-1">{{ $t('rentability.subtitle') }}</p>
        <p class="text-xs text-gray-500 mt-2 max-w-2xl leading-relaxed">{{ $t('rentability.perAccountNote') }}</p>
      </div>
      <button 
        @click="showAddModal = true" 
        class="btn-primary flex items-center space-x-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span>{{ $t('rentability.manageCosts') }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="card">
      <div class="card-body text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-600">{{ $t('rentability.loading') }}</p>
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
        <h3 class="text-lg font-medium text-red-900 mb-2">{{ $t('rentability.failedToLoadUtility') }}</h3>
        <p class="text-red-700 mb-4">{{ error }}</p>
        <button @click="fetchUtilityCosts" class="btn-primary">{{ $t('common.tryAgain') }}</button>
      </div>
    </div>

    <!-- Utility Costs Cards -->
    <div v-if="!loading && !error" class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Existing Accounts with Costs -->
      <div v-for="cost in utilityCosts" :key="cost.company_token" class="card">
        <div class="card-body">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-medium text-gray-900">{{ cost.account_name }}</h3>
              <p class="text-sm text-gray-500">{{ cost.company_token }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <button 
                @click="editCost(cost)" 
                class="btn-secondary-sm"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
              <button 
                @click="deleteCost(cost)" 
                class="btn-danger-sm"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Utility Cost Breakdown -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h6 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">🏠 {{ $t('rentability.utilityCosts') }}</h6>
              <div class="text-right">
                <div class="text-sm font-medium text-blue-600">{{ formatCurrency(cost.total_monthly) }} {{ $t('rentability.perMonth') }}</div>
                <div class="text-xs text-green-600">{{ formatCurrency(cost.total_daily) }} {{ $t('rentability.perDay') }}</div>
              </div>
            </div>
            <div v-for="(value, key) in getCostBreakdown(cost)" :key="key" class="flex items-center justify-between text-sm">
                <span class="text-gray-600">{{ $t(`rentability.costFields.${key}`) }}</span>
                <div class="text-right">
                  <span class="font-medium text-gray-900">{{ formatCurrency(value) }}</span>
                  <span class="text-gray-400 ml-2">({{ formatCurrency(value / 30) }} {{ $t('rentability.perDay') }})</span>
                </div>
            </div>
          </div>

          <!-- Payment Method Costs Breakdown -->
          <div v-if="getAccountPaymentCosts(cost.company_token).length > 0" class="space-y-2 pt-3 border-t border-gray-100">
            <h6 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">💳 {{ $t('rentability.paymentProcessingCosts') }}</h6>
            <div v-for="paymentCost in getAccountPaymentCosts(cost.company_token)" :key="paymentCost.payment_method_code" class="flex items-center justify-between text-sm">
                <span class="text-gray-600 capitalize">{{ formatPaymentMethodName(paymentCost.payment_method_code) }}</span>
                <div class="text-right">
                  <span class="font-medium text-purple-600">{{ paymentCost.cost_percentage }}%</span>
                  <span v-if="paymentCost.fixed_cost > 0" class="text-gray-400 ml-1">+ {{ formatCurrency(paymentCost.fixed_cost) }}</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accounts without costs -->
      <div v-for="account in accountsWithoutCosts" :key="account.company_token" class="card border-dashed border-2 border-gray-300">
        <div class="card-body text-center py-8">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">{{ account.account_name }}</h3>
          <p class="text-gray-500 mb-4">{{ $t('rentability.noUtilityCosts') }}</p>
          <button 
            @click="addCostForAccount(account)" 
            class="btn-secondary"
          >
            {{ $t('rentability.manageCosts') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Unified Costs Management Modal -->
    <div v-if="showAddModal" class="fixed inset-0 flex items-center justify-center z-50 p-4" style="background: rgba(15,23,42,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
      <div class="max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-2xl" style="background: rgba(255,255,255,0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 25px 60px rgba(0,0,0,0.12);" @click.stop>
        <div class="flex items-center justify-between p-6 border-b" style="border-color: rgba(229,231,235,0.4);">
          <h2 class="text-xl font-bold text-gray-900">
            💰 {{ modalHasExistingUtility ? $t('common.edit') : $t('common.manage') }} {{ $t('rentability.accountCosts') }}
          </h2>
          <button type="button" @click="closeModal" class="text-gray-400 hover:text-gray-500 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-6">
          <div v-if="!selectedModalAccount" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('rentability.account') }}</label>
            <select 
              v-model="selectedModalAccount" 
              class="form-select"
              required
            >
              <option value="">{{ $t('rentability.selectAccount') }}</option>
              <option v-for="account in accounts" :key="account.company_token" :value="account.company_token">
                {{ account.account_name || account.company_token }}
              </option>
            </select>
          </div>

          <AccountRentabilitySettings
            v-else
            :company-token="selectedModalAccount"
            :account-name="getSelectedAccountName()"
            :initial-utility-record="modalInitialUtilityRecord"
            @utility-saved="onSettingsUtilitySaved"
            @utility-deleted="onSettingsUtilityDeleted"
            @payment-costs-saved="onSettingsPaymentSaved"
          />
        </div>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import { formatPaymentMethodName } from '../utils/paymentMethods'
import AccountRentabilitySettings from '../components/AccountRentabilitySettings.vue'

const authStore = useAuthStore()
const { t } = useI18n()

const utilityCosts = ref([])
const allPaymentMethodCosts = ref(new Map())
const accounts = ref([])
const loading = ref(false)
const error = ref('')
const showAddModal = ref(false)
const selectedModalAccount = ref('')

const UTILITY_BREAKDOWN_KEYS = [
  'rent_monthly',
  'electricity_monthly',
  'water_monthly',
  'internet_monthly',
  'gas_monthly',
  'insurance_monthly',
  'maintenance_monthly',
  'staff_monthly',
  'marketing_monthly',
  'other_monthly'
]

const currencySymbol = computed(() => authStore.user?.currencySymbol || 'S/')

const accountsWithoutCosts = computed(() => {
  const costsTokens = utilityCosts.value.map((cost) => cost.company_token)
  return accounts.value.filter((account) => !costsTokens.includes(account.company_token))
})

const modalInitialUtilityRecord = computed(() => {
  if (!selectedModalAccount.value) return null
  return utilityCosts.value.find((c) => c.company_token === selectedModalAccount.value) || null
})

const modalHasExistingUtility = computed(() => {
  if (!selectedModalAccount.value) return false
  return utilityCosts.value.some((c) => c.company_token === selectedModalAccount.value)
})

const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return `${currencySymbol.value} ${num.toFixed(2)}`
}

const getCostBreakdown = (cost) => {
  const breakdown = {}
  for (const key of UTILITY_BREAKDOWN_KEYS) {
    const value = cost[key] || 0
    if (value > 0) {
      breakdown[key] = value
    }
  }
  return breakdown
}

const fetchUtilityCosts = async () => {
  loading.value = true
  error.value = ''

  try {
    const data = await api.get('/api/utility-costs')
    if (data.success) {
      utilityCosts.value = data.data
      await fetchAllPaymentMethodCosts()
    } else {
      throw new Error(data.error || 'Failed to load utility costs')
    }
  } catch (err) {
    console.error('❌ Utility costs fetch error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const fetchAllPaymentMethodCosts = async () => {
  try {
    const accountTokens = new Set()
    utilityCosts.value.forEach((cost) => accountTokens.add(cost.company_token))
    accounts.value.forEach((account) => accountTokens.add(account.company_token))

    for (const companyToken of accountTokens) {
      try {
        const data = await api.getPaymentMethodCosts(companyToken)
        if (data.success && data.data.length > 0) {
          allPaymentMethodCosts.value.set(companyToken, data.data)
        }
      } catch (err) {
        console.warn(`Failed to fetch payment costs for ${companyToken}:`, err)
      }
    }
  } catch (err) {
    console.error('❌ Error fetching all payment method costs:', err)
  }
}

const getAccountPaymentCosts = (companyToken) => {
  return allPaymentMethodCosts.value.get(companyToken) || []
}

const addCostForAccount = (account) => {
  selectedModalAccount.value = account.company_token
  showAddModal.value = true
}

const editCost = (cost) => {
  selectedModalAccount.value = cost.company_token
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  selectedModalAccount.value = ''
}

const onSettingsUtilitySaved = (data) => {
  const index = utilityCosts.value.findIndex((cost) => cost.company_token === data.company_token)
  if (index >= 0) {
    utilityCosts.value[index] = data
  } else {
    utilityCosts.value.push(data)
  }
  fetchAllPaymentMethodCosts()
  closeModal()
}

const onSettingsUtilityDeleted = (token) => {
  utilityCosts.value = utilityCosts.value.filter((c) => c.company_token !== token)
  fetchAllPaymentMethodCosts()
  closeModal()
}

const onSettingsPaymentSaved = () => {
  fetchAllPaymentMethodCosts()
}

const deleteCost = async (cost) => {
  if (!confirm(t('rentability.confirmDeleteUtility', { accountName: cost.account_name }))) {
    return
  }

  try {
    const data = await api.delete(`/api/utility-costs/${cost.company_token}`)

    if (data.success) {
      utilityCosts.value = utilityCosts.value.filter((c) => c.company_token !== cost.company_token)
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: t('rentability.utilityCostsDeleted')
      })
    } else {
      throw new Error(data.error || 'Failed to delete utility costs')
    }
  } catch (err) {
    console.error('❌ Delete utility costs error:', err)
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: err.message
    })
  }
}

const fetchCompanyAccounts = async () => {
  try {
    const companyId = authStore.user?.company_id || authStore.user?.companyId
    if (!companyId) return
    const res = await api.listCompanyAccounts(companyId)
    accounts.value = res?.data || []
  } catch (e) {
    accounts.value = []
  }
}

const getSelectedAccountName = () => {
  const account = accounts.value.find((acc) => acc.company_token === selectedModalAccount.value)
  return account ? account.account_name || account.company_token : ''
}

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && newUser.accounts) {
      console.log('User accounts available:', newUser.accounts)
    }
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  fetchCompanyAccounts()
  fetchUtilityCosts()
})
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}

.loading-spinner-sm {
  @apply inline-block w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin;
}

.form-select {
  @apply w-full px-3 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500;
  background: rgba(255,255,255,0.60);
  border: 1px solid rgba(209,213,219,0.6);
}

.form-input {
  @apply w-full pr-3 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500;
  background: rgba(255,255,255,0.60);
  border: 1px solid rgba(209,213,219,0.6);
}

.btn-secondary-sm {
  @apply px-2 py-1 text-sm text-gray-700 rounded-xl transition-all duration-200;
  background: rgba(255,255,255,0.5);
  border: 1px solid rgba(209,213,219,0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.btn-secondary-sm:hover {
  background: rgba(255,255,255,0.7);
  box-shadow: 0 2px 16px rgba(0,0,0,0.04);
}

.btn-danger-sm {
  @apply px-2 py-1 text-sm text-red-700 rounded-xl transition-all duration-200;
  background: rgba(254,226,226,0.6);
  border: 1px solid rgba(252,165,165,0.4);
}
.btn-danger-sm:hover {
  background: rgba(254,226,226,0.8);
}
</style>