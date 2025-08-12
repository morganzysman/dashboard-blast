<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">💰 Rentability Management</h1>
        <p class="text-sm text-gray-600 mt-1">Manage monthly utility costs and payment method fees for profitability analysis</p>
      </div>
      <button 
        @click="showAddModal = true" 
        class="btn-primary flex items-center space-x-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span>Manage Costs</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="card">
      <div class="card-body text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-600">Loading utility costs...</p>
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
        <h3 class="text-lg font-medium text-red-900 mb-2">Failed to Load Utility Costs</h3>
        <p class="text-red-700 mb-4">{{ error }}</p>
        <button @click="fetchUtilityCosts" class="btn-primary">Try Again</button>
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
              <h6 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">🏠 Utility Costs</h6>
              <div class="text-right">
                <div class="text-sm font-medium text-blue-600">{{ formatCurrency(cost.total_monthly) }}/month</div>
                <div class="text-xs text-green-600">{{ formatCurrency(cost.total_daily) }}/day</div>
              </div>
            </div>
            <template v-for="(value, key) in getCostBreakdown(cost)" :key="key">
              <div v-if="value > 0" class="flex items-center justify-between text-sm">
                <span class="text-gray-600 capitalize">{{ formatCostLabel(key) }}</span>
                <div class="text-right">
                  <span class="font-medium text-gray-900">{{ formatCurrency(value) }}</span>
                  <span class="text-gray-400 ml-2">({{ formatCurrency(value / 30) }}/day)</span>
                </div>
              </div>
            </template>
          </div>

          <!-- Payment Method Costs Breakdown -->
          <div v-if="getAccountPaymentCosts(cost.company_token).length > 0" class="space-y-2 pt-3 border-t border-gray-100">
            <h6 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">💳 Payment Processing Costs</h6>
            <template v-for="paymentCost in getAccountPaymentCosts(cost.company_token)" :key="paymentCost.payment_method_code">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 capitalize">{{ formatPaymentMethodName(paymentCost.payment_method_code) }}</span>
                <div class="text-right">
                  <span class="font-medium text-purple-600">{{ paymentCost.cost_percentage }}%</span>
                  <span v-if="paymentCost.fixed_cost > 0" class="text-gray-400 ml-1">+ {{ formatCurrency(paymentCost.fixed_cost) }}</span>
                </div>
              </div>
            </template>
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
          <p class="text-gray-500 mb-4">No utility costs configured</p>
          <button 
            @click="addCostForAccount(account)" 
            class="btn-secondary"
          >
            Manage Costs
          </button>
        </div>
      </div>
    </div>

    <!-- Unified Costs Management Modal -->
    <div v-if="showAddModal || editingCost" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 class="text-xl font-bold text-gray-900">
            💰 {{ editingCost ? 'Edit' : 'Manage' }} Account Costs
          </h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-500 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Tab Navigation -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              @click="activeTab = 'utility'"
              :class="[
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'utility'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              🏠 Utility Costs
            </button>
            <button
              @click="activeTab = 'payment'"
              :class="[
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'payment'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              💳 Payment Method Costs
            </button>
          </nav>
        </div>

        <div class="p-6">
          <!-- Account Selection (Common for both tabs) -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Account</label>
            <select 
              v-model="selectedModalAccount" 
              @change="onModalAccountChange"
              class="form-select"
              required
            >
              <option value="">Select an account</option>
              <option v-for="account in accounts" :key="account.company_token" :value="account.company_token">
                {{ account.account_name || account.company_token }}
              </option>
            </select>
          </div>

          <!-- Utility Costs Tab -->
          <div v-show="activeTab === 'utility'" class="space-y-6">
            <form @submit.prevent="saveCosts">
              <!-- Cost Categories -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="field in costFields" :key="field.key" class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ field.label }} (Monthly)
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      {{ currencySymbol }}
                    </span>
                    <input 
                      type="number" 
                      v-model.number="formData[field.key]"
                      class="form-input pl-12" 
                      min="0" 
                      step="0.01"
                      :placeholder="field.placeholder"
                    />
                  </div>
                </div>
              </div>

              <!-- Total Preview -->
              <div class="bg-blue-50 rounded-lg p-4 mb-6">
                <div class="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p class="text-lg font-bold text-blue-600">{{ formatCurrency(totalMonthlyCosts) }}</p>
                    <p class="text-xs text-blue-500">Total Monthly</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold text-green-600">{{ formatCurrency(totalMonthlyCosts / 30) }}</p>
                    <p class="text-xs text-green-500">Total Daily</p>
                  </div>
                </div>
              </div>

              <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
                <button type="submit" :disabled="saving || !selectedModalAccount" class="btn-primary">
                  <span v-if="saving" class="flex items-center">
                    <div class="loading-spinner-sm mr-2"></div>
                    Saving...
                  </span>
                  <span v-else>{{ editingCost ? 'Update' : 'Save' }} Utility Costs</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Payment Method Costs Tab -->
          <div v-show="activeTab === 'payment'" class="space-y-6">
            <div v-if="selectedModalAccount">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-medium text-gray-900">
                  Payment Processing Costs for {{ getSelectedAccountName() }}
                </h3>
                <button 
                  @click="addDefaultPaymentMethods" 
                  class="btn-secondary-sm"
                  :disabled="accountPaymentCosts.length > 0"
                  :title="accountPaymentCosts.length > 0 ? 'Clear existing methods first to add defaults' : 'Add common payment methods with default costs'"
                >
                  Add Common Methods
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Percentage (%)
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fixed Cost
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="cost in accountPaymentCosts" :key="cost.payment_method_code" :class="{ 'bg-yellow-50': cost.isNew }">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                          <span class="text-sm font-medium text-gray-900">
                            {{ formatPaymentMethodName(cost.payment_method_code) }}
                          </span>
                          <span v-if="cost.isNew" class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            New
                          </span>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="number" 
                          v-model.number="cost.cost_percentage"
                          class="form-input w-20 text-sm" 
                          min="0" 
                          max="100"
                          step="0.01"
                          @input="markAsModified(cost)"
                        />
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                          <span class="text-gray-400 text-sm mr-1">{{ currencySymbol }}</span>
                          <input 
                            type="number" 
                            v-model.number="cost.fixed_cost"
                            class="form-input w-20 text-sm" 
                            min="0" 
                            step="0.01"
                            @input="markAsModified(cost)"
                          />
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button 
                          @click="removePaymentMethodCost(cost)" 
                          class="btn-danger-sm"
                          :title="cost.isNew ? 'Remove from list' : 'Delete from database'"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="accountPaymentCosts.length === 0">
                      <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                        No payment methods configured for this account.<br>
                        <span class="text-sm">Use "Add Common Methods" or add individual methods below.</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Add New Payment Method -->
              <div class="border-t border-gray-200 pt-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select v-model="newPaymentMethod.code" class="form-select">
                      <option value="">Select method</option>
                      <option v-for="method in availablePaymentMethods" :key="method.code" :value="method.code">
                        {{ method.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Percentage (%)</label>
                    <input 
                      type="number" 
                      v-model.number="newPaymentMethod.percentage"
                      class="form-input" 
                      min="0" 
                      max="100"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Fixed Cost</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        {{ currencySymbol }}
                      </span>
                      <input 
                        type="number" 
                        v-model.number="newPaymentMethod.fixedCost"
                        class="form-input pl-12" 
                        min="0" 
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <button 
                      @click="addPaymentMethodCost" 
                      :disabled="!newPaymentMethod.code"
                      class="btn-primary w-full"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
                <button 
                  @click="saveAllPaymentMethodCosts" 
                  :disabled="!selectedModalAccount || savingPaymentCosts || !hasUnsavedChanges" 
                  class="btn-primary"
                  :class="{ 'opacity-50': !hasUnsavedChanges }"
                >
                  <span v-if="savingPaymentCosts" class="flex items-center">
                    <div class="loading-spinner-sm mr-2"></div>
                    Saving...
                  </span>
                  <span v-else>
                    Save Payment Costs
                    <span v-if="hasUnsavedChanges" class="ml-1 text-xs">({{ unsavedCount }})</span>
                  </span>
                </button>
              </div>
            </div>

            <div v-else class="text-center py-8 text-gray-500">
              Please select an account first
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
import api from '../utils/api'
import { getCommonPaymentMethods, formatPaymentMethodName } from '../utils/paymentMethods'

const authStore = useAuthStore()

// Reactive data
const utilityCosts = ref([])
const allPaymentMethodCosts = ref(new Map()) // Map of company_token -> payment method costs array
const accounts = ref([]) // company accounts (token + name)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showAddModal = ref(false)
const editingCost = ref(null)

// Unified modal data
const activeTab = ref('utility')
const selectedModalAccount = ref('')

// Payment method costs data
const accountPaymentCosts = ref([])
const savingPaymentCosts = ref(false)
const newPaymentMethod = ref({
  code: '',
  percentage: 0,
  fixedCost: 0
})

// Form data
const formData = ref({
  company_token: '',
  account_name: '',
  rent_monthly: 0,
  electricity_monthly: 0,
  water_monthly: 0,
  internet_monthly: 0,
  gas_monthly: 0,
  insurance_monthly: 0,
  maintenance_monthly: 0,
  staff_monthly: 0,
  marketing_monthly: 0,
  other_monthly: 0
})

// Cost field definitions
const costFields = [
  { key: 'rent_monthly', label: 'Rent', placeholder: '0.00' },
  { key: 'electricity_monthly', label: 'Electricity', placeholder: '0.00' },
  { key: 'water_monthly', label: 'Water', placeholder: '0.00' },
  { key: 'internet_monthly', label: 'Internet', placeholder: '0.00' },
  { key: 'gas_monthly', label: 'Gas', placeholder: '0.00' },
  { key: 'insurance_monthly', label: 'Insurance', placeholder: '0.00' },
  { key: 'maintenance_monthly', label: 'Maintenance', placeholder: '0.00' },
  { key: 'staff_monthly', label: 'Staff/Payroll', placeholder: '0.00' },
  { key: 'marketing_monthly', label: 'Marketing', placeholder: '0.00' },
  { key: 'other_monthly', label: 'Other Costs', placeholder: '0.00' }
]

// Computed properties
const currencySymbol = computed(() => authStore.user?.currencySymbol || 'S/')

const accountsWithoutCosts = computed(() => {
  const costsTokens = utilityCosts.value.map(cost => cost.company_token)
  // New model does not store is_active per account; include all
  return accounts.value.filter(account => !costsTokens.includes(account.company_token))
})

const availableAccounts = computed(() => {
  if (editingCost.value) {
    return [{ 
      company_token: editingCost.value.company_token, 
      account_name: editingCost.value.account_name 
    }]
  }
  console.log('🔍 availableAccounts computed:')
  console.log('   accountsWithoutCosts:', accountsWithoutCosts.value)
  console.log('   accounts (company):', accounts.value)
  
  // Fallback: if no accounts without costs, show all active accounts
  const available = accountsWithoutCosts.value.length > 0 
    ? accountsWithoutCosts.value 
    : accounts.value
  
  console.log('   final available:', available)
  return available
})

const totalMonthlyCosts = computed(() => {
  return Object.keys(formData.value).reduce((total, key) => {
    if (key.endsWith('_monthly')) {
      return total + (formData.value[key] || 0)
    }
    return total
  }, 0)
})

// Payment method costs computed properties
const availablePaymentMethods = computed(() => {
  const existingCodes = accountPaymentCosts.value.map(cost => cost.payment_method_code)
  return getCommonPaymentMethods().filter(method => !existingCodes.includes(method.code))
})

const hasUnsavedChanges = computed(() => {
  return accountPaymentCosts.value.some(cost => cost.isNew || cost.isModified)
})

const unsavedCount = computed(() => {
  return accountPaymentCosts.value.filter(cost => cost.isNew || cost.isModified).length
})

// Methods
const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return `${currencySymbol.value} ${num.toFixed(2)}`
}

const formatCostLabel = (key) => {
  return key.replace('_monthly', '').replace('_', ' ')
}

const getCostBreakdown = (cost) => {
  const breakdown = {}
  for (const field of costFields) {
    const value = cost[field.key] || 0
    if (value > 0) {
      breakdown[field.key] = value
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
      console.log('📊 Utility costs loaded:', data.data)
      
      // Also fetch payment method costs for all accounts
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
    // Get all unique account tokens from utility costs and user accounts
    const accountTokens = new Set()
    
    // Add tokens from utility costs
    utilityCosts.value.forEach(cost => accountTokens.add(cost.company_token))
    
    // Add tokens from user accounts
    userAccounts.value.forEach(account => accountTokens.add(account.company_token))
    
    // Fetch payment method costs for each account
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
    
    console.log('💳 All payment method costs loaded:', allPaymentMethodCosts.value)
  } catch (err) {
    console.error('❌ Error fetching all payment method costs:', err)
  }
}

const getAccountPaymentCosts = (companyToken) => {
  return allPaymentMethodCosts.value.get(companyToken) || []
}

const addCostForAccount = (account) => {
  formData.value = {
    company_token: account.company_token,
    account_name: account.account_name,
    rent_monthly: 0,
    electricity_monthly: 0,
    water_monthly: 0,
    internet_monthly: 0,
    gas_monthly: 0,
    insurance_monthly: 0,
    maintenance_monthly: 0,
    staff_monthly: 0,
    marketing_monthly: 0,
    other_monthly: 0
  }
  selectedModalAccount.value = account.company_token
  activeTab.value = 'utility'
  showAddModal.value = true
  loadPaymentMethodCosts()
}

const editCost = (cost) => {
  // Only copy the allowed cost fields, not database metadata
  formData.value = {
    company_token: cost.company_token || '',
    account_name: cost.account_name || '',
    rent_monthly: cost.rent_monthly || 0,
    electricity_monthly: cost.electricity_monthly || 0,
    water_monthly: cost.water_monthly || 0,
    internet_monthly: cost.internet_monthly || 0,
    gas_monthly: cost.gas_monthly || 0,
    insurance_monthly: cost.insurance_monthly || 0,
    maintenance_monthly: cost.maintenance_monthly || 0,
    staff_monthly: cost.staff_monthly || 0,
    marketing_monthly: cost.marketing_monthly || 0,
    other_monthly: cost.other_monthly || 0
  }
  editingCost.value = cost
  selectedModalAccount.value = cost.company_token
  activeTab.value = 'utility'
  showAddModal.value = true
  loadPaymentMethodCosts()
}

const closeModal = () => {
  showAddModal.value = false
  editingCost.value = null
  activeTab.value = 'utility'
  selectedModalAccount.value = ''
  accountPaymentCosts.value = []
  formData.value = {
    company_token: '',
    account_name: '',
    rent_monthly: 0,
    electricity_monthly: 0,
    water_monthly: 0,
    internet_monthly: 0,
    gas_monthly: 0,
    insurance_monthly: 0,
    maintenance_monthly: 0,
    staff_monthly: 0,
    marketing_monthly: 0,
    other_monthly: 0
  }
  newPaymentMethod.value = {
    code: '',
    percentage: 0,
    fixedCost: 0
  }
}

const saveCosts = async () => {
  saving.value = true

  try {
    // Set company_token from selected account
    if (selectedModalAccount.value) {
      formData.value.company_token = selectedModalAccount.value
    }
    
    // Get account name if not set
    if (!formData.value.account_name) {
      const account = userAccounts.value.find(acc => acc.company_token === formData.value.company_token)
      formData.value.account_name = account?.account_name
    }

    const data = await api.post('/api/utility-costs', formData.value)
    
    if (data.success) {
      console.log('✅ Utility costs saved:', data.data)
      
      // Update local data
      const index = utilityCosts.value.findIndex(cost => cost.company_token === data.data.company_token)
      if (index >= 0) {
        utilityCosts.value[index] = data.data
      } else {
        utilityCosts.value.push(data.data)
      }

      closeModal()
      
      window.showNotification?.({
        type: 'success',
        title: 'Success',
        message: 'Utility costs saved successfully'
      })
    } else {
      throw new Error(data.error || 'Failed to save utility costs')
    }
  } catch (err) {
    console.error('❌ Save utility costs error:', err)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: err.message
    })
  } finally {
    saving.value = false
  }
}

