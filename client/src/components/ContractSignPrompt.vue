<template>
  <div v-if="show && current" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto" @click.stop>
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-primary-100 rounded-lg">
              <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ $t('contract.signWorkerTitle') }}</h3>
              <p class="text-sm text-gray-500">{{ $t('contract.signWorkerHint') }}</p>
            </div>
          </div>

          <div class="text-xs text-gray-500 mb-3">
            {{ $t('contract.term') }}: {{ formatDate(current.start_date) }} —
            {{ current.end_date ? formatDate(current.end_date) : $t('contract.indefinite') }}
          </div>

          <!-- PDF review -->
          <div class="mb-4 rounded-lg border border-gray-200 overflow-hidden bg-gray-100" style="height: 45vh;">
            <iframe v-if="pdfUrl" :src="pdfUrl" class="w-full h-full" :title="$t('contract.reviewPdf')"></iframe>
            <div v-else class="w-full h-full flex items-center justify-center text-sm text-gray-400">
              {{ $t('common.loading') }}
            </div>
          </div>

          <!-- Signature -->
          <label class="form-label">{{ $t('contract.signAsWorker') }}</label>
          <SignaturePad ref="pad" />

          <label class="flex items-start gap-2 mt-3 text-sm text-gray-700">
            <input v-model="consent" type="checkbox" class="mt-0.5" />
            <span>{{ $t('contract.legalConsent') }}</span>
          </label>

          <div class="flex justify-between items-center gap-2 pt-4">
            <button type="button" class="btn-secondary btn-sm" :disabled="submitting" @click="later">
              {{ $t('contract.later') }}
            </button>
            <button type="button" class="btn-primary" :disabled="submitting || !consent" @click="submit">
              {{ submitting ? $t('common.loading') : $t('contract.submitSignature') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'
import SignaturePad from './SignaturePad.vue'

const { t, locale } = useI18n()
const authStore = useAuthStore()

const show = ref(false)
const submitting = ref(false)
const consent = ref(false)
const queue = ref([])
const current = ref(null)
const pdfUrl = ref('')
const pad = ref(null)

const skipKey = `contractSignSkipped:${authStore.sessionId || 'anon'}`

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString(locale.value || 'es')
}

const revokePdf = () => {
  if (pdfUrl.value) { URL.revokeObjectURL(pdfUrl.value); pdfUrl.value = '' }
}

const loadPdf = async () => {
  revokePdf()
  if (!current.value) return
  try {
    pdfUrl.value = await api.fetchPdfObjectUrl(`/api/profile/contracts/${current.value.id}/pdf?which=unsigned`)
  } catch (e) {
    pdfUrl.value = ''
  }
}

// Advance to the next contract awaiting signature, or close when done.
const advance = async () => {
  consent.value = false
  pad.value?.clear()
  current.value = queue.value.shift() || null
  if (current.value) {
    await loadPdf()
  } else {
    show.value = false
    revokePdf()
  }
}

const submit = async () => {
  const dataUrl = pad.value?.toDataURL()
  if (!dataUrl) {
    window.showNotification?.({ type: 'error', title: 'Error', message: t('contract.signatureRequired') })
    return
  }
  submitting.value = true
  try {
    await api.signMyContract(current.value.id, { signature_png: dataUrl })
    window.showNotification?.({ type: 'success', title: 'Success', message: t('contract.signSuccess') })
    await advance()
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to sign' })
  } finally {
    submitting.value = false
  }
}

const later = () => {
  try { sessionStorage.setItem(skipKey, '1') } catch { /* ignore */ }
  show.value = false
  revokePdf()
}

watch(current, () => { consent.value = false })

onMounted(async () => {
  try { if (sessionStorage.getItem(skipKey) === '1') return } catch { /* ignore */ }
  try {
    const res = await api.getMyContracts()
    const awaiting = (res?.data || []).filter((c) => c.awaiting_signature)
    if (!awaiting.length) return
    queue.value = awaiting
    show.value = true
    await advance()
  } catch (e) {
    console.error('Contract sign check failed', e)
  }
})

onBeforeUnmount(revokePdf)
</script>
