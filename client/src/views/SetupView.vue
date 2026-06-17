<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('rentability.title') }}</h1>
      <p class="text-sm text-gray-600 mt-1">{{ $t('rentability.subtitle') }}</p>
      <p class="text-xs text-gray-500 mt-2 max-w-2xl leading-relaxed">{{ $t('rentability.perAccountNote') }}</p>
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

    <!-- Per-account configuration -->
    <div v-if="!loading && !error" class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div v-for="row in allAccountCards" :key="row.company_token" class="card">
        <div class="card-body space-y-4">
          <div class="border-b border-gray-100 pb-3">
            <h2 class="text-lg font-medium text-gray-900">{{ row.account_name }}</h2>
            <p class="text-sm text-gray-500 font-mono">{{ row.company_token }}</p>
          </div>

          <!-- Module: Rentability (utility / fixed costs) -->
          <section class="rounded-md border border-gray-200 p-3 space-y-2" style="background: var(--surface-1);">
            <h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.moduleRentability') }}
            </h3>
            <AccountRentabilitySettings
              section="utility"
              compact
              :company-token="row.company_token"
              :account-name="row.account_name"
              :initial-utility-record="row.utilityRecord"
              @utility-saved="onUtilitySaved"
              @utility-deleted="onUtilityDeleted"
            />
          </section>

          <!-- Module: Payments -->
          <section class="rounded-md border border-gray-200 p-3 space-y-2" style="background: var(--surface-1);">
            <h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.modulePayments') }}
            </h3>
            <AccountRentabilitySettings
              section="payment"
              compact
              :company-token="row.company_token"
              :account-name="row.account_name"
              :initial-utility-record="row.utilityRecord"
            />
          </section>

          <!-- Module: SLA -->
          <section class="rounded-md border border-gray-200 p-3 space-y-2" style="background: var(--surface-1);">
            <h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.moduleSla') }}
            </h3>
            <AccountSlaGoalsForm
              :company-token="row.company_token"
              :kitchen-sla-response="kitchenSlaResponse"
              :loading="kitchenSlaLoading"
              @saved="onKitchenSlaSaved"
            />
          </section>

          <!-- Module: API access (country-gated, self-service API key) -->
          <section
            v-if="hasApiAccessModule"
            class="rounded-md border border-gray-200 p-3 space-y-2"
            style="background: var(--surface-1);"
          >
            <h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.moduleApiAccess') }}
            </h3>
            <AccountApiSettings
              :company-token="row.company_token"
              :account-name="row.account_name"
              :initial-api-token="accountApiKeys[row.company_token] || ''"
              @saved="onApiKeySaved"
            />
          </section>
        </div>
      </div>

      <div v-if="allAccountCards.length === 0" class="col-span-full card border-dashed">
        <div class="card-body text-center py-12 text-gray-600">
          {{ $t('rentability.noAccountsToConfigure') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import AccountRentabilitySettings from '../components/AccountRentabilitySettings.vue'
import AccountSlaGoalsForm from '../components/AccountSlaGoalsForm.vue'
import AccountApiSettings from '../components/AccountApiSettings.vue'

const authStore = useAuthStore()

const utilityCosts = ref([])
const accounts = ref([])
const loading = ref(false)
const error = ref('')
const kitchenSlaResponse = ref(null)
const kitchenSlaLoading = ref(false)

// Self-service API key module is only available when the tenant's country
// unlocks it (server/config/featureModules.js -> 'account-api-access').
const hasApiAccessModule = computed(() => authStore.hasModule('account-api-access'))
const accountApiKeys = ref({}) // { [company_token]: api_token }

const allAccountCards = computed(() => {
  const list = []
  const seen = new Set()
  for (const a of accounts.value) {
    const ut = utilityCosts.value.find((c) => c.company_token === a.company_token) || null
    list.push({
      company_token: a.company_token,
      account_name: a.account_name || a.company_token,
      utilityRecord: ut
    })
    seen.add(a.company_token)
  }
  for (const c of utilityCosts.value) {
    if (!seen.has(c.company_token)) {
      list.push({
        company_token: c.company_token,
        account_name: c.account_name || c.company_token,
        utilityRecord: c
      })
    }
  }
  return list.sort((a, b) =>
    (a.account_name || '').localeCompare(b.account_name || '', undefined, { sensitivity: 'base' })
  )
})

const fetchUtilityCosts = async () => {
  loading.value = true
  error.value = ''

  try {
    const data = await api.get('/api/utility-costs')
    if (data.success) {
      utilityCosts.value = data.data
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

const onUtilitySaved = (data) => {
  const index = utilityCosts.value.findIndex((cost) => cost.company_token === data.company_token)
  if (index >= 0) {
    utilityCosts.value[index] = data
  } else {
    utilityCosts.value.push(data)
  }
}

const onUtilityDeleted = (token) => {
  utilityCosts.value = utilityCosts.value.filter((c) => c.company_token !== token)
}

const fetchKitchenSla = async () => {
  kitchenSlaLoading.value = true
  try {
    const data = await api.getKitchenSla()
    kitchenSlaResponse.value = data?.success ? data : null
  } catch (e) {
    console.warn('kitchen-sla fetch failed', e)
    kitchenSlaResponse.value = null
  } finally {
    kitchenSlaLoading.value = false
  }
}

const onKitchenSlaSaved = async () => {
  await fetchKitchenSla()
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

const fetchAccountApiKeys = async () => {
  if (!hasApiAccessModule.value) return
  try {
    const res = await api.getAccountSettings()
    const map = {}
    for (const a of res?.data || []) {
      map[a.company_token] = a.api_token || ''
    }
    accountApiKeys.value = map
  } catch (e) {
    accountApiKeys.value = {}
  }
}

const onApiKeySaved = ({ company_token, api_token }) => {
  accountApiKeys.value = { ...accountApiKeys.value, [company_token]: api_token || '' }
}

onMounted(async () => {
  await fetchCompanyAccounts()
  fetchKitchenSla()
  fetchUtilityCosts()
  fetchAccountApiKeys()
})
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style>
