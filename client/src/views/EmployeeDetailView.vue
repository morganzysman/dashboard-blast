<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button class="btn-secondary btn-sm" @click="goBack">← {{ $t('common.back') }}</button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ user?.name || $t('common.loading') }}</h1>
          <p class="text-sm text-gray-500">{{ user?.email }} · {{ user?.role }} · {{ user?.company_name || '—' }}</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card"><div class="card-body">{{ $t('common.loading') }}</div></div>

    <template v-else-if="user">
      <!-- Payroll -->
      <div class="card">
        <div class="card-body space-y-4">
          <h2 class="text-lg font-semibold">{{ $t('admin.hourlyRate') }} · {{ $t('admin.jobType') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">{{ $t('admin.hourlyRate') }}</label>
              <input v-model.number="form.hourly_rate" type="number" min="0" step="0.01" class="form-input" />
            </div>
            <div>
              <label class="form-label">{{ $t('holidays.hiredAt') }}</label>
              <input v-model="form.hired_at" type="date" class="form-input" />
            </div>
            <div>
              <label class="form-label">{{ $t('admin.jobType') }}</label>
              <select v-model="form.job_type" class="form-input">
                <option value="">—</option>
                <option value="kitchen">{{ $t('admin.jobTypeKitchen') }}</option>
                <option value="waiter">{{ $t('admin.jobTypeWaiter') }}</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end">
            <button class="btn-primary" :disabled="savingPayroll" @click="savePayroll">{{ $t('common.save') }}</button>
          </div>
        </div>
      </div>

      <!-- Contract identity (employee) -->
      <div class="card">
        <div class="card-body space-y-4">
          <h2 class="text-lg font-semibold">{{ $t('contract.employeeData') }}</h2>
          <p class="text-xs text-gray-500">{{ $t('contract.employeeDataHint') }}</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">{{ $t('contract.documentType') }}</label>
              <select v-model="form.document_type" class="form-input">
                <option value="">—</option>
                <option v-for="dt in employeeDocTypes" :key="dt" :value="dt">{{ dt }}</option>
              </select>
            </div>
            <div>
              <label class="form-label">{{ $t('contract.documentNumber') }}</label>
              <input v-model.trim="form.document_number" type="text" class="form-input" />
            </div>
            <div>
              <label class="form-label">{{ $t('contract.address') }}</label>
              <input v-model.trim="form.address" type="text" class="form-input" />
            </div>
          </div>
          <div class="flex justify-end">
            <button class="btn-primary" :disabled="savingContractInfo" @click="saveContractInfo">{{ $t('common.save') }}</button>
          </div>
        </div>
      </div>

      <!-- Generate contract -->
      <div class="card border-primary-200">
        <div class="card-body space-y-4">
          <h2 class="text-lg font-semibold">{{ $t('contract.generateTitle') }}</h2>

          <div v-if="accounts.length === 0" class="text-sm text-gray-500">{{ $t('contract.noAccounts') }}</div>

          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">{{ $t('contract.account') }}</label>
                <select v-model="gen.company_token" class="form-input">
                  <option v-for="a in accounts" :key="a.company_token" :value="a.company_token">
                    {{ a.account_name }} ({{ a.country }})
                  </option>
                </select>
              </div>
              <div>
                <label class="form-label">{{ $t('contract.areaServicio') }}</label>
                <input v-model.trim="gen.area_servicio" type="text" class="form-input" />
              </div>
              <div>
                <label class="form-label">{{ $t('contract.startDate') }}</label>
                <input v-model="gen.start_date" type="date" class="form-input" />
              </div>
              <div>
                <label class="form-label">{{ $t('contract.endDate') }}</label>
                <input v-model="gen.end_date" type="date" class="form-input" />
              </div>
              <div>
                <label class="form-label">{{ $t('contract.hourlyRate') }}</label>
                <input v-model.number="gen.hourly_rate" type="number" min="0" step="0.01" class="form-input" />
              </div>
              <div>
                <label class="form-label">{{ $t('contract.monthlyReference') }}</label>
                <input v-model.number="gen.monthly_reference" type="number" min="0" step="0.01" class="form-input" :placeholder="String(autoMonthly)" />
                <p class="text-xs text-gray-400 mt-1">{{ $t('contract.monthlyReferenceHint', { hours: selectedCountryConfig?.referenceHours || 208 }) }}</p>
              </div>
            </div>

            <!-- Template unavailable warning -->
            <div v-if="selectedCountryConfig && !selectedCountryConfig.available" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              {{ $t('contract.templateUnavailable', { country: selectedCountryConfig.label }) }}
            </div>

            <!-- Missing fields warning -->
            <div v-else-if="missingFields.length" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              <div class="font-medium mb-1">{{ $t('contract.missingFieldsTitle') }}</div>
              <ul class="list-disc ml-5">
                <li v-for="m in missingFields" :key="m">{{ labelForMissing(m) }}</li>
              </ul>
            </div>

            <div class="flex justify-end">
              <button class="btn-primary" :disabled="generating || !canGenerate" @click="downloadContract">
                {{ generating ? $t('common.loading') : $t('contract.downloadPdf') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const user = ref(null)
const accounts = ref([])
const countries = ref([])
const savingPayroll = ref(false)
const savingContractInfo = ref(false)
const generating = ref(false)

const form = reactive({
  hourly_rate: null,
  hired_at: '',
  job_type: '',
  document_type: '',
  document_number: '',
  address: '',
})

const gen = reactive({
  company_token: '',
  area_servicio: '',
  start_date: '',
  end_date: '',
  hourly_rate: null,
  monthly_reference: null,
})

const AREA_BY_JOB = { kitchen: 'cocina', waiter: 'atención al cliente' }

const userId = computed(() => route.params.id)

const selectedAccount = computed(() => accounts.value.find(a => a.company_token === gen.company_token) || null)
const countryByCode = (code) => countries.value.find(c => c.code === (code || '').toUpperCase()) || null
const selectedCountryConfig = computed(() => selectedAccount.value ? countryByCode(selectedAccount.value.country) : null)

// Employee doc-type options driven by the selected account's country (fallback PE/all).
const employeeDocTypes = computed(() => {
  const cfg = selectedCountryConfig.value || countryByCode('PE')
  return cfg?.employeeDocTypes || ['DNI', 'CE', 'Pasaporte']
})

const autoMonthly = computed(() => {
  const hours = selectedCountryConfig.value?.referenceHours || 208
  const rate = Number(gen.hourly_rate)
  return Number.isFinite(rate) && rate > 0 ? Number((rate * hours).toFixed(2)) : 0
})

// Client-side mirror of server validateContractData for instant feedback.
const missingFields = computed(() => {
  const cfg = selectedCountryConfig.value
  if (!cfg || !cfg.available) return []
  const acct = selectedAccount.value
  const employer = acct?.contract_employer_info || {}
  const missing = []
  for (const field of cfg.employerFields) {
    if (field.required && isBlank(employer[field.key])) missing.push(`employer.${field.key}`)
  }
  if (isBlank(form.document_type)) missing.push('employee.document_type')
  if (isBlank(form.document_number)) missing.push('employee.document_number')
  if (isBlank(form.address)) missing.push('employee.address')
  if (isBlank(gen.area_servicio)) missing.push('params.area_servicio')
  if (isBlank(gen.start_date)) missing.push('params.start_date')
  if (isBlank(gen.end_date)) missing.push('params.end_date')
  const rate = Number(gen.hourly_rate)
  if (!Number.isFinite(rate) || rate <= 0) missing.push('params.hourly_rate')
  if (gen.start_date && gen.end_date && gen.end_date < gen.start_date) missing.push('params.end_date')
  return missing
})

const canGenerate = computed(() =>
  !!selectedCountryConfig.value && selectedCountryConfig.value.available && missingFields.value.length === 0
)

function isBlank(v) { return v == null || String(v).trim() === '' }

function labelForMissing(key) {
  const map = {
    'employer.legal_name': 'contract.fields.legalName',
    'employer.tax_id': 'contract.missing.employerTaxId',
    'employer.address': 'contract.fields.employerAddress',
    'employer.rep_name': 'contract.fields.repName',
    'employer.rep_doc_type': 'contract.fields.repDocType',
    'employer.rep_doc_number': 'contract.fields.repDocNumber',
    'employee.document_type': 'contract.documentType',
    'employee.document_number': 'contract.documentNumber',
    'employee.address': 'contract.address',
    'params.area_servicio': 'contract.areaServicio',
    'params.start_date': 'contract.startDate',
    'params.end_date': 'contract.endDate',
    'params.hourly_rate': 'contract.hourlyRate',
  }
  return map[key] || key
}

const goBack = () => router.back()

const load = async () => {
  loading.value = true
  try {
    const [detailRes, cfgRes] = await Promise.all([
      api.getUserDetail(userId.value),
      api.getContractConfig(),
    ])
    countries.value = cfgRes?.data?.countries || []
    const d = detailRes?.data
    user.value = d?.user || null
    accounts.value = d?.accounts || []
    if (user.value) {
      form.hourly_rate = user.value.hourly_rate ?? null
      form.hired_at = user.value.hired_at ? String(user.value.hired_at).slice(0, 10) : ''
      form.job_type = user.value.job_type || ''
      form.document_type = user.value.document_type || ''
      form.document_number = user.value.document_number || ''
      form.address = user.value.address || ''
      // Generate panel prefill
      gen.hourly_rate = user.value.hourly_rate ?? null
      gen.area_servicio = AREA_BY_JOB[user.value.job_type] || ''
    }
    if (accounts.value.length) gen.company_token = accounts.value[0].company_token
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to load' })
  } finally {
    loading.value = false
  }
}

const savePayroll = async () => {
  savingPayroll.value = true
  try {
    if (form.hourly_rate != null) {
      await api.put(`/api/admin/users/${userId.value}/hourly-rate`, { hourly_rate: Number(form.hourly_rate) })
    }
    await api.updateUserHiredAt(userId.value, form.hired_at || null)
    await api.updateUserJobType(userId.value, form.job_type || null)
    window.showNotification?.({ type: 'success', title: 'Success', message: 'Saved' })
    await load()
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to save' })
  } finally {
    savingPayroll.value = false
  }
}

const saveContractInfo = async () => {
  savingContractInfo.value = true
  try {
    await api.updateUserContractInfo(userId.value, {
      document_type: form.document_type || null,
      document_number: form.document_number || null,
      address: form.address || null,
    })
    if (user.value) {
      user.value.document_type = form.document_type
      user.value.document_number = form.document_number
      user.value.address = form.address
    }
    window.showNotification?.({ type: 'success', title: 'Success', message: 'Saved' })
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to save' })
  } finally {
    savingContractInfo.value = false
  }
}

const downloadContract = async () => {
  generating.value = true
  try {
    const payload = {
      company_token: gen.company_token,
      start_date: gen.start_date,
      end_date: gen.end_date,
      hourly_rate: Number(gen.hourly_rate),
      area_servicio: gen.area_servicio,
    }
    if (gen.monthly_reference != null && gen.monthly_reference !== '') {
      payload.monthly_reference = Number(gen.monthly_reference)
    }
    const { blob, filename } = await api.generateContract(userId.value, payload)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    const missing = e?.data?.missing
    const msg = missing && missing.length ? `${e.message}: ${missing.join(', ')}` : (e.message || 'Failed to generate')
    window.showNotification?.({ type: 'error', title: 'Error', message: msg })
  } finally {
    generating.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.btn-sm { @apply px-3 py-1.5 text-sm font-medium; }
</style>
