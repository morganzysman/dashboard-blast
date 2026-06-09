<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-3xl">
          <div class="modal-header flex items-center justify-between">
            <h3 class="text-md font-semibold">{{ $t('modals.shiftManager.title') }} - {{ user?.email }}</h3>
            <div class="space-x-2">
              <button class="btn-secondary btn-xs" @click="$emit('close')">{{ $t('common.close') }}</button>
              <button class="btn-primary btn-xs" :disabled="saving" @click="saveAll">{{ saving ? $t('common.loading') : $t('common.save') }}</button>
            </div>
          </div>
          <div class="modal-body">
            <p class="text-xs text-gray-500 mb-3">{{ $t('shifts.defineWeeklyShifts') }}</p>

            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 bg-white z-10 dark:bg-gray-800">
                  <tr class="text-left text-gray-600 dark:text-gray-300">
                    <th class="py-2 pr-2">{{ $t('shifts.weekday') }}</th>
                    <th class="py-2 pr-2">{{ $t('rentability.account') }}</th>
                    <th class="py-2 pr-2">{{ $t('common.start') }}</th>
                    <th class="py-2 pr-2">{{ $t('common.end') }}</th>
                    <th class="py-2 pr-2">{{ $t('companies.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="wd in displayOrder" :key="wd">
                    <tr
                      v-for="(shift, idx) in form[wd]"
                      :key="wd + '-' + idx"
                      :class="['hover:bg-gray-50 dark:hover:bg-gray-700', idx === 0 ? 'border-t border-gray-200 dark:border-gray-700' : '']"
                    >
                      <td class="py-2 pr-2 w-28 align-top font-medium text-gray-700 dark:text-gray-300">
                        <span v-if="idx === 0">{{ weekdayLabel(wd) }}</span>
                      </td>
                      <td class="py-2 pr-2">
                        <select v-model="shift.company_token" class="form-input w-full">
                          <option value="">—</option>
                          <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
                            {{ acc.account_name || acc.company_token }}
                          </option>
                        </select>
                      </td>
                      <td class="py-2 pr-2 w-28">
                        <input v-model="shift.start_time" type="time" class="form-input w-full" />
                      </td>
                      <td class="py-2 pr-2 w-28">
                        <input v-model="shift.end_time" type="time" class="form-input w-full" />
                      </td>
                      <td class="py-2 pr-2 w-44">
                        <div class="flex items-center gap-1">
                          <button
                            class="btn-danger btn-xs"
                            @click="removeShift(wd, idx)"
                            :disabled="form[wd].length === 1 && !shift.company_token && !shift.start_time && !shift.end_time"
                          >
                            {{ form[wd].length > 1 ? $t('common.remove') : $t('common.clear') }}
                          </button>
                          <button
                            v-if="idx === form[wd].length - 1"
                            class="btn-secondary btn-xs whitespace-nowrap"
                            @click="addShift(wd)"
                          >
                            + {{ $t('shifts.addShift') }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <div class="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <span>{{ $t('shifts.totalWeeklyHours') || 'Total hours / week' }}:</span>
              <span class="text-blue-600 dark:text-blue-400">{{ totalWeeklyHours }}</span>
            </div>

            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-semibold text-gray-900">{{ $t('shifts.previewThisWeek') }}</h4>
                <span class="text-xs text-gray-500 hidden sm:inline">{{ $t('shifts.showsCurrentSelections') }}</span>
              </div>
              <div class="grid grid-cols-7 gap-2 text-xs">
                <div class="text-gray-500" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
                <template v-for="day in weekDays" :key="day.dateStr">
                  <div class="border rounded p-2 min-h-[80px]">
                    <div class="text-[10px] text-gray-500">{{ day.label }}</div>
                    <template v-if="filledShifts(day.weekday).length">
                      <div class="mt-1 space-y-1" v-for="(s, i) in filledShifts(day.weekday)" :key="i">
                        <div class="text-gray-900 font-medium">{{ accountNameFor(s.company_token) }}</div>
                        <div class="text-gray-600">{{ s.start_time }} - {{ s.end_time }}</div>
                      </div>
                    </template>
                    <div v-else class="text-gray-400">—</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <div class="flex justify-end gap-2">
              <button class="btn-secondary btn-sm" @click="$emit('close')">{{ $t('common.close') }}</button>
              <button class="btn-primary btn-sm" :disabled="saving" @click="saveAll">{{ saving ? $t('common.loading') : $t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../utils/api'

const props = defineProps({
  user: { type: Object, required: true },
  companyId: { type: String, required: false }
})

const accounts = ref([])
const saving = ref(false)

// Helper to create an empty shift row
const emptyShift = () => ({ id: null, company_token: '', start_time: '', end_time: '' })

// internal form state keyed by weekday number (0..6); each day holds one or
// more shift blocks (split shifts). Every day always keeps at least one row so
// there is something to fill in.
const form = ref({
  0: [emptyShift()],
  1: [emptyShift()],
  2: [emptyShift()],
  3: [emptyShift()],
  4: [emptyShift()],
  5: [emptyShift()],
  6: [emptyShift()],
})

// Track ids that exist on the server so removed shifts get deleted on save
let originalIds = new Set()

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

// Shifts of a given weekday that have all fields filled
const filledShifts = (wd) => (form.value[wd] || []).filter(s => s.company_token && s.start_time && s.end_time)

const totalWeeklyHours = computed(() => {
  let totalMinutes = 0
  for (let wd = 0; wd < 7; wd++) {
    for (const row of form.value[wd]) {
      if (row.company_token && row.start_time && row.end_time) {
        const [sh, sm] = row.start_time.split(':').map(Number)
        const [eh, em] = row.end_time.split(':').map(Number)
        let diff = (eh * 60 + em) - (sh * 60 + sm)
        if (diff < 0) diff += 24 * 60 // overnight shift
        totalMinutes += diff
      }
    }
  }
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
})

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

// Convert a UTC timestamp to a local "HH:MM" string for the time inputs
const toLocalTimeInput = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const loadShifts = async () => {
  try {
    const res = await api.getUserShifts(props.user.id)
    const shifts = res?.data || []
    // Reset to empty days, then group server shifts by weekday
    const next = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    const ids = new Set()
    for (const s of shifts) {
      const wd = Number(s.weekday)
      if (!next[wd]) next[wd] = []
      next[wd].push({
        id: s.id,
        company_token: s.company_token || '',
        start_time: toLocalTimeInput(s.start_time),
        end_time: toLocalTimeInput(s.end_time)
      })
      if (s.id) ids.add(s.id)
    }
    // Ensure every day has at least one (empty) row to fill in
    for (let wd = 0; wd < 7; wd++) {
      if (!next[wd] || next[wd].length === 0) next[wd] = [emptyShift()]
    }
    form.value = next
    originalIds = ids
  } catch (error) {
    console.error('❌ Error loading shifts:', error)
  }
}

const addShift = (wd) => {
  form.value[wd].push(emptyShift())
}

const removeShift = (wd, idx) => {
  if (form.value[wd].length > 1) {
    form.value[wd].splice(idx, 1)
  } else {
    // Last row of the day: just clear it (deletion handled on save)
    form.value[wd].splice(idx, 1, emptyShift())
  }
}

const saveAll = async () => {
  try {
    saving.value = true
    const keptIds = new Set()
    // Upsert every filled shift across all days
    for (const wd of displayOrder) {
      for (const row of form.value[wd]) {
        const hasValues = !!row.company_token && !!row.start_time && !!row.end_time
        if (!hasValues) continue
        // Convert local time strings to UTC timestamps (only the time matters)
        const baseDate = '2000-01-01'
        const startUtc = new Date(`${baseDate}T${row.start_time}:00`).toISOString()
        const endUtc = new Date(`${baseDate}T${row.end_time}:00`).toISOString()
        const payload = {
          company_token: row.company_token,
          weekday: wd,
          start_time: startUtc,
          end_time: endUtc
        }
        if (row.id) payload.id = row.id
        const res = await api.upsertUserShift(props.user.id, payload)
        const savedId = res?.data?.id
        if (savedId) {
          row.id = savedId
          keptIds.add(savedId)
        }
      }
    }
    // Delete shifts that existed on the server but were removed/cleared
    for (const id of originalIds) {
      if (!keptIds.has(id)) {
        try { await api.deleteUserShift(props.user.id, id) } catch {}
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
