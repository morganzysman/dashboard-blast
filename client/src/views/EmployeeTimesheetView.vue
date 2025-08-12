<template>
  <div class="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
    <!-- Shifts calendar view -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-md font-semibold">My Shifts (This Week)</h3>
          <div class="text-xs text-gray-500">Account shown per day</div>
        </div>
        <div class="grid grid-cols-7 gap-2 text-xs">
          <div class="text-gray-500" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
          <template v-for="(day, idx) in weekDays" :key="idx">
            <div class="border rounded p-2 min-h-[80px]">
              <div class="text-[10px] text-gray-500">{{ day.label }}</div>
              <div class="mt-1 space-y-1" v-if="day.shift">
                <div class="text-gray-900 font-medium">{{ day.shift.account_name || day.shift.company_token }}</div>
                <div class="text-gray-600">{{ day.shift.start_time }} - {{ day.shift.end_time }}</div>
              </div>
              <div v-else class="text-gray-400">—</div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">My Timesheet</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="space-x-2">
            <button class="btn-secondary btn-sm" @click="prevPeriod">Prev</button>
            <button class="btn-secondary btn-sm" @click="nextPeriod">Next</button>
            <button class="btn-primary btn-sm" @click="loadEntries">Refresh</button>
          </div>
        </div>
        <div class="mt-4">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="py-2">Clock In</th>
                <th class="py-2">Clock Out</th>
                <th class="py-2">Duration</th>
                <th class="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in entries" :key="e.id" class="border-t">
                <td class="py-2">{{ formatDateTime(e.clock_in_at) }}</td>
                <td class="py-2">{{ e.clock_out_at ? formatDateTime(e.clock_out_at) : '—' }}</td>
                <td class="py-2">{{ formatDuration(secondsBetween(e.clock_in_at, e.clock_out_at)) }}</td>
                <td class="py-2 flex items-center justify-end gap-2"><span>{{ formatCurrency(e.amount) }}</span><span v-if="e.paid" class="text-green-600">$</span></td>
              </tr>
            </tbody>
          </table>
          <div class="mt-4 text-right text-gray-800 font-medium space-y-1">
            <div>Total time: {{ formatDuration(totalSeconds) }}</div>
            <div>Total earned: {{ formatCurrency(totalAmount) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recap Section -->
    <div class="card">
      <div class="card-body">
        <h3 class="text-md font-semibold text-gray-900 mb-3">Recap</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div class="bg-gray-50 rounded p-3">
            <div class="text-gray-500">Entries</div>
            <div class="text-gray-900 font-bold text-lg">{{ entries.length }}</div>
          </div>
          <div class="bg-gray-50 rounded p-3">
            <div class="text-gray-500">Total Time</div>
            <div class="text-gray-900 font-bold text-lg">{{ formatDuration(totalSeconds) }}</div>
          </div>
          <div class="bg-gray-50 rounded p-3">
            <div class="text-gray-500">Total Earned</div>
            <div class="text-gray-900 font-bold text-lg">{{ formatCurrency(totalAmount) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const entries = ref([])
const auth = useAuthStore()
const period = ref({ start: '', end: '' })

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const secondsBetween = (a,b) => {
  if (!a || !b) return 0
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime())/1000)
}

const totalSeconds = computed(() => entries.value.reduce((s, e) => s + secondsBetween(e.clock_in_at, e.clock_out_at), 0))
const totalAmount = computed(() => entries.value.reduce((s, e) => s + Number(e.amount || 0), 0))

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}

const formatDateTime = (iso) => new Date(iso).toLocaleString('en-CL', { timeZone: 'America/Santiago' })
const formatCurrency = (n) => {
  const symbol = auth.user?.currencySymbol || 'S/'
  return `${symbol} ${(Number(n)||0).toFixed(2)}`
}

// Build current week days and fetch shifts for the user
const weekDays = ref([])
const buildWeek = async () => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const list = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    list.push({ date: d, label: d.getDate(), shift: null })
  }
  // Fetch shifts assigned to this user
  try {
    const res = await api.get(`/api/admin/users/${auth.user.id}/shifts`)
    const shifts = res?.data || []
    for (let i = 0; i < list.length; i++) {
      const wd = list[i].date.getDay()
      const s = shifts.find(x => x.weekday === wd)
      if (s) list[i].shift = s
    }
  } catch {}
  weekDays.value = list
}

onMounted(buildWeek)

const loadEntries = async () => {
  const res = await api.getMyEntries()
  if (res.success) {
    entries.value = res.data
    period.value = res.period
  }
}

const shiftPeriod = (direction) => {
  // Allow preview by shifting client labels; actual API is current period only as spec
  // Keep UI navigation but still loads current period from API for safety
  loadEntries()
}

const prevPeriod = () => shiftPeriod(-1)
const nextPeriod = () => shiftPeriod(1)

loadEntries()
</script>

<style scoped>
</style>

