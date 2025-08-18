<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Payroll (Biweekly)</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div class="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button class="btn-secondary btn-sm flex items-center gap-1 rounded-none" @click="prevPeriod">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <span class="hidden xs:inline">Prev</span>
              </button>
              <button class="btn-secondary btn-sm flex items-center gap-1 border-l border-gray-200 rounded-none" @click="nextPeriod">
                <span class="hidden xs:inline">Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div class="inline-flex gap-2">
              <button class="btn-primary btn-sm" :disabled="paying || !companyToken" @click="markPaid">{{ paying ? 'Marking...' : 'Mark as Paid' }}</button>
            </div>
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
            <select v-model="companyToken" class="form-input" @change="loadEntries">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">{{ acc.account_name || acc.company_token }}</option>
            </select>
            <button class="btn-secondary btn-sm" @click="loadEntries">Load</button>
            <button v-if="companyToken" class="btn-secondary btn-sm" @click="downloadQr">Download QR</button>
          </div>
          <ResponsiveTable
            :items="rows"
            :columns="[
              { key: 'employee', label: 'Employee', skeletonWidth: 'w-40' },
              { key: 'count', label: 'Entries', skeletonWidth: 'w-10' },
              { key: 'shift', label: 'Shift Time', skeletonWidth: 'w-20' },
              { key: 'clocked', label: 'Clocked Time', skeletonWidth: 'w-20' },
              { key: 'variation', label: 'Variation', skeletonWidth: 'w-24' },
              ...(isSuperAdmin ? [] : [{ key: 'late', label: 'Accumulated Delay', skeletonWidth: 'w-16' }]),
              { key: 'amount', label: 'Amount', cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'actions', label: 'Actions', skeletonWidth: 'w-16' }
            ]"
            :stickyHeader="true"
            :loading="loading"
            rowKeyField="user_id"
            mobileTitleField="employee"
          >
            <template #cell-employee="{ item }">
              <span class="inline-flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: colorForUser(item.user_id) }"></span>
                {{ item.employeeName || item.user_id }}
              </span>
            </template>
            <template #cell-count="{ item }">{{ item.count }}</template>
            <template #cell-shift="{ item }">{{ formatDuration(item.shiftSeconds || 0) }}</template>
            <template #cell-clocked="{ item }">{{ formatDuration(item.totalSeconds) }}</template>
            <template #cell-variation="{ item }"><span :class="variationClass(item)">{{ variationLabel(item) }}</span></template>
            <template v-if="!isSuperAdmin" #cell-late="{ item }">{{ formatDuration(item.lateSeconds || 0) }}</template>
            <template #cell-amount="{ item }">{{ formatCurrency(item.amount) }}</template>
            <template #cell-actions="{ item }"><button class="btn-secondary btn-xs" @click="openEdit(item)">Edit</button></template>

            <template #mobile-card="{ item }">
              <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">{{ item.employeeName || item.user_id }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">Entries: {{ item.count }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">Shift: {{ formatDuration(item.shiftSeconds || 0) }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">Clocked: {{ formatDuration(item.totalSeconds) }}</div>
              <div class="text-xs" :class="variationClass(item)">Variation: {{ variationLabel(item) }}</div>
              <div v-if="!isSuperAdmin" class="text-xs text-gray-600 dark:text-gray-400">Delay: {{ formatDuration(item.lateSeconds || 0) }}</div>
              <div class="text-xs text-gray-900 dark:text-gray-100 flex justify-between mt-1"><span>Amount</span><span>{{ formatCurrency(item.amount) }}</span></div>
              <div class="mt-2 text-right"><button class="btn-secondary btn-xs" @click="openEdit(item)">Edit</button></div>
            </template>
          </ResponsiveTable>
          <!-- Simple calendar-like visualization -->
          <div class="mt-6">
            <h3 class="text-md font-semibold mb-2">Entries Calendar</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3 text-xs">
              <div class="text-gray-500 hidden lg:block" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
              <template v-for="day in daysInPeriod" :key="day.date">
                <div class="border rounded p-2 min-h-[100px]">
                  <div class="text-[10px] text-gray-400 text-center lg:hidden">{{ new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' }) }}</div>
                  <div class="text-[10px] text-gray-500 text-center">{{ new Date(day.date).getDate() }}</div>
                  <div class="space-y-1 mt-1">
                    <div v-for="e in day.entries" :key="e.id" class="rounded px-1 py-0.5 text-[10px] text-white flex flex-wrap justify-between items-center gap-x-1" :style="{ backgroundColor: colorForUser(e.user_id) }" :title="userName(e.user_id)">
                      <span class="truncate">{{ userName(e.user_id) }}</span>
                      <span>{{ formatTime(e.clock_in_at) }} - {{ e.clock_out_at ? formatTime(e.clock_out_at) : '...' }}</span>
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
        <p class="text-xs text-gray-500 mb-3">Period: {{ periodLabel }} • Times shown in {{ auth.user?.timezone || 'America/Lima' }}</p>
        <div class="max-h-[60vh] overflow-auto space-y-3 pr-1">
          <div v-for="(e, idx) in editEntry.list" :key="e.id || `new-${idx}`" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end rounded p-2" :class="e.paid ? 'bg-gray-50 opacity-70' : 'bg-white'">
            <div>
              <label class="text-xs text-gray-700">Clock In</label>
              <input 
                :value="toLocalDateTime(e.clock_in_at)" 
                @input="e.clock_in_at = fromLocalDateTime($event.target.value)" 
                type="datetime-local" 
                class="form-input w-full" 
                :disabled="e.paid" 
              />
            </div>
            <div>
              <label class="text-xs text-gray-700">Clock Out</label>
              <input 
                :value="toLocalDateTime(e.clock_out_at)" 
                @input="e.clock_out_at = fromLocalDateTime($event.target.value)" 
                type="datetime-local" 
                class="form-input w-full" 
                :disabled="e.paid" 
              />
            </div>
            <div>
              <label class="text-xs text-gray-700">Amount</label>
              <input v-model="e.amount" type="number" inputmode="decimal" min="0" step="any" class="form-input w-full" :disabled="e.paid" />
            </div>
            <div class="sm:col-span-3 flex justify-end gap-2">
              <button v-if="!e.id" class="btn-danger btn-xs" @click="removeNewEntry(idx)">Remove</button>
              <button v-else-if="e.id && !e.paid" class="btn-danger btn-xs" @click="confirmDeleteEntry(e.id, idx)">Delete</button>
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

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteConfirmation" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
          <p class="text-sm text-gray-600 mt-2">
            Are you sure you want to delete this time entry? This action cannot be undone.
          </p>
        </div>
        
        <div class="flex justify-end gap-3">
          <button 
            class="btn-secondary btn-sm" 
            @click="cancelDeleteEntry"
            :disabled="deleting"
          >
            Cancel
          </button>
          <button 
            class="btn-danger btn-sm"
            @click="deleteEntry"
            :disabled="deleting"
          >
            <div v-if="deleting" class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"></path>
              </svg>
              Deleting...
            </div>
            <span v-else>Delete Entry</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import ResponsiveTable from '../components/ui/ResponsiveTable.vue'

const auth = useAuthStore()
const loading = ref(false)
const isSuperAdmin = computed(() => auth.user?.role === 'super-admin')
const accounts = ref([])
const companies = ref([])
const selectedCompanyId = ref(auth.user?.company_id || '')
const companyToken = ref('')
const entries = ref([])
const period = ref({ start: '', end: '' })
const paying = ref(false)
const editEntry = ref(null)
const deleteConfirmation = ref(null)
const deleting = ref(false)

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const loadEntries = async () => {
  if (!companyToken.value) return
  loading.value = true
  try {
    const res = await api.getAdminEntries(companyToken.value)
    if (res.success) {
      entries.value = res.data
      period.value = res.period
      // map shift seconds per user id
      shiftSecondsByUser.value = res.shiftSeconds || {}
      lateSecondsByUser.value = res.lateSeconds || {}
    }
  } finally {
    loading.value = false
  }
}

// Group entries per user (only users with entries for the period)
const shiftSecondsByUser = ref({}) // { user_id: seconds }
const lateSecondsByUser = ref({}) // { user_id: seconds }
const groupByUser = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const key = e.user_id
    const curr = map.get(key) || { user_id: key, totalSeconds: 0, count: 0, employeeName: userName(key), totalAmount: 0 }
    
    // Calculate duration properly - times are already in UTC, just calculate difference
    let secs = 0
    if (e.clock_out_at && e.clock_in_at) {
      const clockIn = new Date(e.clock_in_at)
      const clockOut = new Date(e.clock_out_at)
      secs = (clockOut.getTime() - clockIn.getTime()) / 1000
    }
    
    curr.totalSeconds += Math.max(0, secs)
    curr.count += 1
    curr.totalAmount += Number(e.amount || 0)
    map.set(key, curr)
  }
  return Array.from(map.values()).map(u => ({
    ...u,
    shiftSeconds: Number(shiftSecondsByUser.value[u.user_id] || 0),
    lateSeconds: Number(lateSecondsByUser.value[u.user_id] || 0)
  })).sort((a,b)=> (a.employeeName||'').localeCompare(b.employeeName||''))
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
    const res = await api.get('/api/admin/users?roles=employee')
    const m = new Map()
    for (const u of res.users || []) { m.set(u.id, u.name) }
    userIdToName.value = m
  } catch {}
})()

