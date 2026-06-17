<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button class="btn-secondary btn-sm" @click="goBack">← {{ $t('common.back') }}</button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ user?.name || $t('common.loading') }}</h1>
          <p class="text-sm text-gray-500">{{ user?.email }} · {{ user?.role }} · {{ user?.company_name || '—' }}</p>
        </div>
      </div>
      <ContractStatusBadge v-if="user" :status="contractStatus" />
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
          <div>
            <label class="form-label">{{ $t('contract.idDocumentImage') }}</label>
            <div v-if="idDocumentUrl" class="mt-1">
              <img :src="idDocumentUrl" alt="ID document" class="max-h-48 rounded border border-gray-200 object-contain" />
            </div>
            <p v-else class="text-sm text-gray-400">{{ $t('common.none') }}</p>
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
                <label class="form-label">{{ $t('contract.contractType') }}</label>
                <select v-model="gen.contract_type" class="form-input">
                  <option
                    v-for="ct in contractTypes"
                    :key="ct.id"
                    :value="ct.id"
                    :disabled="!ct.available"
                  >
                    {{ contractTypeLabel(ct) }}{{ ct.available ? '' : ' — n/a' }}
                  </option>
                </select>
              </div>

              <!-- Dynamic per-contract-type parameter fields -->
              <div v-for="field in paramFields" :key="field.key">
                <label class="form-label">{{ paramLabel(field) }}</label>
                <input
                  v-if="field.type === 'number'"
                  v-model.number="gen.params[field.key]"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-input"
                  :placeholder="field.key === 'monthly_reference' ? String(autoMonthly) : ''"
                />
                <input
                  v-else
                  v-model.trim="gen.params[field.key]"
                  :type="field.type === 'date' ? 'date' : 'text'"
                  class="form-input"
                />
                <p v-if="field.hintKey" class="text-xs text-gray-400 mt-1">{{ paramHint(field) }}</p>
              </div>
            </div>

            <!-- Template unavailable warning -->
            <div v-if="selectedContractType && !selectedContractType.available" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              {{ $t('contract.templateUnavailable', { country: selectedCountryConfig?.label }) }}
            </div>

            <!-- Missing fields warning -->
            <div v-else-if="missingFields.length" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              <div class="font-medium mb-1">{{ $t('contract.missingFieldsTitle') }}</div>
              <ul class="list-disc ml-5">
                <li v-for="m in missingFields" :key="m">{{ $t(labelForMissing(m)) }}</li>
              </ul>
            </div>

            <div class="flex justify-end gap-2">
              <button class="btn-secondary" :disabled="generating || !canGenerate" @click="openPreview">
                {{ generating && previewing ? $t('common.loading') : $t('contract.preview') }}
              </button>
              <button class="btn-primary" :disabled="generating || !canGenerate" @click="createContract">
                {{ generating && !previewing ? $t('common.loading') : $t('contract.createContract') }}
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Contracts (records + signing) -->
      <div class="card">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ $t('contract.contractsTitle') }}</h2>
            <button class="btn-secondary btn-sm" :disabled="loadingContracts" @click="loadContracts">↻</button>
          </div>

          <p v-if="contracts.length === 0" class="text-sm text-gray-500">{{ $t('contract.noContracts') }}</p>

          <div v-else class="space-y-3">
            <div v-for="c in contracts" :key="c.id" class="rounded-lg border border-gray-200 p-3 space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <ContractStatusBadge :status="c.status" size="sm" />
                  <span class="text-sm font-medium text-gray-800">{{ contractTypeLabelById(c) }}</span>
                </div>
                <span class="text-xs text-gray-400">{{ $t('contract.createdOn') }} {{ formatDate(c.created_at) }}</span>
              </div>
              <div class="text-xs text-gray-500">
                {{ $t('contract.term') }}: {{ formatDate(c.start_date) }} — {{ c.end_date ? formatDate(c.end_date) : $t('contract.indefinite') }}
              </div>
              <div class="flex items-center gap-3 text-xs">
                <span :class="c.employer_signed ? 'text-green-600' : 'text-amber-600'">
                  {{ c.employer_signed ? '✓' : '○' }} {{ $t('contract.employerSigned') }}
                </span>
                <span :class="c.worker_signed ? 'text-green-600' : 'text-amber-600'">
                  {{ c.worker_signed ? '✓' : '○' }} {{ $t('contract.workerSigned') }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <button class="btn-secondary btn-xs" @click="viewContractPdf(c)">{{ $t('contract.viewPdf') }}</button>
                <button v-if="c.has_signed_pdf" class="btn-secondary btn-xs" @click="downloadContractPdf(c, 'signed')">
                  {{ $t('contract.downloadSigned') }}
                </button>
                <button v-else class="btn-secondary btn-xs" @click="downloadContractPdf(c, 'unsigned')">
                  {{ $t('contract.downloadUnsigned') }}
                </button>
                <button
                  v-if="!c.employer_signed && c.status !== 'cancelled'"
                  class="btn-primary btn-xs"
                  @click="openEmployerSign(c)"
                >
                  {{ $t('contract.signAsEmployer') }}
                </button>
                <button
                  v-if="c.status !== 'cancelled'"
                  class="btn-xs text-red-600 hover:text-red-700"
                  @click="cancelContract(c)"
                >
                  {{ $t('contract.cancelContract') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Preview modal -->
    <div
      v-if="previewUrl"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closePreview"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 class="text-base font-semibold text-gray-900">{{ $t('contract.previewTitle') }}</h3>
          <div class="flex items-center gap-2">
            <button class="btn-primary btn-sm" @click="downloadFromPreview">{{ $t('contract.downloadPdf') }}</button>
            <button class="btn-secondary btn-sm" @click="closePreview">{{ $t('common.close') }}</button>
          </div>
        </div>
        <div class="flex-1 overflow-hidden bg-gray-100">
          <iframe :src="previewUrl" class="w-full h-full" title="Contract preview"></iframe>
        </div>
      </div>
    </div>

    <!-- Employer signature modal -->
    <div
      v-if="signContract"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeEmployerSign"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col">
        <div class="px-4 py-3 border-b border-gray-200">
          <h3 class="text-base font-semibold text-gray-900">{{ $t('contract.signEmployerTitle') }}</h3>
          <p class="text-sm text-gray-500">{{ $t('contract.signEmployerHint') }}</p>
        </div>
        <div class="p-4 space-y-3">
          <SignaturePad ref="employerPad" />
        </div>
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button class="btn-secondary btn-sm" @click="closeEmployerSign">{{ $t('common.cancel') }}</button>
          <button class="btn-primary btn-sm" :disabled="signing" @click="submitEmployerSign">
            {{ signing ? $t('common.loading') : $t('contract.saveSignature') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import ContractStatusBadge from '../components/ContractStatusBadge.vue'
import SignaturePad from '../components/SignaturePad.vue'

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()

const loading = ref(true)
const user = ref(null)
const accounts = ref([])
const idDocumentUrl = ref('')
const countries = ref([])
const savingPayroll = ref(false)
const savingContractInfo = ref(false)
const generating = ref(false)
const previewing = ref(false)
const previewUrl = ref('')
let previewBlob = null
let previewFilename = 'contrato.pdf'

const contracts = ref([])
const contractStatus = ref('none')
const loadingContracts = ref(false)
const signContract = ref(null)
const signing = ref(false)
const employerPad = ref(null)

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
  contract_type: '',
  params: {},
})

const AREA_BY_JOB = { kitchen: 'cocina', waiter: 'atención al cliente' }

const userId = computed(() => route.params.id)

const selectedAccount = computed(() => accounts.value.find(a => a.company_token === gen.company_token) || null)
const countryByCode = (code) => countries.value.find(c => c.code === (code || '').toUpperCase()) || null
const selectedCountryConfig = computed(() => selectedAccount.value ? countryByCode(selectedAccount.value.country) : null)

const contractTypes = computed(() => selectedCountryConfig.value?.contractTypes || [])
const selectedContractType = computed(() =>
  contractTypes.value.find(ct => ct.id === gen.contract_type) || contractTypes.value.find(ct => ct.available) || null
)
const paramFields = computed(() => selectedContractType.value?.paramFields || [])

const contractTypeLabel = (ct) => (te(`contract.types.${ct.labelKey}`) ? t(`contract.types.${ct.labelKey}`) : ct.labelKey)
const paramLabel = (field) => (field.labelKey && te(`contract.params.${field.labelKey}`) ? t(`contract.params.${field.labelKey}`) : (field.labelKey || field.key))
const paramHint = (field) => {
  if (!field.hintKey) return ''
  const key = `contract.params.${field.hintKey}`
  return te(key) ? t(key, { hours: selectedCountryConfig.value?.referenceHours || 208, max: selectedCountryConfig.value?.maxWeeklyHours || 48 }) : ''
}

// Employee doc-type options driven by the selected account's country (fallback PE/all).
const employeeDocTypes = computed(() => {
  const cfg = selectedCountryConfig.value || countryByCode('PE')
  return cfg?.employeeDocTypes || ['DNI', 'CE', 'Pasaporte']
})

const autoMonthly = computed(() => {
  const hours = selectedCountryConfig.value?.referenceHours || 208
  const rate = Number(gen.params.hourly_rate)
  return Number.isFinite(rate) && rate > 0 ? Number((rate * hours).toFixed(2)) : 0
})

// Reset/seed param values whenever the contract type changes.
watch(selectedContractType, (ct) => {
  const next = {}
  for (const field of ct?.paramFields || []) {
    next[field.key] = gen.params[field.key] ?? (field.type === 'number' ? null : '')
  }
  // Seed area_servicio from job type when present and empty.
  if ('area_servicio' in next && isBlank(next.area_servicio)) {
    next.area_servicio = AREA_BY_JOB[user.value?.job_type] || ''
  }
  if ('hourly_rate' in next && (next.hourly_rate == null || next.hourly_rate === '')) {
    next.hourly_rate = user.value?.hourly_rate ?? null
  }
  gen.params = next
})

// Client-side mirror of server validateContractData for instant feedback.
const missingFields = computed(() => {
  const cfg = selectedCountryConfig.value
  const ct = selectedContractType.value
  if (!cfg || !ct || !ct.available) return []
  const acct = selectedAccount.value
  const employer = acct?.contract_employer_info || {}
  const missing = []
  for (const field of cfg.employerFields) {
    if (field.required && isBlank(employer[field.key])) missing.push(`employer.${field.key}`)
  }
  if (isBlank(form.document_type)) missing.push('employee.document_type')
  if (isBlank(form.document_number)) missing.push('employee.document_number')
  if (isBlank(form.address)) missing.push('employee.address')
  for (const field of ct.paramFields) {
    if (!field.required) continue
    if (field.type === 'number') {
      const n = Number(gen.params[field.key])
      if (!Number.isFinite(n) || n <= 0) missing.push(`params.${field.key}`)
    } else if (isBlank(gen.params[field.key])) {
      missing.push(`params.${field.key}`)
    }
  }
  const s = gen.params.start_date
  const e = gen.params.end_date
  if (s && e && e < s) missing.push('params.end_date')
  return missing
})

const canGenerate = computed(() =>
  !!selectedContractType.value && selectedContractType.value.available && missingFields.value.length === 0
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
  }
  if (map[key]) return map[key]
  // params.<key> → resolve to the param field's label.
  if (key.startsWith('params.')) {
    const pk = key.slice('params.'.length)
    const field = paramFields.value.find(f => f.key === pk)
    if (field?.labelKey && te(`contract.params.${field.labelKey}`)) return `contract.params.${field.labelKey}`
  }
  return key
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
    contractStatus.value = d?.contractStatus || 'none'
    if (user.value) {
      form.hourly_rate = user.value.hourly_rate ?? null
      form.hired_at = user.value.hired_at ? String(user.value.hired_at).slice(0, 10) : ''
      form.job_type = user.value.job_type || ''
      form.document_type = user.value.document_type || ''
      form.document_number = user.value.document_number || ''
      form.address = user.value.address || ''
      if (user.value.has_id_document) {
        api.fetchImageObjectUrl(`/api/admin/users/${userId.value}/id-document`)
          .then((url) => { idDocumentUrl.value = url })
          .catch(() => { idDocumentUrl.value = '' })
      }
    }
    if (accounts.value.length) gen.company_token = accounts.value[0].company_token
    // Default to the first available contract type for the selected country.
    const firstAvailable = (selectedCountryConfig.value?.contractTypes || []).find(ct => ct.available)
    gen.contract_type = firstAvailable?.id || (selectedCountryConfig.value?.contractTypes?.[0]?.id || '')
    await loadContracts()
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to load' })
  } finally {
    loading.value = false
  }
}

// Keep contract type valid when the account/country changes.
watch(selectedCountryConfig, (cfg) => {
  const types = cfg?.contractTypes || []
  if (!types.some(ct => ct.id === gen.contract_type)) {
    gen.contract_type = (types.find(ct => ct.available) || types[0])?.id || ''
  }
})

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

const buildPayload = (extra = {}) => {
  const payload = {
    company_token: gen.company_token,
    contract_type: gen.contract_type,
    ...extra,
  }
  for (const field of paramFields.value) {
    const v = gen.params[field.key]
    if (v == null || v === '') continue
    payload[field.key] = field.type === 'number' ? Number(v) : v
  }
  return payload
}

const generatePreviewBlob = async () => {
  return api.previewContract(userId.value, buildPayload())
}

const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const notifyError = (e) => {
  const missing = e?.data?.missing
  const msg = missing && missing.length ? `${e.message}: ${missing.join(', ')}` : (e.message || 'Failed to generate')
  window.showNotification?.({ type: 'error', title: 'Error', message: msg })
}

const openPreview = async () => {
  generating.value = true
  previewing.value = true
  try {
    const { blob, filename } = await generatePreviewBlob()
    previewBlob = blob
    previewFilename = filename
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    notifyError(e)
  } finally {
    generating.value = false
    previewing.value = false
  }
}

const closePreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewBlob = null
}

