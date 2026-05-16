<template>
  <div
    v-if="companyKitchen && companyKitchen.ordersWithPrepTime > 0"
    class="card border-teal-100/80 bg-gradient-to-br from-white to-teal-50/30"
  >
    <details :open="isDesktop" class="group">
      <summary
        class="card-body cursor-pointer list-none py-4 lg:cursor-default [&::-webkit-details-marker]:hidden"
      >
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span>🏢</span> {{ $t('companyKitchen.title') }}
              <span
                class="lg:hidden text-xs font-normal text-teal-600 ml-1"
              >{{ $t('companyKitchen.tapToExpand') }}</span>
            </h3>
            <p class="text-xs text-gray-600 mt-0.5">
              {{ $t('companyKitchen.subtitle', { n: companyKitchen.accountsInKitchenAgg || 1 }) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs sm:text-sm mt-2 sm:mt-0">
            <span class="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-medium">
              {{ $t('companyKitchen.avgPrep') }}: {{ formatAvg(companyKitchen.averagePreparationTime) }}
            </span>
            <span
              v-if="companyKitchen.sla"
              class="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 font-medium"
            >
              SLA: {{ companyKitchen.sla.overallSlaScore }}
              <span class="font-normal text-teal-700">· {{ onTimeLine(companyKitchen.sla) }}</span>
            </span>
            <span
              v-if="companyKitchen.sla?.slaBreachTotal"
              class="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 font-medium"
            >
              {{ $t('companyKitchen.lateOrders', { n: companyKitchen.sla.slaBreachTotal }) }}
            </span>
          </div>
        </div>
      </summary>

      <div class="border-t border-gray-100 px-4 sm:px-6 pb-4 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="slot in rappiSlots"
            :key="slot.key"
            class="rounded-lg border border-gray-100 bg-white p-3"
          >
            <p class="text-[11px] font-semibold text-gray-700 mb-1">{{ slot.label }}</p>
            <div v-if="slot.row" class="text-[11px] space-y-0.5 text-gray-600">
              <div class="flex justify-between">
                <span>{{ $t('companyKitchen.orders') }}</span>
                <span class="font-semibold text-gray-900">{{ slot.row.ordersWithPrepTime }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ $t('account.kitchenTableGoal') }}</span>
                <span>{{ slot.row.targetMinutes ?? '—' }}′</span>
              </div>
              <div class="flex justify-between">
                <span>{{ $t('account.kitchenTableAvg') }}</span>
                <span class="font-semibold">{{ formatAvg(slot.row.averagePreparationTime) }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ $t('account.kitchenTableOnTime') }}</span>
                <span>{{ formatPct(slot.row.onTimeRate) }}</span>
              </div>
            </div>
            <p v-else class="text-[11px] text-gray-400">{{ $t('companyKitchen.noOrdersChannel') }}</p>
          </div>
        </div>

        <div v-if="breaches.length">
          <p class="text-xs font-medium text-gray-800 mb-1">{{ $t('companyKitchen.outOfSlaTitle') }}</p>
          <p v-if="truncated" class="text-[10px] text-amber-800 mb-1">{{ $t('companyKitchen.breachTruncated') }}</p>
          <div class="max-h-64 overflow-auto rounded border border-gray-100">
            <table class="w-full text-[11px]">
              <thead class="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th class="text-left font-medium px-2 py-1.5">{{ $t('companyKitchen.tableAccount') }}</th>
                  <th class="text-left font-medium px-2 py-1.5">{{ $t('companyKitchen.tableOrderId') }}</th>
                  <th class="text-left font-medium px-2 py-1.5">{{ $t('account.kitchenTableChannel') }}</th>
                  <th class="text-right font-medium px-2 py-1.5">{{ $t('companyKitchen.tableDelay') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in breaches"
                  :key="`${b.accountKey}-${b.orderId}-${i}`"
                  class="border-t border-gray-100"
                >
                  <td class="px-2 py-1.5 text-gray-800 truncate max-w-[120px]" :title="b.accountName">{{ b.accountName }}</td>
                  <td class="px-2 py-1.5 font-mono text-gray-900">{{ b.orderId || '—' }}</td>
                  <td class="px-2 py-1.5 text-gray-700">{{ channelLabel(b.channelKey) }}</td>
                  <td class="px-2 py-1.5 text-right font-semibold text-amber-800">
                    +{{ b.delayOverTargetMinutes }}′
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  companyKitchen: { type: Object, default: null }
})

const { t } = useI18n()

const isDesktop = ref(true)
let mql
function applyMq() {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
}
onMounted(() => {
  applyMq()
  mql = window.matchMedia('(min-width: 1024px)')
  mql.addEventListener('change', applyMq)
})
onBeforeUnmount(() => {
  if (mql) mql.removeEventListener('change', applyMq)
})

const ch = computed(() => props.companyKitchen?.byKitchenChannel || {})

const rappiSlots = computed(() => [
  {
    key: 'turbo',
    label: t('account.kitchenGoalTurbo'),
    row: ch.value['DELIVERY:RAPPI_TURBO'] || null
  },
  {
    key: 'rappi',
    label: t('account.kitchenGoalRappi'),
    row: ch.value['DELIVERY:RAPPI'] || null
  }
])

const breaches = computed(() => props.companyKitchen?.sla?.slaBreaches || [])
const truncated = computed(() => props.companyKitchen?.sla?.slaBreachesTruncated)

function formatAvg(m) {
  if (m == null || Number.isNaN(m)) return '—'
  return `${Math.round(m)}m`
}

function formatPct(r) {
  if (r == null || Number.isNaN(r)) return '—'
  return `${Math.round(r * 100)}%`
}

function onTimeLine(sla) {
  if (!sla?.totalScoredOrders) return ''
  const pct = Math.round((sla.overallOnTimeRate || 0) * 100)
  return t('account.kitchenOnTimeLine', { pct })
}

function channelLabel(key) {
  if (!key) return '—'
  const flat = key.replace(/:/g, '_')
  const path = `account.kitchenChannelKeys.${flat}`
  const translated = t(path)
  if (translated !== path) return translated
  const parts = key.split(':')
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`
  return key
}
</script>