const deleteCost = async (cost) => {
  if (!confirm(`Are you sure you want to delete utility costs for ${cost.account_name}?`)) {
    return
  }

  try {
    const data = await api.delete(`/api/utility-costs/${cost.company_token}`)
    
    if (data.success) {
      console.log('✅ Utility costs deleted:', cost.company_token)
      
      // Remove from local data
      utilityCosts.value = utilityCosts.value.filter(c => c.company_token !== cost.company_token)
      
      window.showNotification?.({
        type: 'success',
        title: 'Success',
        message: 'Utility costs deleted successfully'
      })
    } else {
      throw new Error(data.error || 'Failed to delete utility costs')
    }
  } catch (err) {
    console.error('❌ Delete utility costs error:', err)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: err.message
    })
  }
}

// Load company accounts for selection using admin API
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

// Modal management methods
const onModalAccountChange = () => {
  // Load payment method costs when account changes
  if (selectedModalAccount.value) {
    loadPaymentMethodCosts()
    // If editing, update form data
    if (editingCost.value) {
      formData.value.company_token = selectedModalAccount.value
      const account = userAccounts.value.find(acc => acc.company_token === selectedModalAccount.value)
      if (account) {
        formData.value.account_name = account.account_name
      }
    }
  }
}

// Payment method costs methods
const getSelectedAccountName = () => {
  const account = userAccounts.value.find(acc => acc.company_token === selectedModalAccount.value)
  return account ? account.account_name : ''
}

