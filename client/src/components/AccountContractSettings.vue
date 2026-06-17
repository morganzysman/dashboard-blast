<template>
  <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-3">
    <p class="text-[10px] text-gray-500">{{ $t('contract.employerDataHint') }}</p>

    <div>
      <label class="block text-[11px] font-medium text-gray-700">{{ $t('contract.country') }}</label>
      <select v-model="country" class="form-input text-xs mt-1">
        <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.label }}</option>
      </select>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div v-for="field in employerFields" :key="field.key">
        <label class="block text-[11px] font-medium text-gray-700">{{ fieldLabel(field) }}</label>
        <select
          v-if="field.options"
          v-model="info[field.key]"
          class="form-input text-xs mt-1"
        >
          <option value="">—</option>
          <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <input
          v-else
          v-model.trim="info[field.key]"
          type="text"
          class="form-input text-xs mt-1"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px]" :class="complete ? 'text-success-600' : 'text-gray-400'">
        {{ complete ? $t('accountApi.configured') : $t('accountApi.notConfigured') }}
      </span>
      <button
        type="button"
        class="btn-primary btn-xs disabled:opacity-50"
        :disabled="saving || !dirty"
        @click="save"
      >
        {{ saving ? $t('common.loading') : $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'

const { t } = useI18n()

const props = defineProps({
  companyId: { type: [String, Number], required: true },
  companyToken: { type: String, required: true },
  accountName: { type: String, default: '' },
  initialCountry: { type: String, default: 'PE' },
  initialEmployerInfo: { type: Object, default: () => ({}) },
  countries: { type: Array, default: () => [] },
})

const emit = defineEmits(['saved'])

const country = ref((props.initialCountry || 'PE').toUpperCase())
const info = reactive({ ...(props.initialEmployerInfo || {}) })
const saving = ref(false)

// Snapshot for dirty detection.
let original = JSON.stringify({ country: country.value, info: { ...info } })

watch(
  () => [props.initialCountry, props.initialEmployerInfo],
  () => {
    country.value = (props.initialCountry || 'PE').toUpperCase()
    Object.keys(info).forEach((k) => delete info[k])
    Object.assign(info, props.initialEmployerInfo || {})
    original = JSON.stringify({ country: country.value, info: { ...info } })
  }
)

const countryByCode = (code) => props.countries.find((c) => c.code === (code || '').toUpperCase()) || null
const employerFields = computed(() => countryByCode(country.value)?.employerFields || [])
const fieldLabel = (field) => (field.labelKey ? t(`contract.fields.${field.labelKey}`) : field.key)

// Only persist keys defined for the selected country.
const cleanInfo = computed(() => {
  const out = {}
  for (const f of employerFields.value) {
    const v = info[f.key]
    if (v != null && String(v).trim() !== '') out[f.key] = String(v).trim()
  }
  return out
})

const complete = computed(() =>
  employerFields.value.length > 0 &&
  employerFields.value.every((f) => !f.required || (info[f.key] && String(info[f.key]).trim() !== ''))
)

const dirty = computed(
  () => JSON.stringify({ country: country.value, info: { ...info } }) !== original
)

const save = async () => {
  if (!props.companyId || !props.companyToken || !dirty.value) return
  saving.value = true
  try {
    const res = await api.updateAccountContractInfo(props.companyId, props.companyToken, {
      country: country.value,
      contract_employer_info: cleanInfo.value,
    })
    if (res?.success) {
      original = JSON.stringify({ country: country.value, info: { ...info } })
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: props.accountName || props.companyToken,
      })
      emit('saved', { company_token: props.companyToken, country: country.value, contract_employer_info: cleanInfo.value })
    } else {
      throw new Error(res?.error || 'Failed to save')
    }
  } catch (err) {
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: err?.message || 'Failed to save',
    })
  } finally {
    saving.value = false
  }
}
</script>
