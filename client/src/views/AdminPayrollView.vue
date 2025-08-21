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

              { key: 'clocked', label: 'Clock In Time', skeletonWidth: 'w-20' },
              { key: 'lateCount', label: 'Late Count', skeletonWidth: 'w-24' },

              { key: 'amount', label: 'Amount', cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'actions', label: 'Actions', skeletonWidth: 'w-16' }
            ]"
            :stickyHeader="true"
            :loading="loading"
            rowKeyField="user_id"
            mobileTitleField="employee"
          >
            <template #cell-employee="{ item }">
                {{ item.employeeName || item.user_id }}
            </template>
            <template #cell-count="{ item }">{{ item.count }}</template>

            <template #cell-clocked="{ item }">{{ item.mostRecentClockIn ? formatTime(item.mostRecentClockIn) : '—' }}</template>
            <template #cell-lateCount="{ item }">
              <span :class="item.lateCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'">
                {{ item.lateCount }}
              </span>
            </template>

            <template #cell-amount="{ item }">{{ formatCurrency(item.amount) }}</template>
            <template #cell-actions="{ item }"><button class="btn-secondary btn-xs" @click="openEdit(item)">Edit</button></template>

            <template #mobile-card="{ item }">
              <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">{{ item.employeeName || item.user_id }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">Entries: {{ item.count }}</div>

              <div class="text-xs text-gray-600 dark:text-gray-400">Clock In: {{ item.mostRecentClockIn ? formatTime(item.mostRecentClockIn) : '—' }}</div>
              <div class="text-xs" :class="item.lateCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'">Late Count: {{ item.lateCount }}</div>

              <div class="text-xs text-gray-900 dark:text-gray-100 flex justify-between mt-1"><span>Amount</span><span>{{ formatCurrency(item.amount) }}</span></div>
              <div class="mt-2 text-right"><button class="btn-secondary btn-xs" @click="openEdit(item)">Edit</button></div>
            </template>
          </ResponsiveTable>
          
          <!-- Employee Summary -->
          <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Summary for {{ rows.length }} employee{{ rows.length !== 1 ? 's' : '' }}
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-gray-100">
                Total Amount: {{ formatCurrency(totalEmployeeAmount) }}
              </div>
            </div>
          </div>
          
          <!-- Simple calendar-like visualization -->
          <div class="mt-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-md font-semibold">Entries Calendar</h3>
              <div class="flex items-center gap-2 sm:gap-4 text-xs">
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-blue-500"></div>
                  <span class="hidden sm:inline">On time (≤5 min late)</span>
                  <span class="sm:hidden">On time</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-red-500"></div>
                  <span class="hidden sm:inline">Late (>5 min)</span>
                  <span class="sm:hidden">Late</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-gray-500"></div>
                  <span class="hidden sm:inline">No shift data</span>
                  <span class="sm:hidden">Future</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3 text-xs">
              <div class="text-gray-500 hidden lg:block" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
              <template v-for="day in daysInPeriod" :key="day.date">
                <div class="border rounded p-2 min-h-[100px]">
                  <div class="text-[10px] text-gray-400 text-center lg:hidden">{{ day.weekday }}</div>
                  <div class="text-[10px] text-gray-500 text-center">{{ day.label }}</div>
                  <div class="space-y-1 mt-1">
                    <div v-for="e in day.entries" :key="e.id" class="rounded px-1 py-0.5 text-[10px] text-white flex flex-wrap justify-between items-center gap-x-1" :style="{ backgroundColor: getEntryColor(e) }" :title="`${userName(e.user_id)} - ${getEntryTooltip(e)}`">
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
    }
  } finally {
    loading.value = false
  }
}

