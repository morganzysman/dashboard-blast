<template>
  <div class="account-rentability-settings" :class="{ compact }">
    <!-- Tabs: full modal style vs compact pills (only when showing both sections) -->
    <div v-if="showTabs && !compact" class="border-b border-gray-200/80 -mx-1 mb-4">
      <nav class="-mb-px flex flex-wrap gap-2 sm:gap-6 px-1" aria-label="Tabs">
        <button
          type="button"
          @click="activeTab = 'utility'"
          :class="tabBtnClass('utility')"
        >
          🏠 {{ $t('rentability.utilityCosts') }}
        </button>
        <button
          type="button"
          @click="activeTab = 'payment'"
          :class="tabBtnClass('payment')"
        >
          💳 {{ $t('rentability.paymentMethodCosts') }}
        </button>
      </nav>
    </div>
    <div v-else-if="showTabs && compact" class="flex flex-wrap gap-1.5 mb-3">
      <button type="button" @click="activeTab = 'utility'" :class="pillClass('utility')">
        🏠 {{ $t('rentability.utilityCosts') }}
      </button>
      <button type="button" @click="activeTab = 'payment'" :class="pillClass('payment')">
        💳 {{ $t('rentability.paymentMethodCosts') }}
      </button>
    </div>

    <div v-if="showTabs && !compact" class="mb-4 px-1">
      <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('rentability.account') }}</label>
      <div class="px-3 py-2 rounded-xl text-sm text-gray-700 embedded-account-label">
        {{ accountName || companyToken }}
      </div>
    </div>

    <!-- Utility -->
    <div v-show="showUtilityPanel" class="space-y-4">
      <form @submit.prevent="saveCosts">
        <div :class="compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'grid grid-cols-1 md:grid-cols-2 gap-4'">
          <div v-for="field in costFields" :key="field.key" :class="compact ? 'mb-0' : 'mb-4'">
            <label class="block font-medium text-gray-700 mb-1" :class="compact ? 'text-[10px]' : 'text-sm'">
              {{ $t(`rentability.costFields.${field.key}`) }} ({{ $t('common.monthly') }})
            </label>
            <div class="relative">
              <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{{ currencySymbol }}</span>
              <input
                type="number"
                v-model.number="formData[field.key]"
                :class="compact ? 'ars-input-compact pl-8' : 'ars-input pl-10'"
                min="0"
                step="0.01"
                :placeholder="field.placeholder"
              />
            </div>
          </div>
        </div>

        <div :class="compact ? 'rounded-lg p-2 mb-2 bg-blue-50/80' : 'rounded-xl p-4 mb-6 bg-blue-50/50'">
          <div class="grid grid-cols-2 gap-2 text-center">
            <div>
              <p :class="compact ? 'text-sm font-bold text-blue-600' : 'text-lg font-bold text-blue-600'">
                {{ formatCurrency(totalMonthlyCosts) }}
              </p>
              <p :class="compact ? 'text-[9px] text-blue-500' : 'text-xs text-blue-500'">{{ $t('rentability.totalMonthly') }}</p>
            </div>
            <div>
              <p :class="compact ? 'text-sm font-bold text-green-600' : 'text-lg font-bold text-green-600'">
                {{ formatCurrency(totalMonthlyCosts / 30) }}
              </p>
              <p :class="compact ? 'text-[9px] text-green-500' : 'text-xs text-green-500'">{{ $t('rentability.totalDaily') }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2" :class="compact ? 'pt-2 border-t border-gray-100' : 'pt-6 border-t border-gray-200'">
          <button
            v-if="initialUtilityRecord && showDeleteUtility"
            type="button"
            @click="deleteUtilityCosts"
            class="btn-danger-text"
            :class="compact ? 'text-[11px]' : 'text-sm'"
            :disabled="saving"
          >
            {{ $t('common.delete') }}
          </button>
          <button type="submit" :disabled="saving || !companyToken" :class="compact ? 'btn-teal-xs' : 'btn-primary-modal'">
            <span v-if="saving" class="inline-flex items-center gap-1">
              <span class="loading-spinner-sm" />
              {{ $t('common.saving') }}
            </span>
            <span v-else>{{ $t('common.save') }} {{ $t('rentability.utilityCosts') }}</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Payment methods -->
    <div v-show="showPaymentPanel" class="space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 v-if="!compact" class="text-lg font-medium text-gray-900">
          {{ $t('rentability.paymentProcessingCosts') }}
        </h3>
        <button
          type="button"
          @click="addDefaultPaymentMethods"
          :class="compact ? 'btn-secondary-xs' : 'btn-secondary-sm'"
          :disabled="accountPaymentCosts.length > 0"
          :title="
            accountPaymentCosts.length > 0 ? $t('rentability.clearExistingFirst') : $t('rentability.addDefaultMethodsTooltip')
          "
     >
          {{ $t('rentability.addCommonMethods') }}
        </button>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="min-w-full divide-y divide-gray-200 text-left">
          <thead :class="compact ? 'bg-gray-50 text-[10px]' : 'bg-gray-50/50'">
            <tr>
              <th class="px-2 py-2 font-medium text-gray-500 uppercase">{{ $t('rentability.paymentMethod') }}</th>
              <th class="px-2 py-2 font-medium text-gray-500 uppercase">{{ $t('rentability.percentage') }} (%)</th>
              <th class="px-2 py-2 font-medium text-gray-500 uppercase">{{ $t('rentability.fixedCost') }}</th>
              <th class="px-2 py-2 font-medium text-gray-500 uppercase">{{ $t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="cost in accountPaymentCosts" :key="cost.payment_method_code" :class="{ 'bg-amber-50/60': cost.isNew }">
              <td class="px-2 py-2 whitespace-nowrap">
                <span :class="compact ? 'text-[11px] font-medium' : 'text-sm font-medium'">{{ formatPaymentMethodName(cost.payment_method_code) }}</span>
                <span v-if="cost.isNew" class="ml-1 text-[10px] text-amber-800">({{ $t('common.new') }})</span>
              </td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  v-model.number="cost.cost_percentage"
                  :class="compact ? 'ars-input-compact w-16' : 'ars-input w-20 text-sm'"
                  min="0"
                  max="100"
                  step="0.01"
                  @input="markAsModified(cost)"
                />
              </td>
              <td class="px-2 py-2">
                <div class="flex items-center gap-0.5">
                  <span class="text-gray-400 text-xs">{{ currencySymbol }}</span>
                  <input
                    type="number"
                    v-model.number="cost.fixed_cost"
                    :class="compact ? 'ars-input-compact w-16' : 'ars-input w-20 text-sm'"
                    min="0"
                    step="0.01"
                    @input="markAsModified(cost)"
                  />
                </div>
              </td>
              <td class="px-2 py-2">
                <button type="button" @click="removePaymentMethodCost(cost)" class="btn-danger-icon" :title="cost.isNew ? $t('rentability.removeFromList') : $t('rentability.deleteFromDatabase')">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
            <tr v-if="accountPaymentCosts.length === 0">
              <td colspan="4" :class="compact ? 'px-2 py-4 text-center text-[11px] text-gray-500' : 'px-6 py-8 text-center text-gray-500'">
                {{ $t('rentability.noPaymentMethods') }}<br />
                <span :class="compact ? 'text-[10px]' : 'text-sm'">{{ $t('rentability.useAddCommonMethods') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-gray-200 pt-3 space-y-2">
        <div :class="compact ? 'grid grid-cols-2 gap-2 items-end' : 'grid grid-cols-1 md:grid-cols-4 gap-4 items-end'">
          <div class="md:col-span-1 col-span-2">
            <label class="block text-[10px] font-medium text-gray-600 mb-0.5">{{ $t('rentability.paymentMethod') }}</label>
            <select v-model="newPaymentMethod.code" class="ars-select w-full text-xs">
              <option value="">{{ $t('rentability.selectMethod') }}</option>
              <option v-for="method in availablePaymentMethods" :key="method.code" :value="method.code">
                {{ method.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-medium text-gray-600 mb-0.5">{{ $t('rentability.percentage') }} (%)</label>
            <input type="number" v-model.number="newPaymentMethod.percentage" class="ars-input-compact w-full" min="0" max="100" step="0.01" placeholder="0" />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-gray-600 mb-0.5">{{ $t('rentability.fixedCost') }}</label>
            <div class="relative">
              <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{{ currencySymbol }}</span>
              <input type="number" v-model.number="newPaymentMethod.fixedCost" class="ars-input-compact w-full pl-7" min="0" step="0.01" placeholder="0" />
            </div>
          </div>
          <div>
            <button type="button" @click="addPaymentMethodCost" :disabled="!newPaymentMethod.code" class="btn-teal-xs w-full">
              {{ $t('common.add') }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-3 border-t border-gray-200">
        <button
          type="button"
          @click="saveAllPaymentMethodCosts"
          :disabled="!companyToken || savingPaymentCosts || !hasUnsavedChanges"
          :class="[compact ? 'btn-teal-xs' : 'btn-primary-modal', { 'opacity-50': !hasUnsavedChanges }]"
        >
          <span v-if="savingPaymentCosts" class="inline-flex items-center gap-1">
            <span class="loading-spinner-sm" />
            {{ $t('common.saving') }}
          </span>
          <span v-else>
            {{ $t('rentability.savePaymentCosts') }}
            <span v-if="hasUnsavedChanges" class="ml-1 text-[10px]">({{ unsavedCount }})</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import { getCommonPaymentMethods, formatPaymentMethodName } from '../utils/paymentMethods'

const props = defineProps({
  companyToken: { type: String, required: true },
  accountName: { type: String, default: '' },
  initialUtilityRecord: { type: Object, default: null },
  compact: { type: Boolean, default: false },
  showDeleteUtility: { type: Boolean, default: true },
  /** Show both utility + payment with tabs, or a single section only (for embedded modules). */
  section: {
    type: String,
    default: 'both',
    validator: (v) => ['both', 'utility', 'payment'].includes(v)
  }
})

const emit = defineEmits(['utility-saved', 'utility-deleted', 'payment-costs-saved'])

const authStore = useAuthStore()
const { t } = useI18n()

const activeTab = ref('utility')

const showTabs = computed(() => props.section === 'both')

const showUtilityPanel = computed(() => {
  if (props.section === 'utility') return true
  if (props.section === 'both') return activeTab.value === 'utility'
  return false
})

const showPaymentPanel = computed(() => {
  if (props.section === 'payment') return true
  if (props.section === 'both') return activeTab.value === 'payment'
  return false
})

watch(
  () => props.section,
  (s) => {
    if (s === 'utility') activeTab.value = 'utility'
    if (s === 'payment') activeTab.value = 'payment'
  },
  { immediate: true }
)
const saving = ref(false)
const accountPaymentCosts = ref([])
const savingPaymentCosts = ref(false)
const newPaymentMethod = ref({ code: '', percentage: 0, fixedCost: 0 })

const emptyMonthlyFields = () => ({
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

const formData = ref({
  company_token: '',
  account_name: '',
  ...emptyMonthlyFields()
})

const costFields = [
  { key: 'rent_monthly', placeholder: '0.00' },
  { key: 'electricity_monthly', placeholder: '0.00' },
  { key: 'water_monthly', placeholder: '0.00' },
  { key: 'internet_monthly', placeholder: '0.00' },
  { key: 'gas_monthly', placeholder: '0.00' },
  { key: 'insurance_monthly', placeholder: '0.00' },
  { key: 'maintenance_monthly', placeholder: '0.00' },
  { key: 'staff_monthly', placeholder: '0.00' },
  { key: 'marketing_monthly', placeholder: '0.00' },
  { key: 'other_monthly', placeholder: '0.00' }
]

const currencySymbol = computed(() => authStore.user?.currencySymbol || 'S/')

const totalMonthlyCosts = computed(() => {
  return Object.keys(formData.value).reduce((total, key) => {
    if (key.endsWith('_monthly')) {
      return total + (Number(formData.value[key]) || 0)
    }
    return total
  }, 0)
})

const availablePaymentMethods = computed(() => {
  const existingCodes = accountPaymentCosts.value.map((cost) => cost.payment_method_code)
  return getCommonPaymentMethods().filter((method) => !existingCodes.includes(method.code))
})

const hasUnsavedChanges = computed(() => {
  return accountPaymentCosts.value.some((cost) => cost.isNew || cost.isModified)
})

const unsavedCount = computed(() => {
  return accountPaymentCosts.value.filter((cost) => cost.isNew || cost.isModified).length
})

function hydrateForm() {
  const rec = props.initialUtilityRecord
  formData.value = {
    company_token: props.companyToken,
    account_name: props.accountName || rec?.account_name || '',
    rent_monthly: rec?.rent_monthly ?? 0,
    electricity_monthly: rec?.electricity_monthly ?? 0,
    water_monthly: rec?.water_monthly ?? 0,
    internet_monthly: rec?.internet_monthly ?? 0,
    gas_monthly: rec?.gas_monthly ?? 0,
    insurance_monthly: rec?.insurance_monthly ?? 0,
    maintenance_monthly: rec?.maintenance_monthly ?? 0,
    staff_monthly: rec?.staff_monthly ?? 0,
    marketing_monthly: rec?.marketing_monthly ?? 0,
    other_monthly: rec?.other_monthly ?? 0
  }
}

watch(
  () => [props.companyToken, props.accountName, props.initialUtilityRecord, props.section],
  () => {
    hydrateForm()
    if (props.section !== 'utility') loadPaymentMethodCosts()
  },
  { deep: true, immediate: true }
)

const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return `${currencySymbol.value} ${num.toFixed(2)}`
}

function tabBtnClass(id) {
  return [
    'whitespace-nowrap py-3 px-2 border-b-2 text-sm font-medium transition-colors',
    activeTab.value === id
      ? 'border-primary-500 text-primary-600'
      : 'border-transparent text-gray-500 hover:text-gray-700'
  ]
}

function pillClass(id) {
  return [
    'px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors',
    activeTab.value === id
      ? 'border-teal-500 bg-teal-50 text-teal-800'
      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
  ]
}

const saveCosts = async () => {
  saving.value = true
  try {
    formData.value.company_token = props.companyToken
    if (!formData.value.account_name) {
      formData.value.account_name = props.accountName
    }

    const data = await api.post('/api/utility-costs', formData.value)

    if (data.success) {
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: t('rentability.utilityCostsSaved')
      })
      emit('utility-saved', data.data)
    } else {
      throw new Error(data.error || 'Failed to save utility costs')
    }
  } catch (err) {
    console.error('Save utility error:', err)
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: err.message || String(err)
    })
  } finally {
    saving.value = false
  }
}

const deleteUtilityCosts = async () => {
  if (!props.initialUtilityRecord) return
  if (!confirm(t('rentability.confirmDeleteUtility', { accountName: props.accountName || props.companyToken }))) {
    return
  }
  saving.value = true
  try {
    const data = await api.delete(`/api/utility-costs/${props.companyToken}`)
    if (data.success) {
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: t('rentability.utilityCostsDeleted')
      })
      emit('utility-deleted', props.companyToken)
      formData.value = {
        company_token: props.companyToken,
        account_name: props.accountName,
        ...emptyMonthlyFields()
      }
    } else {
      throw new Error(data.error || 'Failed to delete')
    }
  } catch (err) {
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: err.message || String(err)
    })
  } finally {
    saving.value = false
  }
}

const loadPaymentMethodCosts = async () => {
  if (!props.companyToken) {
    accountPaymentCosts.value = []
    return
  }
  try {
    const data = await api.getPaymentMethodCosts(props.companyToken)
    if (data.success) {
      accountPaymentCosts.value = data.data || []
    } else {
      throw new Error(data.error || 'Failed to load payment costs')
    }
  } catch (err) {
    console.warn('Payment costs load:', err)
    accountPaymentCosts.value = []
  }
}

const addDefaultPaymentMethods = () => {
  const commonMethods = getCommonPaymentMethods()
  const existingCodes = accountPaymentCosts.value.map((c) => c.payment_method_code)
  for (const method of commonMethods) {
    if (!existingCodes.includes(method.code)) {
      accountPaymentCosts.value.push({
        payment_method_code: method.code,
        cost_percentage: method.defaultPercentage,
        fixed_cost: method.defaultFixed,
        company_token: props.companyToken,
        isNew: true
      })
    }
  }
}

const addPaymentMethodCost = () => {
  if (!newPaymentMethod.value.code) return
  const existingCodes = accountPaymentCosts.value.map((c) => c.payment_method_code)
  if (existingCodes.includes(newPaymentMethod.value.code)) {
    window.showNotification?.({
      type: 'error',
      title: t('rentability.paymentMethodExistsTitle'),
      message: t('rentability.paymentMethodExists')
    })
    return
  }
  accountPaymentCosts.value.push({
    payment_method_code: newPaymentMethod.value.code,
    cost_percentage: newPaymentMethod.value.percentage || 0,
    fixed_cost: newPaymentMethod.value.fixedCost || 0,
    company_token: props.companyToken,
    isNew: true
  })
  newPaymentMethod.value = { code: '', percentage: 0, fixedCost: 0 }
}

const removePaymentMethodCost = async (cost) => {
  if (cost.isNew) {
    const i = accountPaymentCosts.value.findIndex((c) => c.payment_method_code === cost.payment_method_code)
    if (i >= 0) accountPaymentCosts.value.splice(i, 1)
    return
  }
  try {
    const data = await api.deletePaymentMethodCost(props.companyToken, cost.payment_method_code)
    if (data.success) {
      const i = accountPaymentCosts.value.findIndex((c) => c.payment_method_code === cost.payment_method_code)
      if (i >= 0) accountPaymentCosts.value.splice(i, 1)
      window.showNotification?.({
        type: 'success',
        title: t('rentability.paymentMethodRemoved'),
        message: t('rentability.paymentMethodDeleted', { method: formatPaymentMethodName(cost.payment_method_code) })
      })
      emit('payment-costs-saved')
    } else {
      throw new Error(data.error || 'Failed to delete')
    }
  } catch (err) {
    window.showNotification?.({
      type: 'error',
      title: t('common.deleteFailed'),
      message: err.message || String(err)
    })
  }
}

const markAsModified = (cost) => {
  if (!cost.isNew) cost.isModified = true
}

const saveAllPaymentMethodCosts = async () => {
  if (!props.companyToken) return
  savingPaymentCosts.value = true
  try {
    const costsToSave = accountPaymentCosts.value.filter((cost) => cost.isNew || cost.isModified)
    if (costsToSave.length === 0) {
      window.showNotification?.({
        type: 'info',
        title: t('rentability.noChangesTitle'),
        message: t('rentability.noPaymentCostsToSave')
      })
      return
    }
    const data = await api.bulkUpdatePaymentMethodCosts(props.companyToken, costsToSave)
    if (data.success) {
      accountPaymentCosts.value.forEach((cost) => {
        delete cost.isNew
        delete cost.isModified
      })
      window.showNotification?.({
        type: 'success',
        title: t('rentability.paymentCostsSavedTitle'),
        message: t('rentability.paymentCostsUpdated', { count: costsToSave.length })
      })
      emit('payment-costs-saved')
    } else {
      throw new Error(data.error || 'Failed to save')
    }
  } catch (err) {
    window.showNotification?.({
      type: 'error',
      title: t('common.saveFailed'),
      message: err.message || String(err)
    })
  } finally {
    savingPaymentCosts.value = false
  }
}
</script>

<style scoped>
.embedded-account-label {
  background: rgba(249, 250, 251, 0.5);
  border: 1px solid rgba(229, 231, 235, 0.4);
}

.ars-input,
.ars-input-compact {
  @apply w-full rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(209, 213, 219, 0.7);
}

.ars-input {
  @apply pr-3 py-2;
}
.ars-input-compact {
  @apply py-1 px-2 text-xs;
}

.ars-select {
  @apply rounded-lg py-1 px-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(209, 213, 219, 0.7);
}

.btn-primary-modal {
  @apply px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors;
}

.btn-teal-xs {
  @apply px-2 py-1 rounded-lg text-[11px] font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50;
}

.btn-secondary-sm {
  @apply px-2 py-1 text-sm text-gray-700 rounded-xl;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(209, 213, 219, 0.4);
}
.btn-secondary-xs {
  @apply px-2 py-0.5 text-[10px] text-gray-700 rounded-lg;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(209, 213, 219, 0.4);
}

.btn-danger-text {
  @apply text-red-600 hover:text-red-800 disabled:opacity-50 px-2 py-1;
}

.btn-danger-icon {
  @apply p-1 rounded-lg text-red-600 hover:bg-red-50;
}

.loading-spinner-sm {
  @apply inline-block w-3 h-3 border-2 border-gray-300 border-t-white rounded-full animate-spin;
}
</style>
