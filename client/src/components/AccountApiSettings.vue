<template>
  <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-4">
    <p class="text-[10px] text-gray-500">{{ $t('accountApi.hint') }}</p>

    <!-- Private (scraped) API token -->
    <label class="block text-[11px] font-medium text-gray-700">
      {{ $t('companies.apiToken') }}
      <div class="mt-1 flex items-center gap-2">
        <input
          :type="showToken ? 'text' : 'password'"
          v-model.trim="draft"
          class="form-input flex-1 text-xs"
          :placeholder="$t('accountApi.placeholder')"
          autocomplete="off"
        />
        <button type="button" class="btn-secondary btn-xs" @click="showToken = !showToken">
          {{ showToken ? $t('common.hide') : $t('common.show') }}
        </button>
      </div>
    </label>

    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px]" :class="hasKey ? 'text-success-600' : 'text-gray-400'">
        {{ hasKey ? $t('accountApi.configured') : $t('accountApi.notConfigured') }}
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

    <!-- Public API key (olk_live_...) -->
    <div class="border-t border-gray-200 pt-3">
      <p class="text-[10px] text-gray-500 mb-1">{{ $t('accountApi.publicKeyHint') }}</p>
      <label class="block text-[11px] font-medium text-gray-700">
        {{ $t('accountApi.publicKeyLabel') }}
        <div class="mt-1 flex items-center gap-2">
          <input
            :type="showPublicKey ? 'text' : 'password'"
            v-model.trim="publicDraft"
            class="form-input flex-1 text-xs"
            :placeholder="$t('accountApi.publicKeyPlaceholder')"
            autocomplete="off"
          />
          <button type="button" class="btn-secondary btn-xs" @click="showPublicKey = !showPublicKey">
            {{ showPublicKey ? $t('common.hide') : $t('common.show') }}
          </button>
        </div>
      </label>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="text-[10px]" :class="hasPublicKey ? 'text-success-600' : 'text-gray-400'">
          {{ hasPublicKey ? $t('accountApi.configured') : $t('accountApi.notConfigured') }}
        </span>
        <button
          type="button"
          class="btn-primary btn-xs disabled:opacity-50"
          :disabled="savingPublic || !publicDirty"
          @click="savePublic"
        >
          {{ savingPublic ? $t('common.loading') : $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'

const { t } = useI18n()

const props = defineProps({
  companyToken: { type: String, required: true },
  accountName: { type: String, default: '' },
  initialApiToken: { type: String, default: '' },
  initialPublicApiKey: { type: String, default: '' }
})

const emit = defineEmits(['saved'])

const draft = ref(props.initialApiToken || '')
const original = ref(props.initialApiToken || '')
const showToken = ref(false)
const saving = ref(false)

const publicDraft = ref(props.initialPublicApiKey || '')
const publicOriginal = ref(props.initialPublicApiKey || '')
const showPublicKey = ref(false)
const savingPublic = ref(false)

watch(() => props.initialApiToken, (val) => {
  draft.value = val || ''
  original.value = val || ''
})

watch(() => props.initialPublicApiKey, (val) => {
  publicDraft.value = val || ''
  publicOriginal.value = val || ''
})

const hasKey = computed(() => !!original.value)
const dirty = computed(() => (draft.value || '') !== (original.value || ''))
const hasPublicKey = computed(() => !!publicOriginal.value)
const publicDirty = computed(() => (publicDraft.value || '') !== (publicOriginal.value || ''))

const notify = (type, title, message) => {
  window.showNotification?.({ type, title, message })
}

const save = async () => {
  if (!props.companyToken || !dirty.value) return
  saving.value = true
  try {
    const res = await api.updateAccountApiKey(props.companyToken, draft.value || null)
    if (res?.success) {
      original.value = draft.value || ''
      notify('success', t('accountApi.savedTitle'), t('accountApi.savedMsg', { account: props.accountName || props.companyToken }))
      emit('saved', {
        company_token: props.companyToken,
        api_token: res.data?.api_token ?? draft.value,
        public_api_key: res.data?.public_api_key ?? publicOriginal.value
      })
    } else {
      throw new Error(res?.error || 'Failed to save API key')
    }
  } catch (err) {
    notify('error', t('accountApi.saveFailedTitle'), err?.message || t('accountApi.saveFailedMsg'))
  } finally {
    saving.value = false
  }
}

const savePublic = async () => {
  if (!props.companyToken || !publicDirty.value) return
  savingPublic.value = true
  try {
    const res = await api.updateAccountPublicApiKey(props.companyToken, publicDraft.value || null)
    if (res?.success) {
      publicOriginal.value = publicDraft.value || ''
      notify('success', t('accountApi.savedTitle'), t('accountApi.savedMsg', { account: props.accountName || props.companyToken }))
      emit('saved', {
        company_token: props.companyToken,
        api_token: res.data?.api_token ?? original.value,
        public_api_key: res.data?.public_api_key ?? publicDraft.value
      })
    } else {
      throw new Error(res?.error || 'Failed to save API key')
    }
  } catch (err) {
    notify('error', t('accountApi.saveFailedTitle'), err?.message || t('accountApi.saveFailedMsg'))
  } finally {
    savingPublic.value = false
  }
}
</script>
