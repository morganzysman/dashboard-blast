<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <!-- Header -->
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ $t('holidays.title') }}</h2>
            <p class="text-sm text-gray-600">{{ $t('holidays.subtitle') }}</p>
          </div>
        </div>

        <div class="mt-4">
          <!-- Company selector for super-admin -->
          <div class="mb-3 flex items-center gap-2 flex-wrap">
            <template v-if="isSuperAdmin">
              <label class="text-xs text-gray-700">{{ $t('admin.company') }}</label>
              <select v-model="selectedCompanyId" class="form-input" @change="loadSummary">
                <option value="">{{ $t('rentability.selectCompany') }}</option>
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </template>

            <!-- Search -->
            <div class="flex-1 min-w-[200px]">
              <input v-model="searchQuery" type="text" class="form-input w-full" :placeholder="$t('admin.searchUsers')" />
            </div>
          </div>

          <!-- KPI Summary -->
          <div v-if="!loading && employees.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div class="bg-blue-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-blue-700">{{ employees.length }}</div>
              <div class="text-xs text-blue-600">{{ $t('admin.employee') }}s</div>
            </div>
            <div class="bg-green-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-green-700">{{ totalAccrued }}</div>
              <div class="text-xs text-green-600">{{ $t('holidays.accrued') }}</div>
            </div>
            <div class="bg-orange-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-orange-700">{{ totalTaken }}</div>
              <div class="text-xs text-orange-600">{{ $t('holidays.taken') }}</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-purple-700">{{ avgBalance }}</div>
              <div class="text-xs text-purple-600">{{ $t('holidays.avgBalance') }}</div>
            </div>
          </div>

          <!-- Employee Table -->
          <ResponsiveTable
            :items="filteredEmployees"
            :columns="[
              { key: 'name', label: $t('common.name'), skeletonWidth: 'w-40' },
              { key: 'hired_at', label: $t('holidays.hiredAt'), skeletonWidth: 'w-24' },
              { key: 'months', label: $t('holidays.monthsOfService'), skeletonWidth: 'w-16' },
              { key: 'accrued', label: $t('holidays.accrued'), cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'taken', label: $t('holidays.taken'), cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'balance', label: $t('holidays.balance'), cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'actions', label: $t('companies.actions'), skeletonWidth: 'w-32' }
            ]"
            :stickyHeader="true"
            :loading="loading"
            rowKeyField="id"
            mobileTitleField="name"
          >
            <template #cell-name="{ item }">{{ item.name }}</template>
            <template #cell-hired_at="{ item }">
              <span v-if="item.hired_at" class="text-sm">{{ formatDate(item.hired_at) }}</span>
              <span v-else class="text-xs text-orange-500 italic">{{ $t('holidays.noHiredDate') }}</span>
            </template>
            <template #cell-months="{ item }">
              <span v-if="item.has_hired_date">{{ item.months_of_service }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
            <template #cell-accrued="{ item }">{{ item.accrued.toFixed(2) }}</template>
            <template #cell-taken="{ item }">{{ item.taken.toFixed(2) }}</template>
            <template #cell-balance="{ item }">
              <span :class="balanceColor(item.balance)" class="font-semibold">{{ item.balance.toFixed(2) }}</span>
            </template>
            <template #cell-actions="{ item }">
              <div class="flex gap-1">
                <button class="btn-primary btn-xs" @click="openRegister(item)" :disabled="!item.has_hired_date">{{ $t('holidays.registerHoliday') }}</button>
                <button class="btn-secondary btn-xs" @click="openHistory(item)">{{ $t('holidays.viewHistory') }}</button>
              </div>
            </template>

            <template #mobile-card="{ item }">
              <div class="font-medium text-gray-900 mb-1">{{ item.name }}</div>
              <div class="text-xs text-gray-600">
                {{ $t('holidays.hiredAt') }}: {{ item.hired_at ? formatDate(item.hired_at) : $t('holidays.noHiredDate') }}
              </div>
              <div class="text-xs text-gray-600">{{ $t('holidays.monthsOfService') }}: {{ item.has_hired_date ? item.months_of_service : '-' }}</div>
              <div class="flex justify-between text-xs mt-1">
                <span>{{ $t('holidays.accrued') }}: {{ item.accrued.toFixed(2) }}</span>
                <span>{{ $t('holidays.taken') }}: {{ item.taken.toFixed(2) }}</span>
                <span :class="balanceColor(item.balance)" class="font-semibold">{{ $t('holidays.balance') }}: {{ item.balance.toFixed(2) }}</span>
              </div>
              <div class="mt-2 flex gap-1">
                <button class="btn-primary btn-xs" @click="openRegister(item)" :disabled="!item.has_hired_date">{{ $t('holidays.registerHoliday') }}</button>
                <button class="btn-secondary btn-xs" @click="openHistory(item)">{{ $t('holidays.viewHistory') }}</button>
              </div>
            </template>
          </ResponsiveTable>
        </div>
      </div>
    </div>

    <!-- Register Holiday Modal -->
    <div v-if="registerModal" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-5 w-full max-w-md">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">{{ $t('holidays.registerHoliday') }}</h3>
          <button @click="registerModal = null" class="text-gray-400 hover:text-gray-600">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- Employee info -->
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="font-medium text-gray-900">{{ registerModal.name }}</div>
            <div class="text-sm text-gray-600">{{ $t('holidays.currentBalance') }}: <span :class="balanceColor(registerModal.balance)" class="font-semibold">{{ registerModal.balance.toFixed(2) }} {{ $t('common.days') }}</span></div>
          </div>

          <!-- Start date -->
          <div>
            <label class="form-label">{{ $t('holidays.startDate') }}</label>
            <input v-model="registerForm.start_date" type="date" class="form-input w-full" @change="autoCalcDays" />
          </div>

          <!-- End date -->
          <div>
            <label class="form-label">{{ $t('holidays.endDate') }}</label>
            <input v-model="registerForm.end_date" type="date" class="form-input w-full" @change="autoCalcDays" />
          </div>

          <!-- Days -->
          <div>
            <label class="form-label">{{ $t('holidays.days') }}</label>
            <input v-model.number="registerForm.days" type="number" step="0.5" min="0.5" class="form-input w-full" />
          </div>

          <!-- Note -->
          <div>
            <label class="form-label">{{ $t('common.notes') }} ({{ $t('common.optional') }})</label>
            <textarea v-model="registerForm.note" class="form-input w-full" rows="2"></textarea>
          </div>

          <!-- Validation error -->
          <div v-if="registerError" class="text-sm text-red-600 bg-red-50 rounded-lg p-2">{{ registerError }}</div>
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button @click="registerModal = null" class="btn-secondary">{{ $t('common.cancel') }}</button>
          <button @click="submitHoliday" class="btn-primary" :disabled="submitting">{{ submitting ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Employee History Modal -->
    <div v-if="historyModal" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-5 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">{{ historyModal.employee.name }}</h3>
            <p class="text-sm text-gray-600">
              {{ $t('holidays.balance') }}: <span :class="balanceColor(historyModal.employee.balance)" class="font-semibold">{{ historyModal.employee.balance.toFixed(2) }}</span>
              &middot; {{ $t('holidays.accrued') }}: {{ historyModal.employee.accrued.toFixed(2) }}
              &middot; {{ $t('holidays.taken') }}: {{ historyModal.employee.taken.toFixed(2) }}
            </p>
          </div>
          <button @click="historyModal = null" class="text-gray-400 hover:text-gray-600">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div v-if="historyLoading" class="text-center py-8 text-gray-500">{{ $t('common.loading') }}</div>

        <div v-else-if="historyRequests.length === 0" class="text-center py-8 text-gray-500">{{ $t('holidays.noHolidays') }}</div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-xs text-gray-500 uppercase">
              <th class="py-2 pr-2">{{ $t('holidays.startDate') }}</th>
              <th class="py-2 pr-2">{{ $t('holidays.endDate') }}</th>
              <th class="py-2 pr-2 text-right">{{ $t('holidays.days') }}</th>
              <th class="py-2 pr-2">{{ $t('common.notes') }}</th>
              <th class="py-2 pr-2">{{ $t('common.date') }}</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in historyRequests" :key="req.id" class="border-b last:border-0">
              <td class="py-2 pr-2">{{ formatDate(req.start_date) }}</td>
              <td class="py-2 pr-2">{{ formatDate(req.end_date) }}</td>
              <td class="py-2 pr-2 text-right font-medium">{{ parseFloat(req.days).toFixed(2) }}</td>
              <td class="py-2 pr-2 text-gray-600 max-w-[200px] truncate">{{ req.note || '-' }}</td>
              <td class="py-2 pr-2 text-xs text-gray-500">{{ formatDate(req.created_at) }}</td>
              <td class="py-2 text-right">
                <button v-if="deleteConfirmId !== req.id" class="text-red-500 hover:text-red-700 text-xs" @click="deleteConfirmId = req.id">{{ $t('common.delete') }}</button>
                <div v-else class="flex items-center gap-1 justify-end">
                  <button class="btn-danger btn-xs" :disabled="deletingId === req.id" @click="deleteHoliday(req.id)">{{ deletingId === req.id ? $t('common.deleting') : $t('common.confirm') }}</button>
                  <button class="btn-secondary btn-xs" @click="deleteConfirmId = null">{{ $t('common.cancel') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import ResponsiveTable from '../components/ui/ResponsiveTable.vue'

const auth = useAuthStore()
const { t } = useI18n()

// State
const loading = ref(false)
const employees = ref([])
const searchQuery = ref('')
const companies = ref([])
const selectedCompanyId = ref(auth.user?.company_id || '')
const isSuperAdmin = computed(() => auth.user?.role === 'super-admin')

// Register modal state
const registerModal = ref(null)
const registerForm = ref({ start_date: '', end_date: '', days: 1, note: '' })
const registerError = ref('')
const submitting = ref(false)

// History modal state
const historyModal = ref(null)
const historyRequests = ref([])
const historyLoading = ref(false)
const deleteConfirmId = ref(null)
const deletingId = ref(null)

// Computed
const filteredEmployees = computed(() => {
  if (!searchQuery.value) return employees.value
  const q = searchQuery.value.toLowerCase()
  return employees.value.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
})

const totalAccrued = computed(() => employees.value.reduce((s, e) => s + e.accrued, 0).toFixed(1))
const totalTaken = computed(() => employees.value.reduce((s, e) => s + e.taken, 0).toFixed(1))
const avgBalance = computed(() => {
  if (employees.value.length === 0) return '0.0'
  return (employees.value.reduce((s, e) => s + e.balance, 0) / employees.value.length).toFixed(1)
})

// Helpers
function balanceColor(balance) {
  if (balance <= 0) return 'text-red-600'
  if (balance <= 5) return 'text-orange-600'
  return 'text-green-600'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

// Data loading
const loadSummary = async () => {
  if (!selectedCompanyId.value) { employees.value = []; return }
  loading.value = true
  try {
    const res = await api.getHolidaySummary(selectedCompanyId.value)
    if (res.success) {
      employees.value = res.employees
    }
  } catch (e) {
    console.error('Failed to load holiday summary:', e)
    employees.value = []
  } finally {
    loading.value = false
  }
}

// Register holiday
function openRegister(emp) {
  registerModal.value = emp
  registerForm.value = { start_date: '', end_date: '', days: 1, note: '' }
  registerError.value = ''
}

function autoCalcDays() {
  const { start_date, end_date } = registerForm.value
  if (start_date && end_date) {
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (end >= start) {
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
      registerForm.value.days = diff
    }
  }
}

async function submitHoliday() {
  registerError.value = ''

  const { start_date, end_date, days, note } = registerForm.value
  if (!start_date || !end_date) {
    registerError.value = t('holidays.invalidDateRange')
    return
  }
  if (new Date(start_date) > new Date(end_date)) {
    registerError.value = t('holidays.invalidDateRange')
    return
  }
  if (!days || days <= 0) {
    registerError.value = t('holidays.invalidDays')
    return
  }
  if (days > registerModal.value.balance) {
    registerError.value = t('holidays.insufficientBalance')
    return
  }

  submitting.value = true
  try {
    const res = await api.createHolidayRequest({
      employee_id: registerModal.value.id,
      company_id: selectedCompanyId.value,
      start_date,
      end_date,
      days: parseFloat(days),
      note: note || null
    })

    if (res.success) {
      window.showNotification?.({ type: 'success', title: t('common.success'), message: t('holidays.holidayRegistered') })
      registerModal.value = null
      await loadSummary()
    } else {
      registerError.value = res.error || t('common.unknownError')
    }
  } catch (e) {
    registerError.value = e.data?.error || e.message || t('common.unknownError')
  } finally {
    submitting.value = false
  }
}

// View history
async function openHistory(emp) {
  historyModal.value = { employee: emp }
  historyRequests.value = []
  historyLoading.value = true
  deleteConfirmId.value = null

  try {
    const res = await api.getEmployeeHolidays(emp.id, selectedCompanyId.value)
    if (res.success) {
      historyModal.value = { employee: res.employee }
      historyRequests.value = res.requests
    }
  } catch (e) {
    console.error('Failed to load history:', e)
  } finally {
    historyLoading.value = false
  }
}

async function deleteHoliday(requestId) {
  deletingId.value = requestId
  try {
    const res = await api.deleteHolidayRequest(requestId, selectedCompanyId.value)
    if (res.success) {
      window.showNotification?.({ type: 'success', title: t('common.success'), message: t('holidays.holidayDeleted') })
      historyRequests.value = historyRequests.value.filter(r => r.id !== requestId)
      deleteConfirmId.value = null
      // Refresh summary to update balances
      await loadSummary()
      // Update the modal employee data
      if (historyModal.value) {
        const emp = employees.value.find(e => e.id === historyModal.value.employee.id)
        if (emp) historyModal.value = { employee: emp }
      }
    }
  } catch (e) {
    window.showNotification?.({ type: 'error', title: t('common.error'), message: e.message })
  } finally {
    deletingId.value = null
  }
}

// Initialize
;(async () => {
  if (isSuperAdmin.value) {
    const res = await api.listCompanies().catch(() => null)
    companies.value = res?.data || []
    if (!selectedCompanyId.value && companies.value.length) {
      selectedCompanyId.value = companies.value[0].id
    }
  }
  await loadSummary()
})()
</script>
