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
            <button class="btn-primary btn-sm" :disabled="paying || !companyToken" @click="markPaid">{{ paying ? 'Marking...' : 'Mark as Paid' }}</button>
          </div>
        </div>
        <div class="mt-4">
          <div class="mb-3 flex items-center gap-2 flex-wrap">
            <template v-if="isSuperAdmin">
              <label class="text-xs text-gray-700">Company</label>
              <select v-model="selectedCompanyId" class="form-input" @change="loadCompanyAccounts">
                <option value="">Select company</option>
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </template>

            <label class="text-xs text-gray-700">Account</label>
            <select v-model="companyToken" class="form-input">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">{{ acc.account_name || acc.company_token }}</option>
            </select>
            <button class="btn-secondary btn-sm" @click="loadEntries">Load</button>
            <button v-if="companyToken" class="btn-secondary btn-sm" @click="downloadQr">Download QR</button>
          </div>
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="py-2">Employee</th>
                <th class="py-2">Entries</th>
                <th class="py-2">Total Time</th>
                <th class="py-2">Amount</th>
                <th class="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.user_id" class="border-t">
                <td class="py-2">
                  <span class="inline-flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: colorForUser(row.user_id) }"></span>
                    {{ row.employeeName || row.user_id }}
                  </span>
                </td>
                <td class="py-2">{{ row.count }}</td>
                <td class="py-2">{{ formatDuration(row.totalSeconds) }}</td>
                <td class="py-2">{{ formatCurrency(row.amount) }}</td>
                <td class="py-2">
                  <button class="btn-secondary btn-xs" @click="openEdit(row)">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- Simple calendar-like visualization -->
          <div class="mt-6">
            <h3 class="text-md font-semibold mb-2">Entries Calendar</h3>
            <div class="grid grid-cols-7 gap-3 text-xs">
              <div class="text-gray-500" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
              <template v-for="day in daysInPeriod" :key="day.date">
                <div class="border rounded p-2 min-h-[120px]">
                  <div class="text-[10px] text-gray-500">{{ day.label }}</div>
                  <div class="space-y-1 mt-1">
                    <div v-for="e in day.entries" :key="e.id" class="rounded px-1 py-0.5 text-[10px] text-white flex flex-wrap justify-between items-center gap-x-1" :style="{ backgroundColor: colorForUser(e.user_id) }" :title="userName(e.user_id)">
                      <span class="truncate">{{ userName(e.user_id) }}</span>
                      <span class="">{{ formatTime(e.clock_in_at) }} - {{ e.clock_out_at ? formatTime(e.clock_out_at) : '...' }}</span>
                      <span class="ml-1">{{ e.amount ? formatCurrency(e.amount) : '' }}</span>
                      <span v-if="e.paid" class="ml-1 bg-green-600 text-white rounded px-1">$</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editEntry" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-4 w-full max-w-2xl">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-md font-semibold">Edit Entries - {{ userName(editEntry.user_id) }}</h3>
          <button class="btn-secondary btn-xs" @click="addNewEntry">Add Entry</button>
        </div>
        <p class="text-xs text-gray-500 mb-3">Period: {{ periodLabel }}</p>
        <div class="max-h-[60vh] overflow-auto space-y-3 pr-1">
          <div v-for="(e, idx) in editEntry.list" :key="e.id || `new-${idx}`" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end rounded p-2" :class="e.paid ? 'bg-gray-50 opacity-70' : 'bg-white'">
            <div>
              <label class="text-xs text-gray-700">Clock In</label>
              <input v-model="e.clock_in_at" type="datetime-local" class="form-input w-full" :disabled="e.paid" />
            </div>
            <div>
              <label class="text-xs text-gray-700">Clock Out</label>
              <input v-model="e.clock_out_at" type="datetime-local" class="form-input w-full" :disabled="e.paid" />
            </div>
            <div>
              <label class="text-xs text-gray-700">Amount</label>
              <input v-model.number="e.amount" type="number" min="0" step="0.01" class="form-input w-full" :disabled="e.paid" />
            </div>
            <div class="sm:col-span-3 flex justify-end" v-if="!e.id">
              <button class="btn-danger btn-xs" @click="removeNewEntry(idx)">Remove</button>
            </div>
          </div>
        </div>
        <div class="mt-3 text-right text-sm text-gray-600">Total selected: {{ editEntry.list.length }} • Editable: {{ editableCount }} • Sum: {{ formatCurrency(editableSum) }}</div>
        <div class="mt-4 flex justify-end gap-2">
          <button class="btn-secondary btn-sm" @click="editEntry=null">Cancel</button>
          <button class="btn-primary btn-sm" :disabled="editableCount === 0" :class="{ 'opacity-50 cursor-not-allowed': editableCount === 0 }" @click="saveEdit">Save</button>
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
const isSuperAdmin = computed(() => auth.user?.role === 'super-admin')
const accounts = ref([])
const companies = ref([])
const selectedCompanyId = ref(auth.user?.company_id || '')
const companyToken = ref('')
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