const loadPaymentMethodCosts = async () => {
  if (!selectedModalAccount.value) {
    accountPaymentCosts.value = []
    return
  }

  try {
    const data = await api.getPaymentMethodCosts(selectedModalAccount.value)
    if (data.success) {
      // Only show payment methods that are actually configured (saved in database)
      accountPaymentCosts.value = data.data || []
      console.log('💳 Payment method costs loaded:', data.data)
    } else {
      throw new Error(data.error || 'Failed to load payment method costs')
    }
  } catch (err) {
    console.error('❌ Payment method costs fetch error:', err)
    accountPaymentCosts.value = []
  }
}

const addDefaultPaymentMethods = () => {
  const commonMethods = getCommonPaymentMethods()
  const existingCodes = accountPaymentCosts.value.map(cost => cost.payment_method_code)
  
  // Add only common methods that don't already exist
  for (const method of commonMethods) {
    if (!existingCodes.includes(method.code)) {
      accountPaymentCosts.value.push({
        payment_method_code: method.code,
        cost_percentage: method.defaultPercentage,
        fixed_cost: method.defaultFixed,
        company_token: selectedModalAccount.value,
        isNew: true // Mark as new/unsaved
      })
    }
  }
}

const addPaymentMethodCost = () => {
  if (!newPaymentMethod.value.code) return
  
  // Check if payment method already exists
  const existingCodes = accountPaymentCosts.value.map(cost => cost.payment_method_code)
  if (existingCodes.includes(newPaymentMethod.value.code)) {
    window.showNotification?.({
      type: 'error',
      title: 'Payment Method Exists',
      message: 'This payment method is already configured for this account'
    })
    return
  }
  
  accountPaymentCosts.value.push({
    payment_method_code: newPaymentMethod.value.code,
    cost_percentage: newPaymentMethod.value.percentage || 0,
    fixed_cost: newPaymentMethod.value.fixedCost || 0,
    company_token: selectedModalAccount.value,
    isNew: true // Mark as new/unsaved
  })
  
  // Reset form
  newPaymentMethod.value = {
    code: '',
    percentage: 0,
    fixedCost: 0
  }
}



