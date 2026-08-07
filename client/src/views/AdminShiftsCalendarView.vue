<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-end gap-3">
          <div class="flex-1">
            <label class="text-xs text-fg">{{ $t('rentability.account') }}</label>
            <select v-model="companyToken" class="form-input w-full" @change="loadCalendar">
              <option value="" disabled>{{ $t('rentability.selectAccount') }}</option>
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
                {{ acc.account_name || acc.company_token }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-outline btn-sm" @click="prevWeek">{{ $t('shifts.prevWeek') }}</button>
            <button class="btn btn-outline btn-sm" @click="nextWeek">{{ $t('shifts.nextWeek') }}</button>
            <button class="btn btn-secondary btn-sm" @click="loadCalendar">{{ $t('common.refresh') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h3 class="text-md font-semibold">{{ $t('shifts.calendar') }}</h3>
          <div class="text-xs text-fg-muted">{{ $t('shifts.weekOf') }} {{ weekStart }}</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <div class="text-fg-muted hidden lg:block" v-for="(d, index) in [$t('shifts.weekdays.0'), $t('shifts.weekdays.1'), $t('shifts.weekdays.2'), $t('shifts.weekdays.3'), $t('shifts.weekdays.4'), $t('shifts.weekdays.5'), $t('shifts.weekdays.6')]" :key="index">{{ d }}</div>
          <template v-for="day in weekDays" :key="day.date">
            <div class="rounded-md p-2 min-h-[140px]" style="background: var(--surface-1); border: 1px solid var(--border);">
              <div class="text-[10px] text-fg-muted">{{ day.label }}</div>
              <div class="mt-1 space-y-1">
                <div v-if="loading" class="space-y-1 animate-pulse">
                  <div class="h-4 bg-surface-2 rounded"></div>
                  <div class="h-3 bg-surface-2 rounded w-24"></div>
                </div>
                <template v-else>
                  <div
                    v-for="e in day.entries"
                    :key="e.user_id + ':' + e.start_time"
                    class="rounded-md px-1.5 py-1"
                    :style="entryStyle(e)"
                  >
                    <div class="font-semibold truncate" :style="{ color: entryColor(e).border }">{{ e.name || e.email }}</div>
                    <div :style="{ color: entryColor(e).border, opacity: 0.85 }">{{ formatTime(e.start_time) }} - {{ formatTime(e.end_time) }}</div>
                  </div>
                  <div v-if="!day.entries || day.entries.length === 0" class="text-fg-faint">—</div>
                </template>
              </div>
            </div>
          </template>
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
import { eventPalette } from '../utils/brandPalette'

const auth = useAuthStore()
const { t } = useI18n()
const accounts = ref([])
const companyToken = ref('')
const weekStart = ref('')
const weekDays = ref([])
const loading = ref(false)

const fetchAccounts = async () => {
  try {
    if (auth.user?.role === 'super-admin') {
      // super admin needs a company context; fallback: cannot list all accounts here. Ask to pick company first in a future iteration.
      // For now, try to derive the first company from admin users list or skip.
      accounts.value = []
    } else if (auth.user?.company_id) {
      const res = await api.listCompanyAccounts(auth.user.company_id)
      accounts.value = res?.data || []
      companyToken.value = accounts.value[0]?.company_token || ''
    }
  } catch {
    accounts.value = []
  }
}

const computeWeekStart = (baseDate) => {
  const d = new Date(baseDate)
  d.setDate(d.getDate() - d.getDay())
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const buildWeekDays = (startStr) => {
  const [y, m, d] = startStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const arr = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    arr.push({ date: day.toISOString().slice(0,10), label: day.getDate(), entries: [] })
  }
  weekDays.value = arr
}

// Deterministic per-person color palette so shifts are easy to distinguish
const SHIFT_COLORS = eventPalette()

const colorIndex = (e) => {
  const key = String(e.user_id ?? e.email ?? e.name ?? '')
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash % SHIFT_COLORS.length
}

const entryColor = (e) => SHIFT_COLORS[colorIndex(e)]

const entryStyle = (e) => {
  const c = entryColor(e)
  return {
    background: c.bg,
    borderLeft: `3px solid ${c.border}`
  }
}

const formatTime = (t) => {
  if (!t) return ''
  try {
    // t is a TIMESTAMPTZ, so create a Date object
    const date = new Date(t)
    // Format in company timezone
    const timezone = auth.user?.timezone || 'America/Lima'
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('Error formatting time:', error)
    return ''
  }
}

const loadCalendar = async () => {
  if (!companyToken.value) return
  try {
    loading.value = true
    if (!weekStart.value) weekStart.value = computeWeekStart(new Date())
    buildWeekDays(weekStart.value)
    const params = new URLSearchParams({ company_token: companyToken.value, week_start: weekStart.value })
    const res = await api.get(`/api/admin/shifts?${params.toString()}`)
    const data = res?.data || []
    // Map into weekDays
    for (const day of weekDays.value) {
      const found = data.find(x => x.date === day.date)
      day.entries = found?.entries || []
    }
  } catch {} finally {
    loading.value = false
  }
}

const prevWeek = () => {
  const [y, m, d] = weekStart.value.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  base.setDate(base.getDate() - 7)
  weekStart.value = computeWeekStart(base)
  loadCalendar()
}
const nextWeek = () => {
  const [y, m, d] = weekStart.value.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  base.setDate(base.getDate() + 7)
  weekStart.value = computeWeekStart(base)
  loadCalendar()
}

onMounted(async () => {
  await fetchAccounts()
  weekStart.value = computeWeekStart(new Date())
  await loadCalendar()
})
</script>

<style scoped>
</style>


