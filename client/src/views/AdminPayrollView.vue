<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Payroll (Biweekly)</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="space-x-2">
            <button class="btn-secondary btn-sm" @click="prevPeriod">Prev</button>
            <button class="btn-secondary btn-sm" @click="nextPeriod">Next</button>
            <button class="btn-primary btn-sm" :disabled="paying || !companyToken" @click="markPaid">{{ paying ? 'Paying...' : 'Mark Paid & Lock' }}</button>
          </div>
        </div>
        <div class="mt-4">
          <div class="mb-3">
            <label class="text-xs text-gray-700">Account</label>
            <select v-model="companyToken" class="form-input">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">{{ acc.name || acc.company_token }}</option>
            </select>
            <button class="btn-secondary btn-sm ml-2" @click="loadEntries">Load</button>
          </div>
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="py-2">Employee</th>
                <th class="py-2">Entries</th>
                <th class="py-2">Total Time</th>
                <th class="py-2">Rate</th>
                <th class="py-2">Amount</th>
                <th class="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.user_id" class="border-t">
                <td class="py-2">{{ row.employeeName || row.user_id }}</td>
                <td class="py-2">{{ row.count }}</td>
                <td class="py-2">{{ formatDuration(row.totalSeconds) }}</td>
                <td class="py-2">{{ formatCurrency(row.hourly) }}</td>
                <td class="py-2">{{ formatCurrency(row.amount) }}</td>
                <td class="py-2">
                  <button class="btn-secondary btn-xs" @click="openEdit(row)">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editEntry" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-4 w-full max-w-md">
        <h3 class="text-md font-semibold mb-2">Edit Time Entry</h3>
        <div class="space-y-2">
          <label class="text-xs text-gray-700">Clock In</label>
          <input v-model="editEntry.clock_in_at" type="datetime-local" class="form-input w-full" />
          <label class="text-xs text-gray-700">Clock Out</label>
          <input v-model="editEntry.clock_out_at" type="datetime-local" class="form-input w-full" />
        </div>
        <div class="mt-3 flex justify-end space-x-2">
          <button class="btn-secondary btn-sm" @click="editEntry=null">Cancel</button>
          <button class="btn-primary btn-sm" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
const accounts = computed(() => auth.user?.userAccounts || [])
const companyToken = ref(accounts.value[0]?.company_token || '')
const entries = ref([])
const period = ref({ start: '', end: '' })
const paying = ref(false)
const editEntry = ref(null)

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const loadEntries = async () => {
  if (!companyToken.value) return
  const res = await api.getAdminEntries(companyToken.value)
  if (res.success) {
    entries.value = res.data
    period.value = res.period
  }
}

const groupByUser = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const key = e.user_id
    const curr = map.get(key) || { user_id: key, totalSeconds: 0, count: 0 }
    const secs = e.clock_out_at ? (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime())/1000 : 0
    curr.totalSeconds += Math.max(0, secs)
    curr.count += 1
    map.set(key, curr)
  }
  return Array.from(map.values())
})

const rows = computed(() => groupByUser.value.map(u => {
  // Rate display only (snapshot happens on pay)
  const hourly = 0
  const amount = (u.totalSeconds/3600) * hourly
  return { ...u, hourly, amount }
}))

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}
const formatCurrency = (n) => {
  const symbol = auth.user?.currencySymbol || 'S/'
  return `${symbol} ${(Number(n)||0).toFixed(2)}`
}

const prevPeriod = () => loadEntries()
const nextPeriod = () => loadEntries()

const markPaid = async () => {
  if (!companyToken.value) return
  try {
    paying.value = true
  const res = await api.markPaid(companyToken.value)
    if (res.success) {
      window.showNotification?.({ type: 'success', title: 'Payroll', message: 'Period marked as paid. Entries locked.' })
      loadEntries()
    }
  } finally {
    paying.value = false
  }
}

const openEdit = (row) => {
  // pick first entry of this user for simplicity (in real UI, list and pick a row)
  const e = entries.value.find(x => x.user_id === row.user_id)
  if (!e) return
  editEntry.value = { id: e.id, clock_in_at: e.clock_in_at?.slice(0,16), clock_out_at: e.clock_out_at?.slice(0,16) }
}

const saveEdit = async () => {
  const e = editEntry.value
  const body = {
    clock_in_at: e.clock_in_at ? new Date(e.clock_in_at).toISOString() : null,
    clock_out_at: e.clock_out_at ? new Date(e.clock_out_at).toISOString() : null
  }
  const res = await api.updateEntry(e.id, body)
  if (res.success) {
    editEntry.value = null
    loadEntries()
  }
}

loadEntries()
</script>

<style scoped>
</style>