// Convert UTC time to company timezone and format
const formatTime = (iso) => {
  const timezone = auth.user?.timezone || 'America/Lima'
  return new Date(iso).toLocaleTimeString('en-US', { 
    timeZone: timezone,
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

// Convert UTC datetime to local datetime-local format for editing
const toLocalDateTime = (utcIso) => {
  if (!utcIso) return ''
  const timezone = auth.user?.timezone || 'America/Lima'
  
  try {
    const utcDate = new Date(utcIso)
    
    // Get the date/time components in the target timezone
    const year = utcDate.toLocaleString('en-CA', { timeZone: timezone, year: 'numeric' })
    const month = utcDate.toLocaleString('en-CA', { timeZone: timezone, month: '2-digit' })
    const day = utcDate.toLocaleString('en-CA', { timeZone: timezone, day: '2-digit' })
    const hour = utcDate.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false })
    const minute = utcDate.toLocaleString('en-CA', { timeZone: timezone, minute: '2-digit' })
    
    return `${year}-${month}-${day}T${hour}:${minute}`
  } catch (error) {
    console.error('Error converting to local datetime:', error)
    return ''
  }
}

// Convert local datetime-local format back to UTC for saving
const fromLocalDateTime = (localDateTime) => {
  if (!localDateTime) return null
  const timezone = auth.user?.timezone || 'America/Lima'
  
  try {
    // Parse the local datetime
    const [datePart, timePart] = localDateTime.split('T')
    const [year, month, day] = datePart.split('-')
    const [hour, minute] = timePart.split(':')
    
    // Create a date string that represents the time in the company timezone
    // We'll construct an ISO string and then adjust for timezone
    const localIsoString = `${year}-${month}-${day}T${hour}:${minute}:00.000`
    
    // Get the timezone offset for this specific date/time
    const testDate = new Date()
    testDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day))
    testDate.setHours(parseInt(hour), parseInt(minute), 0, 0)
    
    // Get what this time would be in UTC if we interpret it as being in the local timezone
    const offsetMs = testDate.getTimezoneOffset() * 60000
    const utcEquivalent = new Date(testDate.getTime() + offsetMs)
    
    // Now get the timezone offset for the company timezone
    const companyTimeStr = utcEquivalent.toLocaleString('en-CA', { timeZone: timezone })
    const companyTime = new Date(companyTimeStr)
    const companyOffsetMs = utcEquivalent.getTime() - companyTime.getTime()
    
    // Calculate the final UTC time
    const finalUtc = new Date(testDate.getTime() - companyOffsetMs)
    
    return finalUtc.toISOString()
  } catch (error) {
    console.error('Error converting from local datetime:', error)
    // Fallback: treat as if it's already UTC
    return new Date(localDateTime).toISOString()
  }
}

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

