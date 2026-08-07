<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Upload -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-fg-strong">{{ $t('salesImport.title') }}</h2>
            <p class="text-sm text-fg-muted">{{ $t('salesImport.subtitle') }}</p>
          </div>
          <button v-if="preview" class="btn-secondary btn-sm" @click="reset">
            {{ $t('salesImport.chooseAnother') }}
          </button>
        </div>

        <!-- Drop zone -->
        <label
          v-if="!preview"
          class="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg px-4 py-10 text-center cursor-pointer transition-colors"
          :class="dragging ? 'bg-tint' : ''"
          style="border: 2px dashed var(--border);"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <MaterialIcon name="upload_file" :size="34" class="text-fg-faint" />
          <div class="text-sm font-medium text-fg-strong">{{ $t('salesImport.dropzoneTitle') }}</div>
          <div class="text-xs text-fg-muted">{{ $t('salesImport.dropzoneHint') }}</div>
          <input type="file" accept=".csv,text/csv" class="hidden" @change="onFilePicked" />
        </label>

        <div v-if="fileName" class="mt-3 flex items-center gap-2 text-sm text-fg">
          <MaterialIcon name="description" :size="18" class="text-fg-faint" />
          <span class="font-medium">{{ fileName }}</span>
          <span v-if="parsing" class="text-xs text-fg-muted">{{ $t('salesImport.analyzing') }}</span>
        </div>

        <div v-if="loadError" class="mt-3 text-sm text-error bg-error-bg rounded-lg p-3">{{ loadError }}</div>
      </div>
    </div>

    <!-- Preview -->
    <div v-if="preview" class="card">
      <div class="card-body">
        <!-- Blocking problems -->
        <div v-if="preview.errors.length" class="mb-4 rounded-lg bg-error-bg p-3">
          <div class="flex items-center gap-2 text-sm font-semibold text-error">
            <MaterialIcon name="error" :size="18" />
            {{ $t('salesImport.cannotImport') }}
          </div>
          <ul class="mt-1.5 list-disc pl-5 text-sm text-error space-y-0.5">
            <li v-for="(e, i) in preview.errors" :key="i">{{ noteText(e) }}</li>
          </ul>
        </div>

        <!-- Non-blocking notes -->
        <div v-if="preview.warnings.length" class="mb-4 rounded-lg bg-warning-bg p-3">
          <div class="flex items-center gap-2 text-sm font-semibold text-warning">
            <MaterialIcon name="info" :size="18" />
            {{ $t('salesImport.notes') }}
          </div>
          <ul class="mt-1.5 list-disc pl-5 text-sm text-warning space-y-0.5">
            <li v-for="(w, i) in preview.warnings" :key="i">{{ noteText(w) }}</li>
          </ul>
        </div>

        <!-- Headline numbers -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-tint rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-brand">{{ preview.stats.rowsCounted }}</div>
            <div class="text-xs text-brand">{{ $t('salesImport.ordersCounted') }}</div>
          </div>
          <div class="bg-success-bg rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-success">{{ formatMoney(preview.stats.totalAmount) }}</div>
            <div class="text-xs text-success">{{ $t('salesImport.totalSales') }}</div>
          </div>
          <div class="bg-purple-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-purple-700">{{ preview.stats.daysToCreate }}</div>
            <div class="text-xs text-purple-600">{{ $t('salesImport.daysToCreate') }}</div>
          </div>
          <div class="bg-pending-bg rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-warning">{{ preview.stats.daysToUpdate }}</div>
            <div class="text-xs text-warning">{{ $t('salesImport.daysToUpdate') }}</div>
          </div>
        </div>

        <!-- Restaurant -> account resolution -->
        <div v-if="preview.restaurantMap?.length" class="mt-4 rounded-lg p-3" style="background: var(--surface-2);">
          <div class="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">
            {{ $t('salesImport.mappingTitle') }}
          </div>
          <div class="flex flex-wrap gap-2">
            <div v-for="m in preview.restaurantMap" :key="m.restaurant"
                 class="flex items-center gap-1.5 text-sm bg-surface-1 rounded-md px-2 py-1"
                 style="border: 1px solid var(--border);">
              <span class="text-fg-muted">{{ m.restaurant }}</span>
              <MaterialIcon name="arrow_forward" :size="14" class="text-fg-faint" />
              <span class="font-medium text-fg-strong">{{ m.account_name }}</span>
            </div>
          </div>
        </div>

        <!-- Per-day breakdown -->
        <div class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {{ $t('salesImport.perDayTitle') }}
            </div>
            <div v-if="preview.stats.firstDay" class="text-xs text-fg-muted">
              {{ preview.stats.firstDay }} → {{ preview.stats.lastDay }}
            </div>
          </div>

          <div class="overflow-x-auto -mx-1 px-1 max-h-[420px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0" style="background: var(--bg);">
                <tr class="border-b text-left text-xs text-fg-muted">
                  <th class="py-2 pr-3">{{ $t('common.date') }}</th>
                  <th class="py-2 pr-3">{{ $t('salesImport.account') }}</th>
                  <th class="py-2 pr-3 text-right">{{ $t('salesImport.rappiOrders') }}</th>
                  <th class="py-2 pr-3 text-right">{{ $t('salesImport.currentTotal') }}</th>
                  <th class="py-2 pr-3 text-right">{{ $t('salesImport.newTotal') }}</th>
                  <th class="py-2">{{ $t('salesImport.change') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in preview.days" :key="`${d.companyToken}-${d.day}`" class="border-b last:border-0">
                  <td class="py-2 pr-3 whitespace-nowrap">{{ d.day }}</td>
                  <td class="py-2 pr-3">{{ d.accountName }}</td>
                  <td class="py-2 pr-3 text-right text-fg-muted">{{ d.sourceOrders }}</td>
                  <td class="py-2 pr-3 text-right text-fg-muted">
                    {{ d.existing_amount === null ? '—' : formatMoney(d.existing_amount) }}
                    <span v-if="d.existing_other_amount > 0" class="block text-xs text-fg-faint"
                          :title="$t('salesImport.plusOlaClickHint')">
                      + {{ formatMoney(d.existing_other_amount) }} {{ $t('salesImport.fromOlaClick') }}
                    </span>
                  </td>
                  <td class="py-2 pr-3 text-right font-semibold">{{ formatMoney(d.amount) }}</td>
                  <td class="py-2">
                    <span v-if="d.action === 'create'"
                          class="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                      {{ $t('salesImport.new') }}
                    </span>
                    <span v-else class="text-xs font-medium px-1.5 py-0.5 rounded"
                          :class="deltaClass(d)">
                      {{ deltaLabel(d) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Commit -->
        <div class="mt-5 flex items-center justify-end gap-2 flex-wrap">
          <p v-if="!preview.errors.length" class="text-xs text-fg-muted mr-auto max-w-md">
            {{ $t('salesImport.commitHint') }}
          </p>
          <button class="btn-secondary" @click="reset">{{ $t('common.cancel') }}</button>
          <button class="btn-primary"
                  :disabled="committing || preview.errors.length > 0 || preview.days.length === 0"
                  @click="commit">
            {{ committing ? $t('salesImport.importing') : $t('salesImport.confirmImport') }}
          </button>
        </div>

        <div v-if="commitError" class="mt-3 text-sm text-error bg-error-bg rounded-lg p-3">{{ commitError }}</div>
      </div>
    </div>

    <!-- History -->
    <div class="card">
      <div class="card-body">
        <h3 class="text-base font-semibold text-fg-strong">{{ $t('salesImport.historyTitle') }}</h3>
        <p class="text-sm text-fg-muted">{{ $t('salesImport.historySubtitle') }}</p>

        <div v-if="historyLoading" class="py-6 text-center text-sm text-fg-muted">{{ $t('common.loading') }}</div>
        <div v-else-if="history.length === 0" class="py-6 text-center text-sm text-fg-muted">
          {{ $t('salesImport.noImports') }}
        </div>
        <div v-else class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-xs text-fg-muted">
                <th class="py-2 pr-3">{{ $t('common.date') }}</th>
                <th class="py-2 pr-3">{{ $t('salesImport.file') }}</th>
                <th class="py-2 pr-3">{{ $t('salesImport.period') }}</th>
                <th class="py-2 pr-3 text-right">{{ $t('salesImport.days') }}</th>
                <th class="py-2 pr-3 text-right">{{ $t('salesImport.totalSales') }}</th>
                <th class="py-2">{{ $t('salesImport.by') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in history" :key="h.id" class="border-b last:border-0">
                <td class="py-2 pr-3 whitespace-nowrap text-xs text-fg-muted">{{ formatDateTime(h.created_at) }}</td>
                <td class="py-2 pr-3 max-w-[220px] truncate" :title="h.file_name">{{ h.file_name || '—' }}</td>
                <td class="py-2 pr-3 whitespace-nowrap text-xs">{{ h.first_day }} → {{ h.last_day }}</td>
                <td class="py-2 pr-3 text-right">
                  {{ h.days_created + h.days_updated }}
                  <span class="text-xs text-fg-muted">({{ h.days_created }}{{ $t('salesImport.newShort') }})</span>
                </td>
                <td class="py-2 pr-3 text-right font-medium">{{ formatMoney(h.total_amount) }}</td>
                <td class="py-2 text-xs text-fg-muted">{{ h.uploaded_by_name || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import MaterialIcon from '../components/ui/MaterialIcon.vue'

const auth = useAuthStore()
const { t } = useI18n()

// The raw file text is kept in memory between preview and commit so the server
// reduces the exact same input twice — the operator confirms what they saw.
const csvText = ref('')
const fileName = ref('')
const preview = ref(null)
const parsing = ref(false)
const committing = ref(false)
const dragging = ref(false)
const loadError = ref('')
const commitError = ref('')
const history = ref([])
const historyLoading = ref(false)

const currencySymbol = auth.user?.currencySymbol || 'S/'

function formatMoney(value) {
  const n = Number(value) || 0
  return `${currencySymbol} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

/**
 * Server notes arrive as { code, params, message }. Translate by code, falling
 * back to the server's English text if a locale is missing the key.
 */
function noteText(n) {
  if (typeof n === 'string') return n
  if (!n?.code) return n?.message || ''
  const key = `salesImport.noteText.${n.code}`
  // Money in notes gets the same currency formatting as the rest of the page.
  const params = { ...(n.params || {}) }
  if (params.amount !== undefined) params.amount = formatMoney(params.amount)
  const translated = t(key, params)
  return translated === key ? (n.message || '') : translated
}

function delta(d) {
  return Number(d.amount) - Number(d.existing_amount || 0)
}

function deltaLabel(d) {
  const diff = delta(d)
  if (Math.abs(diff) < 0.005) return t('salesImport.unchanged')
  // Sign always leads, so "+S/ 20.00" and "-S/ 10.00" line up.
  return `${diff > 0 ? '+' : '-'}${formatMoney(Math.abs(diff))}`
}

function deltaClass(d) {
  const diff = delta(d)
  if (Math.abs(diff) < 0.005) return 'bg-gray-100 text-gray-600'
  return diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
}

function reset() {
  csvText.value = ''
  fileName.value = ''
  preview.value = null
  loadError.value = ''
  commitError.value = ''
}

function onFilePicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) loadFile(file)
}

function onDrop(event) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

async function loadFile(file) {
  loadError.value = ''
  commitError.value = ''
  preview.value = null

  if (!/\.csv$/i.test(file.name)) {
    loadError.value = t('salesImport.errorNotCsv')
    return
  }

  fileName.value = file.name
  parsing.value = true
  try {
    csvText.value = await file.text()
    const res = await api.previewRappiSalesImport(csvText.value, file.name)
    if (res.success) {
      preview.value = res
    } else {
      loadError.value = res.error || t('common.unknownError')
    }
  } catch (e) {
    loadError.value = e.data?.error || e.message || t('common.unknownError')
  } finally {
    parsing.value = false
  }
}

async function commit() {
  commitError.value = ''
  committing.value = true
  try {
    const res = await api.commitRappiSalesImport(csvText.value, fileName.value)
    if (res.success) {
      window.showNotification?.({
        type: 'success',
        title: t('common.success'),
        message: t('salesImport.imported', { days: res.days.length, total: formatMoney(res.totalAmount) })
      })
      reset()
      await loadHistory()
    } else {
      commitError.value = res.error || t('common.unknownError')
    }
  } catch (e) {
    commitError.value = e.data?.error || e.message || t('common.unknownError')
  } finally {
    committing.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await api.getRappiSalesImportHistory(20)
    history.value = res.success ? res.data : []
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

onMounted(loadHistory)
</script>
