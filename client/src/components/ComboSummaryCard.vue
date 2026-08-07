<template>
  <div class="card">
    <div class="card-body p-4">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-fg-strong">{{ $t('combos.title') }}</h3>
          <p class="text-xs text-fg-muted">{{ $t('combos.subtitle') }}</p>
        </div>
        <div class="w-9 h-9 bg-warning-bg rounded-lg flex items-center justify-center flex-shrink-0">
          <span class="text-lg">🍔</span>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center h-28">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
      </div>

      <div v-else-if="!hasData" class="flex flex-col items-center justify-center h-28 text-center">
        <p class="text-sm text-fg-muted">{{ $t('combos.noData') }}</p>
        <p class="text-[11px] text-fg-faint mt-1">{{ $t('combos.noDataHint') }}</p>
      </div>

      <div v-else>
        <!-- KPI row -->
        <div class="grid grid-cols-3 gap-2 mb-1">
          <div class="rounded-lg bg-warning-bg p-2 text-center">
            <div class="text-xl font-bold text-warning">{{ avgPerOrder.toFixed(2) }}</div>
            <div class="text-[10px] text-fg-muted leading-tight">{{ $t('combos.avgPerOrder') }}</div>
          </div>
          <div class="rounded-lg bg-surface-2 p-2 text-center">
            <div class="text-xl font-bold text-fg-strong">{{ totalBurgerUnits }}</div>
            <div class="text-[10px] text-fg-muted leading-tight">{{ $t('combos.totalBurgers') }}</div>
          </div>
          <div class="rounded-lg bg-surface-2 p-2 text-center">
            <div class="text-xl font-bold text-fg-strong">{{ (burgerOrderRate * 100).toFixed(0) }}%</div>
            <div class="text-[10px] text-fg-muted leading-tight">{{ $t('combos.ordersWithBurger') }}</div>
          </div>
        </div>
        <!-- Combo comparison line -->
        <div class="text-[11px] text-fg-faint mb-3 text-right">
          {{ avgCombosPerOrder.toFixed(2) }} {{ $t('combos.comboCompare') }}
        </div>

        <!-- Per-day mini bars (avg burgers per order) -->
        <div class="flex items-end gap-[3px] h-20">
          <div
            v-for="d in bars"
            :key="d.date"
            class="flex-1 min-w-[2px] bg-amber-400/80 hover:bg-amber-500 rounded-t"
            :style="{ height: d.heightPct + '%' }"
            :title="`${d.date}: ${d.avg.toFixed(2)} ${$t('combos.avgPerOrderShort')} (${d.orders} ${$t('combos.ordersShort')})`"
          ></div>
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-fg-faint">
          <span>{{ bars[0]?.dayLabel }}</span>
          <span>{{ bars[bars.length - 1]?.dayLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '../utils/api'

const props = defineProps({
  month: { type: String, required: true }, // YYYY-MM
  companyToken: { type: String, default: '' }
})

const loading = ref(false)
const rows = ref([])

const hasData = computed(() => rows.value.some((r) => Number(r.order_count) > 0))

const totalOrders = computed(() =>
  rows.value.reduce((s, r) => s + (Number(r.order_count) || 0), 0)
)
const totalBurgerUnits = computed(() =>
  rows.value.reduce((s, r) => s + (Number(r.burger_units) || 0), 0)
)
const totalBurgerOrders = computed(() =>
  rows.value.reduce((s, r) => s + (Number(r.burger_orders) || 0), 0)
)
const totalComboUnits = computed(() =>
  rows.value.reduce((s, r) => s + (Number(r.combo_units) || 0), 0)
)
const avgPerOrder = computed(() =>
  totalOrders.value > 0 ? totalBurgerUnits.value / totalOrders.value : 0
)
const avgCombosPerOrder = computed(() =>
  totalOrders.value > 0 ? totalComboUnits.value / totalOrders.value : 0
)
const burgerOrderRate = computed(() =>
  totalOrders.value > 0 ? totalBurgerOrders.value / totalOrders.value : 0
)

const bars = computed(() => {
  const maxAvg = Math.max(
    0.01,
    ...rows.value.map((r) => (Number(r.order_count) > 0 ? Number(r.avg_burgers_per_order) || 0 : 0))
  )
  return rows.value.map((r) => {
    const avg = Number(r.order_count) > 0 ? Number(r.avg_burgers_per_order) || 0 : 0
    return {
      date: r.date,
      dayLabel: (r.date || '').slice(8, 10),
      avg,
      orders: Number(r.order_count) || 0,
      heightPct: Math.max(2, (avg / maxAvg) * 100)
    }
  })
})

async function load() {
  if (!props.month) return
  loading.value = true
  try {
    const res = await api.getDailyCombos(props.month, props.companyToken || null)
    rows.value = res?.data || []
  } catch (err) {
    console.error('Failed to load daily combos:', err)
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(() => [props.month, props.companyToken], load, { immediate: true })
</script>