const removePaymentMethodCost = async (cost) => {
  // If it's a new/unsaved cost, just remove from array
  if (cost.isNew) {
    const index = accountPaymentCosts.value.findIndex(
      c => c.payment_method_code === cost.payment_method_code
    )
    if (index >= 0) {
      accountPaymentCosts.value.splice(index, 1)
    }
    return
  }
  
  // If it's saved in database, delete it from backend
  try {
    const data = await api.deletePaymentMethodCost(selectedModalAccount.value, cost.payment_method_code)
    if (data.success) {
      // Remove from local array
      const index = accountPaymentCosts.value.findIndex(
        c => c.payment_method_code === cost.payment_method_code
      )
      if (index >= 0) {
        accountPaymentCosts.value.splice(index, 1)
      }
      
      // Update the main page data
      allPaymentMethodCosts.value.set(selectedModalAccount.value, accountPaymentCosts.value)
      
      window.showNotification?.({
        type: 'success',
        title: 'Payment Method Removed',
        message: `${formatPaymentMethodName(cost.payment_method_code)} cost configuration deleted`
      })
    } else {
      throw new Error(data.error || 'Failed to delete payment method cost')
    }
  } catch (err) {
    console.error('❌ Error removing payment method cost:', err)
    window.showNotification?.({
      type: 'error',
      title: 'Delete Failed',
      message: err.message
    })
  }
}