// Group entries per user, but include all company users even with zero entries
const allCompanyUsers = ref([]) // [{id,name}]
const groupByUser = computed(() => {
  const map = new Map()
  // seed with all users
  for (const u of allCompanyUsers.value) {
    map.set(u.id, { user_id: u.id, totalSeconds: 0, count: 0, employeeName: u.name || u.id, totalAmount: 0 })
  }
  for (const e of entries.value) {
    const key = e.user_id
    const curr = map.get(key) || { user_id: key, totalSeconds: 0, count: 0, employeeName: userName(key), totalAmount: 0 }
    const secs = e.clock_out_at ? (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime())/1000 : 0
    curr.totalSeconds += Math.max(0, secs)
    curr.count += 1
    curr.totalAmount += Number(e.amount || 0)
    map.set(key, curr)
  }
  return Array.from(map.values()).sort((a,b)=> (a.employeeName||'').localeCompare(b.employeeName||''))
})

const rows = computed(() => groupByUser.value.map(u => ({ ...u, amount: u.totalAmount })))

// Deterministic color per user
const colorForUser = (userId) => {
  const palette = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#22c55e']
  let hash = 0
  for (let i=0;i<userId.length;i++) hash = (hash*31 + userId.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

// Calendar days within period with entry cards
const daysInPeriod = computed(() => {
  if (!period.value.start || !period.value.end) return []
  const start = new Date(period.value.start)
  const end = new Date(period.value.end)
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const iso = d.toISOString().slice(0,10)
    const dayEntries = entries.value.filter(e => e.clock_in_at.slice(0,10) === iso)
    days.push({ date: iso, label: d.getDate(), entries: dayEntries })
  }
  return days
})

// Map user id to name
const userIdToName = ref(new Map())
const userName = (id) => userIdToName.value.get(id) || id

;(async () => {
  try {
    // Fetch only employees for current company to list in payroll even if no entries
    const res = await api.get('/api/admin/users?roles=employee')
    const m = new Map()
    const list = []
    for (const u of res.users || []) { m.set(u.id, u.name); list.push({ id: u.id, name: u.name }) }
    userIdToName.value = m
    allCompanyUsers.value = list
  } catch {}
})()

const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

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
  // list all entries for this user in current period
  const list = entries.value.filter(x => x.user_id === row.user_id)
  // Even if there are no entries, open the modal so admin can add manual ones
  editEntry.value = {
    user_id: row.user_id,
    list: list.map(e => ({ id: e.id, clock_in_at: e.clock_in_at?.slice(0,16), clock_out_at: e.clock_out_at?.slice(0,16), amount: e.amount, paid: !!e.paid }))
  }
}

const saveEdit = async () => {
  const list = editEntry.value.list || []
    for (const e of list) {
    if (e.paid) continue
      const body = {
        clock_in_at: e.clock_in_at ? new Date(e.clock_in_at).toISOString() : null,
        clock_out_at: e.clock_out_at ? new Date(e.clock_out_at).toISOString() : null,
        amount: e.amount != null && e.amount !== '' ? Number(e.amount) : undefined
      }
      if (e.id) {
        await api.updateEntry(e.id, body)
      } else {
        // New entry
        if (!body.clock_in_at) continue
        await api.createEntry({
          user_id: editEntry.value.user_id,
          company_token: companyToken.value,
          ...body
        })
      }
  }
  editEntry.value = null
  loadEntries()
}

const editableCount = computed(() => (editEntry.value?.list || []).filter(e => !e.paid).length)
const editableSum = computed(() => (editEntry.value?.list || []).filter(e => !e.paid).reduce((s,e)=> s + Number(e.amount||0), 0))

  const addNewEntry = () => {
    if (!editEntry.value) return
    editEntry.value.list = editEntry.value.list || []
    editEntry.value.list.unshift({ id: null, clock_in_at: '', clock_out_at: '', amount: '', paid: false, _isNew: true })
  }
  const removeNewEntry = (idx) => {
    if (!editEntry.value) return
    const item = editEntry.value.list[idx]
    if (item && !item.id) {
      editEntry.value.list.splice(idx, 1)
    }
  }

loadEntries()

// Fetch accounts based on role
const loadCompanyAccounts = async () => {
  if (!selectedCompanyId.value) { accounts.value = []; companyToken.value = ''; return }
  try {
    const res = await api.listCompanyAccounts(selectedCompanyId.value)
    accounts.value = res?.data || []
    companyToken.value = accounts.value[0]?.company_token || ''
  } catch (e) {
    accounts.value = []
    companyToken.value = ''
  }
}

// Initialize
;(async () => {
  if (isSuperAdmin.value) {
    // load companies first
    const res = await api.listCompanies().catch(() => null)
    companies.value = res?.data || []
    if (!selectedCompanyId.value && companies.value.length) {
      selectedCompanyId.value = companies.value[0].id
    }
  }
  if (!isSuperAdmin.value) {
    // admin: use their company
    selectedCompanyId.value = auth.user?.company_id || ''
  }
  await loadCompanyAccounts()
})()

// Download QR with session header and force-file download
const downloadQr = async () => {
  try {
    if (!companyToken.value) return
    const resp = await fetch(`/api/payroll/qr/${encodeURIComponent(companyToken.value)}/image`, {
      headers: { 'X-Session-ID': auth.sessionId }
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `Failed to download QR (${resp.status})`)
    }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${companyToken.value}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'QR Download', message: e.message || 'Failed to download QR' })
  }
}
</script>

<style scoped>
</style>