const downloadFromPreview = () => {
  if (previewBlob) triggerBrowserDownload(previewBlob, previewFilename)
}

// Persist a contract record (status pending, awaiting signatures).
const createContract = async () => {
  generating.value = true
  previewing.value = false
  try {
    await api.createContract(userId.value, buildPayload())
    window.showNotification?.({ type: 'success', title: 'Success', message: t('contract.contractCreated') })
    await loadContracts()
  } catch (e) {
    notifyError(e)
  } finally {
    generating.value = false
  }
}

// ---- contract records + signing -------------------------------------------

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString(locale.value || 'es')
}

const contractTypeLabelById = (c) => {
  const cfg = countryByCode(c.country)
  const ct = (cfg?.contractTypes || []).find((type) => type.id === c.contract_type)
  return ct ? contractTypeLabel(ct) : (c.contract_type || '')
}

const loadContracts = async () => {
  loadingContracts.value = true
  try {
    const res = await api.getUserContracts(userId.value)
    contracts.value = res?.data || []
    if (res?.contractStatus) contractStatus.value = res.contractStatus
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to load contracts' })
  } finally {
    loadingContracts.value = false
  }
}

const viewContractPdf = async (c) => {
  try {
    const which = c.has_signed_pdf ? 'signed' : 'unsigned'
    const url = await api.fetchPdfObjectUrl(`/api/admin/contracts/${c.id}/pdf?which=${which}`)
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewBlob = null
    previewFilename = `contrato-${c.id}.pdf`
    previewUrl.value = url
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to load PDF' })
  }
}