const markAsModified = (cost) => {
  // Mark cost as modified if it's not already new
  if (!cost.isNew) {
    cost.isModified = true
  }
}

const saveAllPaymentMethodCosts = async () => {
  if (!selectedModalAccount.value) return
  
  savingPaymentCosts.value = true
  
  try {
    // Filter out only costs that need to be saved (new or modified)
    const costsToSave = accountPaymentCosts.value.filter(cost => cost.isNew || cost.isModified)
    
    if (costsToSave.length === 0) {
      window.showNotification?.({
        type: 'info',
        title: 'No Changes',
        message: 'No payment method costs to save'
      })
      return
    }
    
    const data = await api.bulkUpdatePaymentMethodCosts(
      selectedModalAccount.value, 
      costsToSave
    )
    
    if (data.success) {
      console.log('✅ Payment method costs saved:', data.data)
      
      // Remove the isNew and isModified flags from saved costs
      accountPaymentCosts.value.forEach(cost => {
        delete cost.isNew
        delete cost.isModified
      })
      
      // Update the main page data
      allPaymentMethodCosts.value.set(selectedModalAccount.value, accountPaymentCosts.value)
      
      window.showNotification?.({
        type: 'success',
        title: 'Payment Costs Saved',
        message: `${costsToSave.length} payment method cost(s) updated successfully`
      })
    } else {
      throw new Error(data.error || 'Failed to save payment method costs')
    }
  } catch (err) {
    console.error('❌ Error saving payment method costs:', err)
    window.showNotification?.({
      type: 'error',
      title: 'Save Failed',
      message: err.message
    })
  } finally {
    savingPaymentCosts.value = false
  }
}



// Watch for auth store changes (handles timing issues)
watch(() => authStore.user, (newUser) => {
  console.log('🔍 Auth store user changed:', newUser)
  if (newUser && newUser.accounts) {
    console.log('   User accounts now available:', newUser.accounts)
  }
}, { immediate: true, deep: true })

// Lifecycle
onMounted(() => {
  console.log('🔍 RentabilityView mounted - debugging user accounts:')
  console.log('   authStore.user:', authStore.user)
  console.log('   authStore.user?.accounts:', authStore.user?.accounts)
  // Load company accounts for this user
  fetchCompanyAccounts()
  console.log('   accounts.value:', accounts.value)
  console.log('   availableAccounts.value:', availableAccounts.value)
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
  @apply w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500;
}

.form-input {
  @apply w-full pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500;
}

.btn-secondary-sm {
  @apply px-2 py-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors;
}

.btn-danger-sm {
  @apply px-2 py-1 text-sm text-red-700 bg-red-100 border border-red-300 rounded hover:bg-red-200 transition-colors;
}
</style>