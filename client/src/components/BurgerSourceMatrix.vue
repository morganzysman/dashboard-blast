<template>
  <div class="card">
    <div class="card-body p-4">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-fg-strong">{{ $t('combos.sourceMatrixTitle') }}</h3>
          <p class="text-xs text-fg-muted">{{ $t('combos.sourceMatrixSubtitle') }}</p>
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

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-fg-muted">
              <th class="text-left font-medium py-2 pr-3 sticky left-0 bg-surface-1">{{ $t('combos.shop') }}</th>
              <th v-for="s in sources" :key="s" class="text-right font-medium py-2 px-3 whitespace-nowrap">
                {{ sourceLabel(s) }}
              </th>
              <th class="text-right font-semibold py-2 pl-3 whitespace-nowrap text-fg">
                {{ $t('combos.total') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in matrix" :key="row.token" class="border-t border-gray-100">
              <td class="text-left py-2 pr-3 font-medium text-fg-strong sticky left-0 bg-surface-1 whitespace-nowrap">
                {{ row.name }}
              </td>
              <td v-for="s in sources" :key="s" class="text-right py-2 px-3">
                <template v-if="row.cells[s] && row.cells[s].orders > 0">
                  <span class="font-semibold" :class="cellColor(row.cells[s].avg)">
                    {{ row.cells[s].avg.toFixed(2) }}
                  </span>
                  <span class="block text-[10px] text-fg-faint">{{ row.cells[s].orders }} {{ $t('combos.ordersShort') }}</span>
                </template>
                <span v-else class="text-fg-faint">–</span>
              </td>
              <td class="text-right py-2 pl-3 border-l border-gray-100">
                <span class="font-bold text-warning">{{ row.total.avg.toFixed(2) }}</span>
                <span class="block text-[10px] text-fg-faint">{{ row.total.orders }} {{ $t('combos.ordersShort') }}</span>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="matrix.length > 1">
            <tr class="border-t-2 border-gray-200">
              <td class="text-left py-2 pr-3 font-semibold text-fg sticky left-0 bg-surface-1">{{ $t('combos.total') }}</td>
              <td v-for="s in sources" :key="s" class="text-right py-2 px-3">
                <template v-if="columnTotals[s] && columnTotals[s].orders > 0">
                  <span class="font-semibold text-fg">{{ columnTotals[s].avg.toFixed(2) }}</span>
                  <span class="block text-[10px] text-fg-faint">{{ columnTotals[s].orders }} {{ $t('combos.ordersShort') }}</span>
                </template>
                <span v-else class="text-fg-faint">–</span>
              </td>
              <td class="text-right py-2 pl-3 border-l border-gray-100">
                <span class="font-bold text-warning">{{ grandTotal.avg.toFixed(2) }}</span>
                <span class="block text-[10px] text-fg-faint">{{ grandTotal.orders }} {{ $t('combos.ordersShort') }}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'

const props = defineProps({
  month: { type: String, required: true }, // YYYY-MM
  companyToken: { type: String, default: '' }
})

const { t, te } = useI18n()

const loading = ref(false)
const rows = ref([])

// Preferred column order; any extra sources are appended after these.
const SOURCE_ORDER = ['RAPPI', 'RAPPI_TURBO', 'WEB', 'OUTBOUND']

const hasData = computed(() => rows.value.some((r) => Number(r.order_count) > 0))

const sources = computed(() => {
  const present = new Set(rows.value.map((r) => r.source))
  const ordered = SOURCE_ORDER.filter((s) => present.has(s))
  const extras = [...present].filter((s) => !SOURCE_ORDER.includes(s)).sort()
  return [...ordered, ...extras]
})

const matrix = computed(() => {
  const byToken = new Map()
  for (const r of rows.value) {
    const token = r.company_token
    if (!byToken.has(token)) {
      byToken.set(token, { token, name: r.account_name || token, cells: {}, total: { orders: 0, burgers: 0 } })
    }
    const entry = byToken.get(token)
    const orders = Number(r.order_count) || 0
    const burgers = Number(r.burger_units) || 0
    entry.cells[r.source] = { orders, burgers, avg: orders > 0 ? burgers / orders : 0 }
    entry.total.orders += orders
    entry.total.burgers += burgers
  }
  const list = [...byToken.values()].map((e) => ({
    ...e,
    total: { ...e.total, avg: e.total.orders > 0 ? e.total.burgers / e.total.orders : 0 }
  }))
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list
})

const columnTotals = computed(() => {
  const totals = {}
  for (const s of sources.value) totals[s] = { orders: 0, burgers: 0, avg: 0 }
  for (const r of rows.value) {
    const s = r.source
    if (!totals[s]) totals[s] = { orders: 0, burgers: 0, avg: 0 }
    totals[s].orders += Number(r.order_count) || 0
    totals[s].burgers += Number(r.burger_units) || 0
  }
  for (const s of Object.keys(totals)) {
    totals[s].avg = totals[s].orders > 0 ? totals[s].burgers / totals[s].orders : 0
  }
  return totals
})

const grandTotal = computed(() => {
  let orders = 0
  let burgers = 0
  for (const r of rows.value) {
    orders += Number(r.order_count) || 0
    burgers += Number(r.burger_units) || 0
  }
  return { orders, burgers, avg: orders > 0 ? burgers / orders : 0 }
})

function sourceLabel(s) {
  const key = `combos.sources.${s}`
  if (te(key)) return t(key)
  // Prettify unknown raw values: RAPPI_TURBO -> Rappi Turbo
  return String(s || '')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function cellColor(avg) {
  if (avg >= 1.5) return 'text-green-600'
  if (avg >= 1.2) return 'text-amber-600'
  return 'text-gray-700'
}

async function load() {
  if (!props.month) return
  loading.value = true
  try {
    const res = await api.getBurgersBySource(props.month, props.companyToken || null)
    rows.value = res?.data || []
  } catch (err) {
    console.error('Failed to load burgers by source:', err)
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(() => [props.month, props.companyToken], load, { immediate: true })
</script>
