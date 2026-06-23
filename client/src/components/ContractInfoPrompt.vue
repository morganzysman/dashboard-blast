<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-lg p-6" @click.stop>
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-amber-100 rounded-lg">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ $t('contract.completePromptTitle') }}</h3>
              <p class="text-sm text-gray-500">{{ $t('contract.completePromptHint') }}</p>
            </div>
          </div>

          <form @submit.prevent="submit" class="space-y-4">
            <div>
              <label class="form-label">{{ $t('contract.documentType') }}</label>
              <select v-model="formData.document_type" class="form-input">
                <option value="">—</option>
                <option v-for="dt in docTypes" :key="dt" :value="dt">{{ dt }}</option>
              </select>
            </div>
            <div>
              <label class="form-label">{{ $t('contract.documentNumber') }}</label>
              <input v-model.trim="formData.document_number" type="text" class="form-input" />
            </div>
            <div>
              <label class="form-label">{{ $t('contract.address') }}</label>
              <input v-model.trim="formData.address" type="text" class="form-input" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-for="side in sides" :key="side.key">
                <label class="form-label">{{ $t(side.label) }}</label>
                <div v-if="side.preview || side.onFile" class="mb-2">
                  <img
                    v-if="side.preview"
                    :src="side.preview"
                    :alt="$t(side.label)"
                    class="max-h-40 rounded border border-gray-200 object-contain"
                  />
                  <p v-else class="text-xs text-green-700 flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    {{ $t('contract.idDocumentOnFile') }}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  class="form-input"
                  @change="(e) => onFileChange(e, side.key)"
                />
              </div>
            </div>
            <p class="text-xs text-gray-400">{{ $t('contract.idDocumentBothHint') }}</p>

            <div class="flex justify-between items-center gap-2 pt-2">
              <button type="button" class="btn-secondary" :disabled="saving" @click="skip">
                {{ $t('contract.doItLater') }}
              </button>
              <button type="submit" class="btn-primary" :disabled="saving || !canSave">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const show = ref(false)
const saving = ref(false)
const docTypes = ref(['DNI', 'CE', 'Pasaporte'])

const formData = reactive({
  document_type: '',
  document_number: '',
  address: '',
})

// Both ID document sides are required. Each side tracks whether a scan is
// already on file and any newly picked (pending) compressed image to upload.
const idSides = reactive({
  front: { onFile: false, preview: '', pending: null },
  back: { onFile: false, preview: '', pending: null },
})

// Drives the two upload widgets in the template.
const sides = computed(() => [
  { key: 'front', label: 'contract.idDocumentFront', preview: idSides.front.preview, onFile: idSides.front.onFile },
  { key: 'back', label: 'contract.idDocumentBack', preview: idSides.back.preview, onFile: idSides.back.onFile },
])

function sideReady(key) {
  return idSides[key].onFile || !!idSides[key].pending
}

// All text fields AND both ID document sides (front + back) are required to save.
const canSave = computed(() => {
  const textComplete = !!(formData.document_type && formData.document_number && formData.address)
  return textComplete && sideReady('front') && sideReady('back')
})

// Per-login skip flag: keyed by session so it reappears on the next login.
const skipKey = computed(() => `contractPromptSkipped:${authStore.sessionId || 'anon'}`)

// Downscale + compress an image file to keep DB rows small.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image decode failed'))
      img.onload = () => {
        const maxDim = 1280
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve({ base64: dataUrl, mime: 'image/jpeg', preview: dataUrl })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const onFileChange = async (e, side) => {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  try {
    const { base64, mime, preview } = await compressImage(file)
    idSides[side].pending = { base64, mime }
    idSides[side].preview = preview
  } catch (err) {
    window.showNotification?.({ type: 'error', title: 'Error', message: 'Could not process image' })
  }
}

const submit = async () => {
  if (!canSave.value) return
  saving.value = true
  try {
    if (formData.document_type || formData.document_number || formData.address) {
      await api.updateMyContractInfo({
        document_type: formData.document_type,
        document_number: formData.document_number,
        address: formData.address,
      })
    }
    for (const side of ['front', 'back']) {
      const pending = idSides[side].pending
      if (pending) {
        await api.uploadMyIdDocument({ image_base64: pending.base64, mime: pending.mime, side })
      }
    }
    show.value = false
    window.showNotification?.({ type: 'success', title: 'Success', message: 'Saved' })
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Error', message: e.message || 'Failed to save' })
  } finally {
    saving.value = false
  }
}

const skip = () => {
  try { sessionStorage.setItem(skipKey.value, '1') } catch { /* ignore */ }
  show.value = false
}

onMounted(async () => {
  // Respect a skip from earlier in this login session.
  try {
    if (sessionStorage.getItem(skipKey.value) === '1') return
  } catch { /* ignore */ }

  try {
    const res = await api.getMyContractInfo()
    const d = res?.data
    if (!d) return
    if (Array.isArray(d.employeeDocTypes) && d.employeeDocTypes.length) docTypes.value = d.employeeDocTypes
    formData.document_type = d.document_type || ''
    formData.document_number = d.document_number || ''
    formData.address = d.address || ''
    idSides.front.onFile = !!d.has_id_document_front
    idSides.back.onFile = !!d.has_id_document_back
    show.value = !d.complete
  } catch (e) {
    // Non-blocking: if the check fails, don't trap the employee.
    console.error('Contract info check failed', e)
  }
})
</script>