const variationLabel = (row) => {
  const s = row.shiftSeconds || 0
  const c = row.totalSeconds || 0
  if (s === 0 && c === 0) return '—'
  const diff = c - s
  const pct = s > 0 ? (diff / s) * 100 : 0
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${formatDuration(Math.abs(diff))} (${sign}${pct.toFixed(0)}%)`
}
const variationClass = (row) => {
  const s = row.shiftSeconds || 0
  const c = row.totalSeconds || 0
  if (s === 0 && c === 0) return 'text-gray-600'
  if (c >= s) return 'text-green-600'
  return 'text-red-600'
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

  const confirmDeleteEntry = (entryId, entryIndex) => {
    deleteConfirmation.value = {
      entryId,
      entryIndex
    }
  }

  const cancelDeleteEntry = () => {
    deleteConfirmation.value = null
  }

  const deleteEntry = async () => {
    if (!deleteConfirmation.value) return
    
    deleting.value = true
    try {
      const result = await api.deleteEntry(deleteConfirmation.value.entryId)
      
      if (result.success) {
        // Remove the entry from the local list
        if (editEntry.value && editEntry.value.list) {
          editEntry.value.list.splice(deleteConfirmation.value.entryIndex, 1)
        }
        
        // Close confirmation modal
        deleteConfirmation.value = null
        
        // Show success message (you can implement a toast notification here)
        console.log('✅ Entry deleted successfully')
        
        // Reload entries to get updated data
        loadEntries()
      } else {
        console.error('❌ Failed to delete entry:', result.error)
        alert('Failed to delete entry: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Delete entry error:', error)
      alert('Failed to delete entry: ' + error.message)
    } finally {
      deleting.value = false
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
    if (companyToken.value) {
      await loadEntries()
    }
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