const downloadContractPdf = async (c, which) => {
  try {
    const url = await api.fetchPdfObjectUrl(`/api/admin/contracts/${c.id}/pdf?which=${which}`)
    const a = document.createElement('a')
    a.href = url
    a.download = `contrato-${c.id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to download PDF' })
  }
}

const openEmployerSign = (c) => { signContract.value = c }
const closeEmployerSign = () => { signContract.value = null }

const submitEmployerSign = async () => {
  const dataUrl = employerPad.value?.toDataURL()
  if (!dataUrl) {
    window.showNotification?.({ type: 'error', title: 'Error', message: t('contract.signatureRequired') })
    return
  }
  signing.value = true
  try {
    await api.signContractEmployer(signContract.value.id, { signature_png: dataUrl })
    window.showNotification?.({ type: 'success', title: 'Success', message: t('contract.signSuccess') })
    closeEmployerSign()
    await loadContracts()
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to sign' })
  } finally {
    signing.value = false
  }
}

const cancelContract = async (c) => {
  if (!window.confirm(t('contract.cancelConfirm'))) return
  try {
    await api.cancelContract(c.id)
    await loadContracts()
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to cancel' })
  }
}

onMounted(load)
onBeforeUnmount(() => { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })
</script>

<style scoped>
.btn-sm { @apply px-3 py-1.5 text-sm font-medium; }
.btn-xs { @apply px-2.5 py-1 text-xs font-medium; }
</style>
