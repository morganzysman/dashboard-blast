<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-end gap-3">
          <div class="flex-1">
            <label class="text-xs text-gray-700">Account</label>
            <select v-model="companyToken" class="form-input w-full" @change="loadCalendar">
              <option value="" disabled>Select account</option>
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
                {{ acc.account_name || acc.company_token }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-secondary btn-sm" @click="prevWeek">Prev Week</button>
            <button class="btn-secondary btn-sm" @click="nextWeek">Next Week</button>
            <button class="btn-primary btn-sm" @click="loadCalendar">Refresh</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h3 class="text-md font-semibold">Shifts Calendar</h3>
          <div class="text-xs text-gray-500">Week of {{ weekStart }}</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <div class="text-gray-500 hidden lg:block" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
          <template v-for="day in weekDays" :key="day.date">
            <div class="border rounded p-2 min-h-[140px]">
              <div class="text-[10px] text-gray-500">{{ day.label }}</div>
              <div class="mt-1 space-y-1">
                <div v-if="loading" class="space-y-1 animate-pulse">
                  <div class="h-4 bg-gray-200 rounded"></div>
                  <div class="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <template v-else>
                  <div v-for="e in day.entries" :key="e.user_id + ':' + e.start_time" class="rounded px-1 py-0.5 bg-gray-100">
                    <div class="font-medium text-gray-900 truncate">{{ e.name || e.email }}</div>
                    <div class="text-gray-600">{{ formatTime(e.start_time) }} - {{ formatTime(e.end_time) }}</div>
                  </div>
                  <div v-if="!day.entries || day.entries.length === 0" class="text-gray-400">—</div>
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
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
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

const formatTime = (t) => t?.toString().slice(0,5)

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


