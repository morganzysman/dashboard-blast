<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-fg-strong">{{ $t('rentability.title') }}</h1>
      <p class="text-sm text-fg-muted mt-1">{{ $t('rentability.subtitle') }}</p>
      <p class="text-xs text-fg-muted mt-2 max-w-2xl leading-relaxed">{{ $t('rentability.perAccountNote') }}</p>
    </div>

    <!-- Add account (admins only) -->
    <div v-if="canManageAccounts" class="card">
      <div class="card-body space-y-3">
        <div>
          <h2 class="text-lg font-medium text-fg-strong">{{ $t('rentability.addAccountTitle') }}</h2>
          <p class="text-sm text-fg-muted">{{ $t('rentability.addAccountHint') }}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label class="form-label">{{ $t('companies.companyToken') }}</label>
            <input
              v-model.trim="newAccount.company_token"
              class="form-input"
              :placeholder="$t('companies.companyToken')"
              @keyup.enter="addAccount"
            />
          </div>
          <div>
            <label class="form-label">{{ $t('companies.accountName') }}</label>
            <input
              v-model.trim="newAccount.account_name"
              class="form-input"
              :placeholder="$t('companies.accountName')"
              @keyup.enter="addAccount"
            />
          </div>
          <div>
            <label class="form-label">{{ $t('companies.apiToken') }}</label>
            <input
              v-model.trim="newAccount.api_token"
              class="form-input"
              :placeholder="$t('companies.apiToken')"
              @keyup.enter="addAccount"
            />
          </div>
          <div>
            <button
              class="btn-primary w-full"
              :disabled="!newAccount.company_token || addingAccount"
              @click="addAccount"
            >
              {{ addingAccount ? $t('common.loading') : $t('companies.addUpdateAccount') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="card">
      <div class="card-body text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-fg-muted">{{ $t('rentability.loading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="card border-red-200 bg-error-bg">
      <div class="card-body text-center py-12">
        <div class="w-16 h-16 bg-error-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-error mb-2">{{ $t('rentability.failedToLoadUtility') }}</h3>
        <p class="text-error mb-4">{{ error }}</p>
        <button @click="fetchUtilityCosts" class="btn-primary">{{ $t('common.tryAgain') }}</button>
      </div>
    </div>

    <!-- Per-account configuration -->
    <div v-if="!loading && !error" class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div v-for="row in allAccountCards" :key="row.company_token" class="card">
        <div class="card-body space-y-4">
          <div class="border-b border-gray-100 pb-3 flex items-start justify-between gap-2">
            <div>
              <h2 class="heading-plain text-lg text-fg-strong">{{ row.account_name }}</h2>
              <p class="text-sm text-fg-muted font-mono">{{ row.company_token }}</p>
            </div>
            <button
              class="btn btn-outline btn-sm whitespace-nowrap"
              :disabled="downloadingQr === row.company_token"
              @click="downloadQr(row)"
            >
              {{ downloadingQr === row.company_token ? $t('common.loading') : $t('payroll.downloadQR') }}
            </button>
          </div>

          <!-- Module: Rentability (utility / fixed costs) -->
          <section class="rounded-md border border-gray-200 p-3 space-y-2" style="background: var(--surface-1);">
            <h3 class="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
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
            <h3 class="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
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

          <!-- Module: Contract / employer legal data (per account) -->
          <section class="rounded-md border border-gray-200 p-3 space-y-2" style="background: var(--surface-1);">
            <h3 class="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.moduleContract') }}
            </h3>
            <AccountContractSettings
              :company-id="companyId"
              :company-token="row.company_token"
              :account-name="row.account_name"
              :initial-country="row.country"
              :initial-employer-info="row.contract_employer_info"
              :countries="contractCountries"
              @saved="onContractSaved"
            />
          </section>

          <!-- Module: API access (country-gated, self-service API key) -->
          <section
            v-if="hasApiAccessModule"
            class="rounded-md border border-gray-200 p-3 space-y-2"
            style="background: var(--surface-1);"
          >
            <h3 class="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
              {{ $t('rentability.moduleApiAccess') }}
            </h3>
            <AccountApiSettings
              :company-token="row.company_token"
              :account-name="row.account_name"
              :initial-api-token="accountApiKeys[row.company_token] || ''"
              :initial-public-api-key="accountPublicApiKeys[row.company_token] || ''"
              @saved="onApiKeySaved"
            />
          </section>
        </div>
      </div>

      <div v-if="allAccountCards.length === 0" class="col-span-full card border-dashed">
        <div class="card-body text-center py-12 text-fg-muted">
          {{ $t('rentability.noAccountsToConfigure') }}
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
import AccountRentabilitySettings from '../components/AccountRentabilitySettings.vue'
import AccountApiSettings from '../components/AccountApiSettings.vue'
import AccountContractSettings from '../components/AccountContractSettings.vue'
import { downloadAccountQr } from '../utils/qr'

const { t } = useI18n()
const authStore = useAuthStore()

const downloadingQr = ref('')
const downloadQr = async (row) => {
  if (!row?.company_token || downloadingQr.value) return
  downloadingQr.value = row.company_token
  try {
    await downloadAccountQr({
      companyToken: row.company_token,
      accountName: row.account_name,
      sessionId: authStore.sessionId,
      t
    })
  } finally {
    downloadingQr.value = ''
  }
}

const companyId = computed(() => authStore.user?.company_id || authStore.user?.companyId || null)
const contractCountries = ref([])

// Only company admins may create accounts (backend enforces super-admin/admin
// on POST /api/admin/companies/:companyId/accounts for their own company).
const canManageAccounts = computed(() => authStore.isAdmin)
const newAccount = ref({ company_token: '', account_name: '', api_token: '' })
const addingAccount = ref(false)

const addAccount = async () => {
  if (!companyId.value || !newAccount.value.company_token || addingAccount.value) return
  addingAccount.value = true
  try {
    const res = await api.upsertCompanyAccount(companyId.value, { ...newAccount.value })
    if (res?.success) {
      newAccount.value = { company_token: '', account_name: '', api_token: '' }
      await Promise.all([fetchCompanyAccounts(), fetchAccountApiKeys()])
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: t('rentability.accountAdded')
      })
    } else {
      window.showNotification?.({
        type: 'error',
        title: t('common.error'),
        message: res?.error || t('rentability.addAccountFailed')
      })
    }
  } catch (e) {
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: e?.message || t('rentability.addAccountFailed')
    })
  } finally {
    addingAccount.value = false
  }
}

const utilityCosts = ref([])
const accounts = ref([])
const loading = ref(false)
const error = ref('')

// Self-service API key module is only available when the tenant's country
// unlocks it (server/config/featureModules.js -> 'account-api-access').
const hasApiAccessModule = computed(() => authStore.hasModule('account-api-access'))
const accountApiKeys = ref({}) // { [company_token]: api_token }
const accountPublicApiKeys = ref({}) // { [company_token]: public_api_key }

const allAccountCards = computed(() => {
  const list = []
  const seen = new Set()
  for (const a of accounts.value) {
    const ut = utilityCosts.value.find((c) => c.company_token === a.company_token) || null
    list.push({
      company_token: a.company_token,
      account_name: a.account_name || a.company_token,
      country: a.country || 'PE',
      contract_employer_info: a.contract_employer_info || {},
      utilityRecord: ut
    })
    seen.add(a.company_token)
  }
  for (const c of utilityCosts.value) {
    if (!seen.has(c.company_token)) {
      list.push({
        company_token: c.company_token,
        account_name: c.account_name || c.company_token,
        country: 'PE',
        contract_employer_info: {},
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
    const publicMap = {}
    for (const a of res?.data || []) {
      map[a.company_token] = a.api_token || ''
      publicMap[a.company_token] = a.public_api_key || ''
    }
    accountApiKeys.value = map
    accountPublicApiKeys.value = publicMap
  } catch (e) {
    accountApiKeys.value = {}
    accountPublicApiKeys.value = {}
  }
}

const onApiKeySaved = ({ company_token, api_token, public_api_key }) => {
  accountApiKeys.value = { ...accountApiKeys.value, [company_token]: api_token || '' }
  accountPublicApiKeys.value = { ...accountPublicApiKeys.value, [company_token]: public_api_key || '' }
}

const fetchContractConfig = async () => {
  try {
    const res = await api.getContractConfig()
    contractCountries.value = res?.data?.countries || []
  } catch (e) {
    contractCountries.value = []
  }
}

const onContractSaved = ({ company_token, country, contract_employer_info }) => {
  const idx = accounts.value.findIndex((a) => a.company_token === company_token)
  if (idx >= 0) {
    accounts.value[idx] = { ...accounts.value[idx], country, contract_employer_info }
  }
}

onMounted(async () => {
  await fetchCompanyAccounts()
  fetchUtilityCosts()
  fetchAccountApiKeys()
  fetchContractConfig()
})
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style>