// Group entries per user (only users with entries for the period)
const groupByUser = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const key = e.user_id
    const curr = map.get(key) || { 
      user_id: key, 
      totalSeconds: 0, 
      count: 0, 
      employeeName: userName(key), 
      totalAmount: 0,
      clockInTimes: [],
      entries: [],
      lateEntries: 0
    }
    
    // Calculate duration properly - times are already in UTC, just calculate difference
    let secs = 0
    if (e.clock_in_at) {
      const clockIn = new Date(e.clock_in_at)
      let clockOut
      
      if (e.clock_out_at) {
        // Entry is complete - use actual clock out time
        clockOut = new Date(e.clock_out_at)
      } else {
        // Entry is still open - use current time for calculation
        clockOut = new Date()
      }
      
      secs = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 1000)
      
      // Store clock-in time for display
      curr.clockInTimes.push(e.clock_in_at)
      curr.entries.push(e)
      
      // Check if this entry is late (more than 5 minutes after shift start)
      if (e.shift_start) {
        // e.shift_start is now a TIME string (e.g., "16:00:00")
        // Compare with clock_in_at time in company timezone
        const timezone = auth.user?.timezone || 'America/Lima'
        
        // Get clock-in time in company timezone
        const clockInTimeLocal = clockIn.toLocaleTimeString('en-GB', {
          timeZone: timezone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
        
        // Parse both times for comparison (same date)
        const clockInDate = clockIn.toLocaleDateString('sv-SE', { timeZone: timezone })
        const scheduledDateTime = new Date(`${clockInDate}T${e.shift_start}`)
        const actualDateTime = new Date(`${clockInDate}T${clockInTimeLocal}`)
        
        const lateDurationMs = actualDateTime.getTime() - scheduledDateTime.getTime()
        const lateMinutes = lateDurationMs / (1000 * 60)
        
        if (lateMinutes > 5) {
          curr.lateEntries += 1
          console.log(`⏰ Late entry for ${userName(key)}:`, {
            clockIn: clockIn.toISOString(),
            clockInTimeLocal,
            shiftStart: e.shift_start,
            lateMinutes: Math.round(lateMinutes)
          })
        }
      }
      
      // Log for debugging
      if (!e.clock_out_at) {
        console.log(`⏰ Open entry for ${userName(key)}:`, {
          clockIn: clockIn.toISOString(),
          currentTime: clockOut.toISOString(),
          duration: formatDuration(secs)
        })
      }
    }
    
    curr.totalSeconds += Math.max(0, secs)
    curr.count += 1
    curr.totalAmount += Number(e.amount || 0)
    map.set(key, curr)
  }
  return Array.from(map.values()).map(u => ({
    ...u,
    // Show the most recent clock-in time for this user
    mostRecentClockIn: u.clockInTimes.length > 0 ? u.clockInTimes.sort().reverse()[0] : null,
    // Late count: number of entries where clock_in_at > shift_start + 5 minutes
    lateCount: u.lateEntries
  })).sort((a,b)=> (a.employeeName||'').localeCompare(b.employeeName||''))
})

const rows = computed(() => groupByUser.value.map(u => ({ ...u, amount: u.totalAmount })))

// Calculate total amount across all employees
const totalEmployeeAmount = computed(() => {
  return rows.value.reduce((total, employee) => total + (employee.amount || 0), 0)
})



// Color coding for calendar entries based on punctuality
const getEntryColor = (entry) => {
  const today = new Date()
  const clockInDate = new Date(entry.clock_in_at)
  
  // If entry is in the future, use gray
  if (clockInDate > today) {
    return '#6b7280' // gray-500
  }
  
  // For past entries, check punctuality if shift_start exists
  if (entry.shift_start) {
    // entry.shift_start is now a TIME string (e.g., "16:00:00")
    // Compare with clock_in_at time in company timezone
    const timezone = auth.user?.timezone || 'America/Lima'
    
    // Get clock-in time in company timezone
    const clockInTimeLocal = clockInDate.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    // Parse both times for comparison (same date)
    const clockInDateLocal = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
    const scheduledDateTime = new Date(`${clockInDateLocal}T${entry.shift_start}`)
    const actualDateTime = new Date(`${clockInDateLocal}T${clockInTimeLocal}`)
    
    const lateDurationMs = actualDateTime.getTime() - scheduledDateTime.getTime()
    const lateMinutes = lateDurationMs / (1000 * 60)
    
    // Blue if on time or less than 5 minutes late
    if (lateMinutes <= 5) {
      return '#3b82f6' // blue-500
    } else {
      return '#ef4444' // red-500
    }
  }
  
  // Default to gray if no shift_start data
  return '#6b7280' // gray-500
}

// Get tooltip text explaining the entry status
const getEntryTooltip = (entry) => {
  const today = new Date()
  const clockInDate = new Date(entry.clock_in_at)
  
  // If entry is in the future
  if (clockInDate > today) {
    return 'Future shift'
  }
  
  // For past entries, check punctuality if shift_start exists
  if (entry.shift_start) {
    // entry.shift_start is now a TIME string (e.g., "16:00:00")
    // Compare with clock_in_at time in company timezone
    const timezone = auth.user?.timezone || 'America/Lima'
    
    // Get clock-in time in company timezone
    const clockInTimeLocal = clockInDate.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    // Parse both times for comparison (same date)
    const clockInDateLocal = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
    const scheduledDateTime = new Date(`${clockInDateLocal}T${entry.shift_start}`)
    const actualDateTime = new Date(`${clockInDateLocal}T${clockInTimeLocal}`)
    
    const lateDurationMs = actualDateTime.getTime() - scheduledDateTime.getTime()
    const lateMinutes = Math.round(lateDurationMs / (1000 * 60))
    
    if (lateMinutes <= 0) {
      return `On time (${Math.abs(lateMinutes)} min early)`
    } else if (lateMinutes <= 5) {
      return `On time (${lateMinutes} min late)`
    } else {
      return `Late (${lateMinutes} min)`
    }
  }
  
  // Default for entries without shift data
  return 'No shift data'
}

