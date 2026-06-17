<template>
  <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-3">
    <p class="text-[10px] text-gray-500">{{ $t('accountApi.hint') }}</p>

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
  initialApiToken: { type: String, default: '' }
})

const emit = defineEmits(['saved'])

const draft = ref(props.initialApiToken || '')
const original = ref(props.initialApiToken || '')
const showToken = ref(false)
const saving = ref(false)

watch(() => props.initialApiToken, (val) => {
  draft.value = val || ''
  original.value = val || ''
})

const hasKey = computed(() => !!original.value)
const dirty = computed(() => (draft.value || '') !== (original.value || ''))

const save = async () => {
  if (!props.companyToken || !dirty.value) return
  saving.value = true
  try {
    const res = await api.updateAccountApiKey(props.companyToken, draft.value || null)
    if (res?.success) {
      original.value = draft.value || ''
      window.showNotification?.({
        type: 'success',
        title: t('accountApi.savedTitle'),
        message: t('accountApi.savedMsg', { account: props.accountName || props.companyToken })
      })
      emit('saved', { company_token: props.companyToken, api_token: res.data?.api_token ?? draft.value })
    } else {
      throw new Error(res?.error || 'Failed to save API key')
    }
  } catch (err) {
    window.showNotification?.({
      type: 'error',
      title: t('accountApi.saveFailedTitle'),
      message: err?.message || t('accountApi.saveFailedMsg')
    })
  } finally {
    saving.value = false
  }
}
</script>
