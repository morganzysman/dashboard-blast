<template>
  <div class="card" v-if="loading || contracts.length">
    <div class="card-body space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-md font-semibold">{{ $t('contract.myContractsTitle') }}</h3>
        <button class="btn-secondary btn-sm" :disabled="loading" @click="reload">↻</button>
      </div>

      <div v-if="loading" class="text-sm text-gray-400">{{ $t('common.loading') }}</div>

      <div v-else class="space-y-3">
        <div
          v-for="c in contracts"
          :key="c.id"
          class="rounded-lg border border-gray-200 p-3 space-y-2"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <ContractStatusBadge :status="c.status" size="sm" />
              <span class="text-sm font-medium text-gray-800">{{ typeLabel(c) }}</span>
            </div>
            <span v-if="c.expiring_soon" class="text-xs text-amber-600 font-medium">
              {{ $t('contract.expiringSoon') }}
            </span>
          </div>

          <div class="text-xs text-gray-500">
            {{ $t('contract.term') }}: {{ formatDate(c.start_date) }} —
            {{ c.end_date ? formatDate(c.end_date) : $t('contract.indefinite') }}
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
            <button class="btn-secondary btn-xs" :disabled="opening === c.id" @click="openContract(c)">
              {{ opening === c.id ? $t('common.loading') : $t('contract.openFullPdf') }}
            </button>
            <button
              v-if="c.awaiting_signature"
              class="btn-primary btn-xs"
              @click="$emit('sign', c)"
            >
              {{ $t('contract.signNow') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import ContractStatusBadge from './ContractStatusBadge.vue'

const { t, te, locale } = useI18n()

defineEmits(['sign'])

const contracts = ref([])
const loading = ref(false)
const opening = ref(null)

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString(locale.value || 'es')
}

const typeLabel = (c) => {
  const key = c.type_label_key
  if (key && te(`contract.types.${key}`)) return t(`contract.types.${key}`)
  return c.contract_type || t('contract.contractsTitle')
}

const reload = async () => {
  loading.value = true
  try {
    const res = await api.getMyContracts()
    contracts.value = res?.data || []
  } catch (e) {
    contracts.value = []
  } finally {
    loading.value = false
  }
}

// Open the contract in the device's native PDF viewer (full screen). We open the
// tab synchronously within the click gesture, then point it at the blob URL once
// fetched — avoids mobile popup blockers and the in-iframe scroll limitation.
const openContract = async (c) => {
  opening.value = c.id
  const win = window.open('', '_blank')
  try {
    const url = await api.fetchPdfObjectUrl(`/api/profile/contracts/${c.id}/pdf?which=signed`)
    if (win) win.location = url
    else window.location.href = url
  } catch (e) {
    if (win) win.close()
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to load PDF' })
  } finally {
    opening.value = null
  }
}

defineExpose({ reload })

onMounted(reload)
</script>