// Calendar days within period with entry cards
const daysInPeriod = computed(() => {
  if (!period.value.start || !period.value.end) return []
  const timezone = auth.user?.timezone || 'America/Lima'
  
  const days = []
  
  // Parse period dates as local dates in company timezone
  // The server sends dates like "2025-08-16" which represent local dates
  // We need to treat them as dates in the company timezone, not UTC
  const startDateParts = period.value.start.split('-').map(Number)
  const endDateParts = period.value.end.split('-').map(Number)
  
  // Create local dates for start and end in company timezone
  // We'll iterate day by day and format each day in the company timezone
  let currentDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2])
  const endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2])
  
  while (currentDate <= endDate) {
    // Get the ISO date string that represents this day
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const iso = `${year}-${month}-${day}`
    
    // Filter entries by their clock_in_at date in company timezone
    const dayEntries = entries.value.filter(e => {
      if (!e.clock_in_at) return false
      // Convert UTC clock_in_at to company timezone date
      const clockInDate = new Date(e.clock_in_at)
      const localDate = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
      return localDate === iso
    })
    
    // Get weekday name for this date in company timezone
    const tempDate = new Date(year, currentDate.getMonth(), currentDate.getDate(), 12, 0, 0)
    const weekday = tempDate.toLocaleDateString('en-US', { weekday: 'short' })
    
    days.push({ 
      date: iso, 
      label: currentDate.getDate(), 
      entries: dayEntries,
      weekday: weekday
    })
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
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
    // Parse the UTC ISO string
    const utcDate = new Date(utcIso)
    
    // Format the date in the company timezone
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    })
    
    // Get the parts in the company timezone
    const parts = formatter.formatToParts(utcDate)
    const dateParts = {}
    parts.forEach(part => {
      dateParts[part.type] = part.value
    })
    
    // Build the datetime-local string (YYYY-MM-DDThh:mm)
    const result = `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}`
    
    console.log(`🕐 Converting UTC ${utcIso} to local ${result}`, {
      input: utcIso,
      timezone,
      utcDate: utcDate.toISOString(),
      localResult: result,
      timezoneName: parts.find(p => p.type === 'timeZoneName')?.value || 'unknown'
    })
    
    return result
  } catch (error) {
    console.error('❌ Error converting to local datetime:', error, {
      input: utcIso,
      timezone
    })
    return ''
  }
}

// Convert local datetime-local format back to UTC for saving
const fromLocalDateTime = (localDateTime) => {
  if (!localDateTime) return null
  const timezone = auth.user?.timezone || 'America/Lima'
  
  try {
    // Parse the input datetime string (YYYY-MM-DDTHH:mm)
    const [datePart, timePart] = localDateTime.split('T')
    
    // Create a proper datetime string for the company timezone
    const localDateTimeStr = `${datePart}T${timePart}:00`
    
    // Create a temporary date object and find the UTC equivalent
    // We'll use a simple approach: create dates in different timezones and compare
    
    // Method: Try different UTC offsets until we find one that formats 
    // to our target local time in the company timezone
    for (let offsetHours = -12; offsetHours <= 14; offsetHours++) {
      const testUtcTime = new Date(`${datePart}T${timePart}:00.000Z`)
      testUtcTime.setUTCHours(testUtcTime.getUTCHours() - offsetHours)
      
      // Format this UTC time in the company timezone
      const formattedInCompanyTz = testUtcTime.toLocaleString('sv-SE', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      // Check if this matches our target
      const targetFormat = `${datePart} ${timePart}:00`
      if (formattedInCompanyTz === targetFormat) {
        const utcResult = testUtcTime.toISOString()
        console.log(`🕐 Converting local ${localDateTime} (${timezone}) to UTC ${utcResult}`, {
          input: localDateTime,
          timezone,
          offsetHours,
          testUtcTime: testUtcTime.toISOString(),
          formattedInCompanyTz,
          targetFormat
        })
        return utcResult
      }
    }
    
    // If we couldn't find a match, throw an error
    throw new Error(`Could not find valid UTC conversion for ${localDateTime} in ${timezone}`)
    
  } catch (error) {
    console.error('❌ Error converting from local datetime:', error, {
      input: localDateTime,
      timezone
    })
    throw new Error(`Failed to convert time: ${error.message}`)
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

// Removed variationLabel and variationClass functions - replaced with late count logic

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
    list: list.map(e => ({ 
      id: e.id, 
      clock_in_at: e.clock_in_at, // Keep full ISO string for timezone conversion
      clock_out_at: e.clock_out_at, // Keep full ISO string for timezone conversion  
      amount: e.amount, 
      paid: !!e.paid 
    }))
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

