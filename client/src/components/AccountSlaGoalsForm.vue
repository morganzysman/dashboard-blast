<template>
  <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-3">
    <div v-if="loading" class="flex items-center gap-2 text-[11px] text-gray-500">
      <span class="loading-spinner-sm inline-block" />
      {{ $t('common.loading') }}
    </div>
    <template v-else>
      <p class="text-[11px] font-medium text-gray-700">{{ $t('account.kitchenSlaGoals') }}</p>
      <p class="text-[10px] text-gray-500">{{ $t('rentability.slaModuleHint') }}</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label class="block text-[10px] text-gray-600">
          {{ $t('account.kitchenGoalTurbo') }}
          <input
            v-model.number="draft.turbo"
            type="number"
            min="1"
            max="240"
            class="mt-0.5 w-full border border-gray-200 rounded px-1 py-0.5 text-xs bg-white"
          />
        </label>
        <label class="block text-[10px] text-gray-600">
          {{ $t('account.kitchenGoalRappi') }}
          <input
            v-model.number="draft.rappi"
            type="number"
            min="1"
            max="240"
            class="mt-0.5 w-full border border-gray-200 rounded px-1 py-0.5 text-xs bg-white"
          />
        </label>
        <label class="block text-[10px] text-gray-600">
          {{ $t('account.kitchenGoalOnsite') }}
          <input
            v-model.number="draft.onsite"
            type="number"
            min="1"
            max="240"
            class="mt-0.5 w-full border border-gray-200 rounded px-1 py-0.5 text-xs bg-white"
          />
        </label>
        <label class="block text-[10px] text-gray-600">
          {{ $t('account.kitchenGoalDeliveryOther') }}
          <input
            v-model.number="draft.deliveryOther"
            type="number"
            min="1"
            max="240"
            class="mt-0.5 w-full border border-gray-200 rounded px-1 py-0.5 text-xs bg-white"
          />
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="text-[11px] px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-50"
          :disabled="saving || !companyToken"
          @click="save"
        >
          {{ saving ? $t('common.loading') : $t('account.kitchenSlaSave') }}
        </button>
        <button
          type="button"
          class="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
          :disabled="saving || !companyToken"
          @click="resetDefaults"
        >
          {{ $t('account.kitchenSlaReset') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import api from '../utils/api'

const props = defineProps({
  companyToken: { type: String, required: true },
  /** API envelope from GET /api/orders/kitchen-sla */
  kitchenSlaResponse: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['saved'])

const draft = reactive({
  turbo: 5,
  rappi: 10,
  onsite: 10,
  deliveryOther: 10
})

const saving = ref(false)

function hydrateFromResponse() {
  if (!props.companyToken) return
  const accounts = props.kitchenSlaResponse?.accounts
  const row = accounts?.find((a) => a.company_token === props.companyToken)
  const r = row?.resolvedPreset || {}
  draft.turbo = r['DELIVERY:RAPPI_TURBO'] ?? 5
  draft.rappi = r['DELIVERY:RAPPI'] ?? 10
  draft.onsite = r['ONSITE:*'] ?? 10
  draft.deliveryOther = r['DELIVERY:OTHER'] ?? 10
}

watch(
  () => [props.kitchenSlaResponse, props.companyToken],
  () => hydrateFromResponse(),
  { deep: true, immediate: true }
)

const save = async () => {
  if (!props.companyToken) return
  saving.value = true
  try {
    await api.putKitchenSla({
      company_token: props.companyToken,
      targets: {
        'DELIVERY:RAPPI_TURBO': Number(draft.turbo),
        'DELIVERY:RAPPI': Number(draft.rappi),
        'ONSITE:*': Number(draft.onsite),
        'DELIVERY:OTHER': Number(draft.deliveryOther)
      }
    })
    emit('saved')
  } finally {
    saving.value = false
  }
}

const resetDefaults = async () => {
  if (!props.companyToken) return
  saving.value = true
  try {
    await api.putKitchenSla({ company_token: props.companyToken, targets: {} })
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.loading-spinner-sm {
  @apply inline-block w-4 h-4 border-2 border-gray-300 border-t-teal-600 rounded-full animate-spin;
}
</style>
