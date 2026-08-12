<template>
  <div class="fixed inset-0 flex items-center justify-center z-50 p-4" style="background: var(--scrim);">
    <!-- dvh, not vh: on mobile browsers vh measures the expanded viewport, which
         would push the Send button underneath the address bar. -->
    <div
      class="w-full max-w-md rounded-lg overflow-hidden flex flex-col"
      style="background: var(--bg); border: 1px solid var(--border); box-shadow: var(--shadow-pop);
             max-height: 92vh; max-height: 92dvh;"
    >
      <!-- Header: framed as training, never as an audit -->
      <div class="p-4 border-b" style="border-color: var(--border);">
        <div class="flex items-start gap-2">
          <MaterialIcon name="school" :size="22" class="text-brand-600 flex-shrink-0 mt-0.5" />
          <div class="min-w-0">
            <h3 class="text-base font-bold text-fg-strong">{{ $t('training.prompt.title') }}</h3>
            <p class="text-xs text-fg-muted mt-0.5">{{ $t('training.prompt.subtitle') }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 space-y-4 overflow-y-auto">
        <div class="rounded-md p-3" style="background: var(--surface-2);">
          <div class="font-semibold text-fg-strong">{{ prompt.title }}</div>
          <p v-if="prompt.description" class="text-sm text-fg-muted mt-1">{{ prompt.description }}</p>
        </div>

        <!-- Photos -->
        <div v-if="prompt.requires_photo">
          <label class="form-label">
            {{ $t('training.prompt.photos') }}
            <span class="text-fg-muted font-normal">
              ({{ photos.length }}/{{ maxPhotos }}<template v-if="prompt.min_photos > 0">, {{ $t('training.prompt.minPhotos', { n: prompt.min_photos }) }}</template>)
            </span>
          </label>

          <div v-if="photos.length" class="grid grid-cols-3 gap-2 mb-2">
            <div v-for="(photo, index) in photos" :key="index" class="relative">
              <img :src="photo.preview" class="w-full h-20 object-cover rounded border" style="border-color: var(--border);" />
              <button
                type="button"
                class="absolute top-1 right-1 rounded-full p-0.5 flex items-center justify-center"
                style="background: rgba(0,0,0,0.65); color: #fff;"
                :aria-label="$t('common.delete')"
                @click="photos.splice(index, 1)"
              >
                <MaterialIcon name="close" :size="14" />
              </button>
            </div>
          </div>

          <label
            v-if="photos.length < maxPhotos"
            class="btn-secondary w-full flex items-center justify-center gap-2 cursor-pointer"
          >
            <MaterialIcon name="photo_camera" :size="18" />
            {{ photos.length ? $t('training.prompt.addAnotherPhoto') : $t('training.prompt.takePhoto') }}
            <!-- capture="environment" opens the rear camera straight away on phones -->
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="onPickPhoto" />
          </label>
        </div>

        <!-- Checkpoints: the "how it should be done" list -->
        <div v-if="prompt.checkpoints?.length">
          <label class="form-label">{{ $t('training.prompt.checklist') }}</label>
          <div class="space-y-2">
            <label
              v-for="c in prompt.checkpoints"
              :key="c.id"
              class="flex items-start gap-3 p-3 rounded cursor-pointer"
              style="background: var(--surface-2);"
            >
              <!-- Oversized box: this gets tapped mid-shift with wet or greasy hands. -->
              <input type="checkbox" class="mt-0.5 h-5 w-5 flex-shrink-0" v-model="checked[c.id]" />
              <span class="min-w-0">
                <span class="text-sm text-fg-strong block break-words">{{ c.label }}</span>
                <span v-if="c.hint" class="text-xs text-fg-muted block mt-0.5 break-words">{{ c.hint }}</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label class="form-label">{{ $t('training.prompt.note') }}</label>
          <textarea
            v-model="note"
            rows="2"
            class="form-input"
            :placeholder="$t('training.prompt.notePlaceholder')"
          ></textarea>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>

      <div class="p-4 border-t flex items-center gap-2" style="border-color: var(--border);">
        <!-- Skipping is always allowed: clocking out must never be blocked. -->
        <button type="button" class="btn-secondary flex-1" :disabled="busy" @click="skip">
          {{ $t('training.prompt.skip') }}
        </button>
        <button type="button" class="btn-primary flex-1" :disabled="busy || !canSubmit" @click="submit">
          {{ busy ? $t('common.saving') : $t('training.prompt.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import { compressImage } from '../utils/image'
import MaterialIcon from './ui/MaterialIcon.vue'

const props = defineProps({
  prompt: { type: Object, required: true }
})

// `done` fires for submit AND skip: the caller proceeds with clock-out either way.
const emit = defineEmits(['done'])

const { t } = useI18n()

const maxPhotos = 3
const photos = ref([])
const checked = reactive({})
const note = ref('')
const busy = ref(false)
const error = ref('')

const canSubmit = computed(() => {
  if (!props.prompt.requires_photo) return true
  return photos.value.length >= (props.prompt.min_photos || 0)
})

const onPickPhoto = async (e) => {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const { base64, mime, preview } = await compressImage(file)
    photos.value.push({ image_base64: base64, mime, preview })
    error.value = ''
  } catch {
    error.value = t('training.prompt.photoError')
  }
}

const submit = async () => {
  busy.value = true
  error.value = ''
  try {
    await api.submitTrainingEvidence(props.prompt.request_id, {
      note: note.value || null,
      checkpoints: (props.prompt.checkpoints || []).map(c => ({
        checkpoint_id: c.id,
        checked: checked[c.id] === true
      })),
      photos: photos.value.map(p => ({ image_base64: p.image_base64, mime: p.mime }))
    })
    emit('done', { submitted: true })
  } catch (e) {
    error.value = e.data?.error || e.message || t('common.failed')
  } finally {
    busy.value = false
  }
}

const skip = async () => {
  busy.value = true
  try {
    await api.skipTrainingPrompt(props.prompt.request_id, null)
  } catch {
    // Skipping is a courtesy record; never hold up the clock-out for it.
  } finally {
    busy.value = false
    emit('done', { submitted: false })
  }
}
</script>
