<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-3xl">
          <div class="modal-header flex items-center justify-between">
            <h3 class="text-md font-semibold">Manage Shifts - {{ user?.email }}</h3>
            <div class="space-x-2">
              <button class="btn-secondary btn-xs" @click="$emit('close')">Close</button>
              <button class="btn-primary btn-xs" :disabled="saving" @click="saveAll">{{ saving ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
          <div class="modal-body">
            <p class="text-xs text-gray-500 mb-3">Define weekly shifts per account. Times are local (HH:MM, 24h).</p>

            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 bg-white z-10 dark:bg-gray-800">
                  <tr class="text-left text-gray-600 dark:text-gray-300">
                    <th class="py-2 pr-2">Weekday</th>
                    <th class="py-2 pr-2">Account</th>
                    <th class="py-2 pr-2">Start</th>
                    <th class="py-2 pr-2">End</th>
                    <th class="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="wd in displayOrder" :key="wd" class="border-t hover:bg-gray-50 odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800 dark:hover:bg-gray-700">
                    <td class="py-2 pr-2 w-28">{{ weekdayLabel(wd) }}</td>
                    <td class="py-2 pr-2">
                      <select v-model="form[wd].company_token" class="form-input w-full">
                        <option value="">—</option>
                        <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
                          {{ acc.account_name || acc.company_token }}
                        </option>
                      </select>
                    </td>
                    <td class="py-2 pr-2 w-28">
                      <input v-model="form[wd].start_time" type="time" class="form-input w-full" />
                    </td>
                    <td class="py-2 pr-2 w-28">
                      <input v-model="form[wd].end_time" type="time" class="form-input w-full" />
                    </td>
                    <td class="py-2 pr-2 w-24">
                      <button class="btn-danger btn-xs" @click="clearDay(wd)" :disabled="!form[wd].company_token && !form[wd].start_time && !form[wd].end_time">Clear</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-semibold text-gray-900">Preview (This Week)</h4>
                <span class="text-xs text-gray-500 hidden sm:inline">Shows current selections per weekday</span>
              </div>
              <div class="grid grid-cols-7 gap-2 text-xs">
                <div class="text-gray-500" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
                <template v-for="day in weekDays" :key="day.dateStr">
                  <div class="border rounded p-2 min-h-[80px]">
                    <div class="text-[10px] text-gray-500">{{ day.label }}</div>
                    <div class="mt-1 space-y-1" v-if="form[day.weekday].company_token && form[day.weekday].start_time && form[day.weekday].end_time">
                      <div class="text-gray-900 font-medium">{{ accountNameFor(form[day.weekday].company_token) }}</div>
                      <div class="text-gray-600">{{ form[day.weekday].start_time }} - {{ form[day.weekday].end_time }}</div>
                    </div>
                    <div v-else class="text-gray-400">—</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <div class="flex justify-end gap-2">
              <button class="btn-secondary btn-sm" @click="$emit('close')">Close</button>
              <button class="btn-primary btn-sm" :disabled="saving" @click="saveAll">{{ saving ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/api'

const props = defineProps({
  user: { type: Object, required: true },
  companyId: { type: String, required: false }
})

const accounts = ref([])
const saving = ref(false)

// internal form state keyed by weekday number (0..6)
const form = ref({
  0: { id: null, company_token: '', start_time: '', end_time: '' },
  1: { id: null, company_token: '', start_time: '', end_time: '' },
  2: { id: null, company_token: '', start_time: '', end_time: '' },
  3: { id: null, company_token: '', start_time: '', end_time: '' },
  4: { id: null, company_token: '', start_time: '', end_time: '' },
  5: { id: null, company_token: '', start_time: '', end_time: '' },
  6: { id: null, company_token: '', start_time: '', end_time: '' },
})

// Show Monday first: 1..6 then 0
const displayOrder = [1,2,3,4,5,6,0]
const weekdayLabel = (wd) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][wd]

// Build current week days for preview (Sunday..Saturday)
const weekDays = ref([])
const buildWeek = () => {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay())
  const arr = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    arr.push({ dateStr: `${yyyy}-${mm}-${dd}`, label: d.getDate(), weekday: d.getDay() })
  }
  weekDays.value = arr
}

const accountNameFor = (token) => {
  const acc = accounts.value.find(a => a.company_token === token)
  return acc?.account_name || token || '—'
}

const loadAccounts = async () => {
  // Prefer explicit companyId; otherwise infer from user
  const cid = props.companyId || props.user?.company?.id || props.user?.company_id || ''
  if (!cid) return
  try {
    const res = await api.listCompanyAccounts(cid)
    accounts.value = res?.data || []
  } catch {
    accounts.value = []
  }
}

const loadShifts = async () => {
  try {
    const res = await api.getUserShifts(props.user.id)
    const shifts = res?.data || []
    for (const s of shifts) {
      // Convert UTC timestamps to local time strings
      let startTime = ''
      let endTime = ''
      
      if (s.start_time) {
        const startDate = new Date(s.start_time)
        startTime = startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
      
      if (s.end_time) {
        const endDate = new Date(s.end_time)
        endTime = endDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
      
      console.log(`🕐 Converting shift times for weekday ${s.weekday}:`, {
        start: { utc: s.start_time, local: startTime },
        end: { utc: s.end_time, local: endTime }
      })
      
      form.value[s.weekday] = {
        id: s.id,
        company_token: s.company_token || '',
        start_time: startTime,
        end_time: endTime
      }
    }
  } catch (error) {
    console.error('❌ Error loading shifts:', error)
  }
}

const clearDay = (wd) => {
  form.value[wd] = { id: form.value[wd].id, company_token: '', start_time: '', end_time: '' }
}

const saveAll = async () => {
  try {
    saving.value = true
    // Upsert or delete per weekday
    for (const wd of displayOrder) {
      const row = form.value[wd]
      const hasValues = !!row.company_token && !!row.start_time && !!row.end_time
      if (hasValues) {
        // Convert local time strings to UTC timestamps
        // Use a base date (e.g., 2000-01-01) since we only care about the time
        const baseDate = '2000-01-01'
        const startLocal = `${baseDate}T${row.start_time}:00`
        const endLocal = `${baseDate}T${row.end_time}:00`
        
        // Create Date objects in local timezone
        const startDate = new Date(startLocal)
        const endDate = new Date(endLocal)
        
        // Convert to UTC ISO strings
        const startUtc = startDate.toISOString()
        const endUtc = endDate.toISOString()
        
        console.log(`🕐 Converting shift times for weekday ${wd}:`, {
          start: { local: row.start_time, utc: startUtc },
          end: { local: row.end_time, utc: endUtc }
        })
        
        await api.upsertUserShift(props.user.id, {
          company_token: row.company_token,
          weekday: wd,
          start_time: startUtc,
          end_time: endUtc
        })
      } else if (row.id) {
        await api.deleteUserShift(props.user.id, row.id)
      }
    }
    // Send a single notify call after all saves/deletes are done
    try { await api.notifyUserShift(props.user.id) } catch {}
    window.showNotification?.({ type: 'success', title: 'Shifts', message: 'Shifts saved' })
    saving.value = false
    // Reload to refresh ids
    await loadShifts()
  } catch (e) {
    saving.value = false
    window.showNotification?.({ type: 'error', title: 'Shifts', message: e?.message || 'Failed to save shifts' })
  }
}


onMounted(async () => {
  buildWeek()
  await Promise.all([loadAccounts(), loadShifts()])
})
</script>

<style scoped>
</style>



