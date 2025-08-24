<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ $t('payroll.title') }}</h2>
            <p class="text-sm text-gray-600">{{ $t('payroll.payrollPeriod') }}: {{ periodLabel }}</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div class="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button class="btn-secondary btn-sm flex items-center gap-1 rounded-none" @click="prevPeriod">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <span class="hidden xs:inline">{{ $t('common.previous') }}</span>
              </button>
              <button class="btn-secondary btn-sm flex items-center gap-1 border-l border-gray-200 rounded-none" @click="nextPeriod">
                <span class="hidden xs:inline">{{ $t('common.next') }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div class="inline-flex gap-2">
              <button class="btn-primary btn-sm" :disabled="paying || !companyToken" @click="markPaid">{{ paying ? $t('payroll.marking') : $t('payroll.markAsPaid') }}</button>
            </div>
          </div>
        </div>
        
        <div class="mt-4">
          <div class="mb-3 flex items-center gap-2 flex-wrap">
            <template v-if="isSuperAdmin">
              <label class="text-xs text-gray-700">{{ $t('admin.company') }}</label>
              <select v-model="selectedCompanyId" class="form-input" @change="loadCompanyAccounts">
                <option value="">{{ $t('rentability.selectCompany') }}</option>
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </template>

            <label class="text-xs text-gray-700">{{ $t('rentability.account') }}</label>
            <select v-model="companyToken" class="form-input" @change="loadEntries">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">{{ acc.account_name || acc.company_token }}</option>
            </select>
            <button class="btn-secondary btn-sm" @click="loadEntries">{{ $t('common.load') }}</button>
            <button v-if="companyToken" class="btn-secondary btn-sm" @click="downloadQr">{{ $t('payroll.downloadQR') }}</button>
          </div>
          
          <!-- Employee Summary Table -->
          <div class="mb-4">
            <h3 class="text-md font-semibold text-gray-900 mb-3">{{ $t('payroll.employeeSummary') }}</h3>
          </div>
          <ResponsiveTable
            :items="rows"
            :columns="[
              { key: 'employee', label: $t('payroll.employee'), skeletonWidth: 'w-40' },
              { key: 'count', label: $t('payroll.entries'), skeletonWidth: 'w-20' },
              { key: 'lateCount', label: $t('payroll.lateCount'), skeletonWidth: 'w-24' },
              { key: 'amount', label: $t('common.amount'), cellClass: 'text-right', skeletonWidth: 'w-16' },
              { key: 'actions', label: $t('companies.actions'), skeletonWidth: 'w-16' }
            ]"
            :stickyHeader="true"
            :loading="loading"
            rowKeyField="user_id"
            mobileTitleField="employee"
          >
            <template #cell-employee="{ item }">
                {{ item.employeeName || item.user_id }}
            </template>
            <template #cell-count="{ item }">
              <div class="flex items-center gap-1">
                <span>{{ item.count }}</span>
                <span v-if="item.pendingApprovalCount > 0" class="text-orange-600 font-bold text-xs">
                  ({{ $t('payroll.missingApprovals', { count: item.pendingApprovalCount }) }})
                </span>
              </div>
            </template>
            <template #cell-lateCount="{ item }">
              <span :class="item.lateCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'">
                {{ item.lateCount }}
              </span>
            </template>

            <template #cell-amount="{ item }">{{ formatCurrency(item.amount) }}</template>
            <template #cell-actions="{ item }"><button class="btn-secondary btn-xs" @click="openEdit(item)">{{ $t('common.edit') }}</button></template>

            <template #mobile-card="{ item }">
              <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">{{ item.employeeName || item.user_id }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                {{ $t('payroll.entries') }}: {{ item.count }}
                <span v-if="item.pendingApprovalCount > 0" class="text-orange-600 font-bold ml-1">
                  ({{ $t('payroll.missingApprovals', { count: item.pendingApprovalCount }) }})
                </span>
              </div>
              <div class="text-xs" :class="item.lateCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'">{{ $t('payroll.lateCount') }}: {{ item.lateCount }}</div>
              <div class="text-xs text-gray-900 dark:text-gray-100 flex justify-between mt-1"><span>{{ $t('common.amount') }}</span><span>{{ formatCurrency(item.amount) }}</span></div>
              <div class="mt-2 text-right"><button class="btn-secondary btn-xs" @click="openEdit(item)">{{ $t('common.edit') }}</button></div>
            </template>
          </ResponsiveTable>
          
          <!-- Employee Summary -->
          <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ $t('payroll.summaryForEmployees', { count: rows.length }) }}
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-gray-100">
                {{ $t('payroll.totalAmount') }}: {{ formatCurrency(totalEmployeeAmount) }}
              </div>
            </div>
          </div>
          
          <!-- Simple calendar-like visualization -->
          <div class="mt-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 class="text-md font-semibold">{{ $t('payroll.entriesCalendar') }}</h3>
              <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
                <!-- Time status colors -->
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-blue-500"></div>
                  <span class="hidden sm:inline">{{ $t('payroll.onTimeLong') }}</span>
                  <span class="sm:hidden">{{ $t('payroll.onTime') }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-red-500"></div>
                  <span class="hidden sm:inline">{{ $t('payroll.lateLong') }}</span>
                  <span class="sm:hidden">{{ $t('payroll.late') }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-gray-500"></div>
                  <span class="hidden sm:inline">{{ $t('payroll.noShiftData') }}</span>
                  <span class="sm:hidden">{{ $t('payroll.noShiftData') }}</span>
                </div>
                <!-- Approval status icons -->
                <div class="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
                  <div class="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
                    <span class="text-white text-[6px] font-bold">✓</span>
                  </div>
                  <span class="hidden sm:inline">{{ $t('payroll.approved') }}</span>
                  <span class="sm:hidden">✓</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded-full bg-orange-500 flex items-center justify-center animate-pulse">
                    <span class="text-white text-[6px] font-bold">⋯</span>
                  </div>
                  <span class="hidden sm:inline">{{ $t('common.pending') }}</span>
                  <span class="sm:hidden">⋯</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3 text-xs">
              <div class="text-gray-500 hidden lg:block" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
              <div 
                v-for="day in calendarGrid" 
                :key="day.date || `empty-${day.index}`"
                class="border rounded p-2 min-h-[100px]"
                :class="!day.date ? 'bg-gray-50' : ''"
              >
                <div class="text-[10px] text-gray-400 text-center lg:hidden">{{ day.weekday || '' }}</div>
                <div class="text-[10px] text-gray-500 text-center">{{ day.label || '' }}</div>
                <div class="space-y-1 mt-1" v-if="day.date">
                  <div 
                    v-for="e in day.entries" 
                    :key="e.id" 
                    class="relative group rounded px-1 py-0.5 text-[10px] text-white cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105" 
                    :style="{ backgroundColor: getEntryColor(e) }"
                    @mouseenter="showEntryTooltip(e, $event)"
                    @mouseleave="hideEntryTooltip"
                    @click="openCalendarEntryActions(e, $event)"
                  >
                    <!-- Entry content -->
                    <div class="flex justify-between items-center gap-x-1">
                      <span class="truncate">{{ userName(e.user_id) }}</span>
                      <div class="flex items-center gap-1">
                        <!-- Review warning icon for complex entries -->
                        <div v-if="isComplexEntry(e) && !e.approved_by && e.clock_out_at && !e.paid"
                             class="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center"
                             :title="$t('payroll.reviewRecommended')">
                          <span class="text-white text-[8px] font-bold">!</span>
                        </div>
                        <!-- Approval status icon - larger and more prominent -->
                                <div v-if="e.approved_by"
              class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
              :title="`Approved by ${e.approved_by_name || 'Manager'}`">
          <span class="text-white text-[8px] font-bold">✓</span>
        </div>
        <div v-else-if="e.clock_out_at && !e.paid"
              class="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center animate-pulse"
              :title="$t('payroll.pendingApproval')">
          <span class="text-white text-[8px] font-bold">⋯</span>
        </div>
                        
                        <!-- Payment status icon -->
                        <div v-if="e.paid" 
                             class="w-3 h-3 rounded-full bg-yellow-500 flex items-center justify-center ml-1" 
                             :title="$t('payroll.paid')">
                          <span class="text-white text-[6px] font-bold">$</span>
                        </div>
                      </div>
                    </div>
                    <div class="text-[9px] opacity-90 mt-1">
                      {{ formatTime(e.clock_in_at) }} - {{ e.clock_out_at ? formatTime(e.clock_out_at) : '...' }}
                    </div>
                    <div class="text-[9px] font-medium mt-0.5">
                      {{ e.amount ? formatCurrency(e.amount) : '' }}
                    </div>
                    
                    <!-- Mobile action buttons (always visible on mobile) -->
                    <div v-if="e.clock_out_at" class="flex gap-1 mt-1 lg:hidden">
                      <!-- Edit button for non-approved and non-paid entries -->
                      <button 
                        v-if="!e.approved_by && !e.paid"
                        @click.stop="openEditEntry(e)"
                        class="btn-secondary btn-sm flex-1 !px-1 !py-0.5"
                        :aria-label="$t('payroll.editEntry')"
                      >
                        ✏️
                      </button>
                      
                      <!-- Quick approve button for pending entries -->
                      <button 
                        v-if="!e.approved_by && !e.paid"
                        @click.stop="quickApproveEntry(e.id)"
                        :disabled="approvingEntry === e.id"
                        class="btn-success btn-sm flex-1 disabled:opacity-50 !px-1 !py-0.5"
                        :aria-label="approvingEntry === e.id ? 'Approving' : 'Quick approve'"
                      >
                        {{ approvingEntry === e.id ? '⏳' : '✓' }}
                      </button>
                      
                      <!-- Edit & Approve button for complex cases -->
                      <button 
                        v-if="!e.approved_by && !e.paid && isComplexEntry(e)"
                        @click.stop="editBeforeApprove(e)"
                        class="btn-warning btn-sm flex-1 !px-1 !py-0.5"
                        :aria-label="$t('payroll.reviewAndApprove')"
                      >
                        🔍
                      </button>
                      
                      <!-- Already approved indicator -->
                      <div 
                        v-if="e.approved_by"
                        class="flex-1 px-1 py-0.5 bg-green-800 text-white rounded text-[8px] font-medium text-center"
                      >
                        ✅
                      </div>
                    </div>
                    
                    <!-- Desktop hover overlay with actions (hidden on mobile) -->
                    <div 
                      v-if="e.clock_out_at"
                      class="absolute inset-0 bg-black bg-opacity-80 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1 hidden lg:flex"
                      @click.stop
                    >
                      <!-- Edit button for non-approved and non-paid entries -->
                      <button 
                        v-if="!e.approved_by && !e.paid"
                        @click="openEditEntry(e)"
                        class="btn-secondary btn-sm inline-flex items-center"
                        :aria-label="$t('payroll.editEntryTimesAndAmount')"
                      >
                        <span class="mr-0.5">✏️</span> {{ $t('common.edit') }}
                      </button>
                      
                      <!-- Quick approve button for pending entries -->
                      <button 
                        v-if="!e.approved_by && !e.paid"
                        @click="quickApproveEntry(e.id)"
                        :disabled="approvingEntry === e.id"
                        class="btn-success btn-sm inline-flex items-center disabled:opacity-50"
                        :aria-label="approvingEntry === e.id ? 'Approving' : 'Quick approve this entry'"
                      >
                        <span class="mr-0.5">{{ approvingEntry === e.id ? '⏳' : '✓' }}</span>
                        {{ approvingEntry === e.id ? $t('payroll.approving') : $t('payroll.approveEntry') }}
                      </button>
                      
                      <!-- Edit & Approve button for more complex cases -->
                      <button 
                        v-if="!e.approved_by && !e.paid && isComplexEntry(e)"
                        @click="editBeforeApprove(e)"
                        class="btn-warning btn-sm inline-flex items-center"
                        :aria-label="$t('payroll.reviewAndApproveEntry')"
                      >
                        <span class="mr-0.5">🔍</span> {{ $t('payroll.review') }}
                      </button>
                      
                      <!-- Already approved indicator -->
                      <div 
                        v-if="e.approved_by"
                        class="inline-flex items-center px-2 py-1 bg-green-800 text-white rounded text-[8px] font-medium"
                      >
                        <span class="mr-0.5">✅</span> {{ $t('payroll.approved') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Tooltip for calendar entries -->
    <div 
      v-if="entryTooltip.show"
      class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
      :style="{ left: entryTooltip.x + 'px', top: entryTooltip.y + 'px' }"
      v-html="entryTooltip.content"
    ></div>

    <!-- Edit Modal -->
    <div v-if="editEntry" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-4 w-full max-w-2xl">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-md font-semibold">{{ $t('payroll.editEntries') }} - {{ userName(editEntry.user_id) }}</h3>
          <button class="btn-secondary btn-xs" @click="addNewEntry">{{ $t('payroll.addEntry') }}</button>
        </div>
        <p class="text-xs text-gray-500 mb-3">{{ $t('payroll.payrollPeriod') }}: {{ periodLabel }} • {{ $t('payroll.timesShownIn') }} {{ auth.user?.timezone || 'America/Lima' }}</p>
        <div class="max-h-[60vh] overflow-auto space-y-3 pr-1">
          <div v-for="(e, idx) in editEntry.list" :key="e.id || `new-${idx}`" class="relative grid grid-cols-1 sm:grid-cols-3 gap-2 items-end rounded p-2" :class="e.paid ? 'bg-gray-50 opacity-70' : e.approved_by ? 'bg-green-50 opacity-70' : isComplexEntry(e) ? 'bg-yellow-50' : 'bg-white'">
            <!-- AI Smart Detection Warning -->
            <div v-if="!e.paid && !e.approved_by && isComplexEntry(e)" class="col-span-full mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <div class="flex items-center gap-2 text-xs text-yellow-800">
                <span class="text-yellow-600">🤖</span>
                <span class="font-medium">{{ $t('payroll.aiReviewRequired') }}:</span>
                <span>{{ getSmartDetectionReason(e) }}</span>
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-700">{{ $t('payroll.clockIn') }}</label>
              <input 
                :value="toLocalDateTime(e.clock_in_at)" 
                @input="e.clock_in_at = fromLocalDateTime($event.target.value)" 
                type="datetime-local" 
                class="form-input w-full" 
                :disabled="e.paid || e.approved_by" 
              />
            </div>
            <div>
              <label class="text-xs text-gray-700">{{ $t('payroll.clockOut') }}</label>
              <input 
                :value="toLocalDateTime(e.clock_out_at)" 
                @input="e.clock_out_at = fromLocalDateTime($event.target.value)" 
                type="datetime-local" 
                class="form-input w-full" 
                :disabled="e.paid || e.approved_by" 
              />
            </div>
            <div>
              <label class="text-xs text-gray-700">{{ $t('common.amount') }}</label>
              <input v-model="e.amount" type="number" inputmode="decimal" min="0" step="any" class="form-input w-full" :disabled="e.paid || e.approved_by" />
            </div>
            <div class="sm:col-span-3 flex justify-end gap-2">
              <button v-if="!e.id" class="btn-danger btn-xs" @click="removeNewEntry(idx)">{{ $t('common.remove') }}</button>
              <button v-else-if="e.id && !e.paid && !e.approved_by" class="btn-danger btn-xs" @click="confirmDeleteEntry(e.id, idx)">{{ $t('common.delete') }}</button>
            </div>
          </div>
        </div>
        <div class="mt-3 text-right text-sm text-gray-600">{{ $t('payroll.totalSelected') }}: {{ editEntry.list.length }} • {{ $t('payroll.editable') }}: {{ editableCount }} • {{ $t('payroll.sum') }}: {{ formatCurrency(editableSum) }}</div>
        <div class="mt-4 flex justify-between">
          <div class="flex items-center gap-2">
            <span v-if="editEntry.approveAfterSave" class="text-xs text-green-600 font-medium">
              ✅ {{ $t('payroll.willApproveAfterSaving') }}
            </span>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary btn-sm" @click="editEntry=null">{{ $t('common.cancel') }}</button>
            <button 
              v-if="editEntry.approveAfterSave"
              class="btn-success btn-sm" 
              :disabled="editableCount === 0" 
              :class="{ 'opacity-50 cursor-not-allowed': editableCount === 0 }" 
              @click="saveEdit"
            >
              {{ $t('payroll.saveAndApprove') }}
            </button>
            <button 
              v-else
              class="btn-primary btn-sm" 
              :disabled="editableCount === 0" 
              :class="{ 'opacity-50 cursor-not-allowed': editableCount === 0 }" 
              @click="saveEdit"
            >
              {{ $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteConfirmation" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-gray-900">{{ $t('payroll.confirmDeletion') }}</h3>
          <p class="text-sm text-gray-600 mt-2">
            {{ $t('payroll.confirmDeleteEntry') }}
          </p>
        </div>
        
        <div class="flex justify-end gap-3">
          <button 
            class="btn-secondary btn-sm" 
            @click="cancelDeleteEntry"
            :disabled="deleting"
          >
            {{ $t('common.cancel') }}
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
              {{ $t('common.deleting') }}
            </div>
            <span v-else>{{ $t('payroll.deleteEntry') }}</span>
          </button>
        </div>
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

// Approvals state (for calendar interactions only)
const approvingEntry = ref(null)

// Tooltip state
const entryTooltip = ref({
  show: false,
  content: '',
  x: 0,
  y: 0
})

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const loadEntries = async () => {
  if (!companyToken.value) return
  loading.value = true
  try {
    const res = await api.getAdminEntries(companyToken.value)
    if (res.success) {
      entries.value = res.data
      period.value = res.period
      console.log('📥 Loaded entries:', {
        count: res.data.length,
        period: res.period,
        sampleEntries: res.data.slice(0, 3).map(e => ({
          id: e.id,
          clockInAt: e.clock_in_at,
          user: e.user_id,
          amount: e.amount
        }))
      })
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
      lateEntries: 0,
      pendingApprovals: 0
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
      
      // Count entries that need approval (clocked out but not approved)
      if (e.clock_out_at && !e.approved_by) {
        curr.pendingApprovals += 1
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
    lateCount: u.lateEntries,
    // Pending approval count: number of completed entries without approval
    pendingApprovalCount: u.pendingApprovals
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
  
  console.log('🗓️ Calendar period:', {
    start: period.value.start,
    end: period.value.end,
    timezone,
    entriesCount: entries.value.length
  })
  
  // Debug all entries to see what dates we have
  console.log('📊 All entries by date:', entries.value.reduce((acc, e) => {
    if (!e.clock_in_at) return acc
    const clockInDate = new Date(e.clock_in_at)
    const localDate = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
    if (!acc[localDate]) acc[localDate] = []
    acc[localDate].push({
      id: e.id,
      clockInAt: e.clock_in_at,
      user: userName(e.user_id),
      amount: e.amount
    })
    return acc
  }, {}))
  
  // Debug specific entries for August 21st
  const aug21Entries = entries.value.filter(e => {
    if (!e.clock_in_at) return false
    const clockInDate = new Date(e.clock_in_at)
    const localDate = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
    return localDate === '2025-08-21'
  })
  
  console.log('🔍 August 21st entries:', aug21Entries.map(e => ({
    id: e.id,
    clockInAt: e.clock_in_at,
    localDate: new Date(e.clock_in_at).toLocaleDateString('sv-SE', { timeZone: timezone }),
    user: userName(e.user_id)
  })))
  
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
      
      // Debug logging for date mapping
      if (localDate === iso) {
        console.log(`📅 Entry mapped to ${iso}:`, {
          entryId: e.id,
          clockInAt: e.clock_in_at,
          localDate,
          iso,
          timezone
        })
      }
      
      return localDate === iso
    })
    
    // Get weekday name for this date in company timezone
    // Create a date string in the company timezone and parse it to get the correct weekday
    const dateString = `${year}-${month}-${day}T12:00:00`
    const tempDate = new Date(dateString)
    const weekday = tempDate.toLocaleDateString('en-US', { 
      weekday: 'short',
      timeZone: timezone 
    })
    
    days.push({ 
      date: iso, 
      label: currentDate.getDate(), 
      entries: dayEntries,
      weekday: weekday
    })
    
    // Debug calendar day creation
    if (iso === '2025-08-21') {
      console.log('🗓️ Calendar day created for August 21st:', {
        date: iso,
        label: currentDate.getDate(),
        weekday: weekday,
        entriesCount: dayEntries.length,
        entries: dayEntries.map(e => ({
          id: e.id,
          user: userName(e.user_id),
          clockInAt: e.clock_in_at
        }))
      })
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Debug the final calendar days array
  console.log('📅 Final calendar days:', days.map(day => ({
    date: day.date,
    label: day.label,
    weekday: day.weekday,
    entriesCount: day.entries.length
  })))
  
  return days
})

// Create a proper calendar grid that aligns with weekdays
const calendarGrid = computed(() => {
  const days = daysInPeriod.value
  if (days.length === 0) return []
  
  const timezone = auth.user?.timezone || 'America/Lima'
  const grid = []
  
  // Find the first day of the period and get its weekday
  const firstDay = days[0]
  const firstDate = new Date(firstDay.date + 'T12:00:00')
  const firstWeekday = firstDate.toLocaleDateString('en-US', { 
    weekday: 'short',
    timeZone: timezone 
  })
  
  // Map weekdays to indices (0 = Sun, 1 = Mon, etc.)
  const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
  const firstWeekdayIndex = weekdayMap[firstWeekday]
  
  // Add empty cells before the first day to align with the weekday
  for (let i = 0; i < firstWeekdayIndex; i++) {
    grid.push({ date: null, index: i, isEmpty: true })
  }
  
  // Add all the actual days
  days.forEach((day, index) => {
    grid.push({ ...day, index: firstWeekdayIndex + index })
  })
  
  console.log('🗓️ Calendar grid created:', {
    firstDay: firstDay.date,
    firstWeekday,
    firstWeekdayIndex,
    totalCells: grid.length,
    emptyCells: firstWeekdayIndex
  })
  
  return grid
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
      paid: !!e.paid,
      approved_by: e.approved_by, // Track approval status for UI logic
      shift_start: e.shift_start, // Required for smart detection
      shift_end: e.shift_end // Required for smart detection
    }))
  }
}

const saveEdit = async () => {
  const list = editEntry.value.list || []
  const shouldApproveAfter = editEntry.value.approveAfterSave
  const entryIdsToApprove = []
  
  try {
    for (const e of list) {
      if (e.paid || e.approved_by) continue // Skip paid or approved entries
      const body = {
        clock_in_at: e.clock_in_at ? new Date(e.clock_in_at).toISOString() : null,
        clock_out_at: e.clock_out_at ? new Date(e.clock_out_at).toISOString() : null,
        amount: e.amount != null && e.amount !== '' ? Number(e.amount) : undefined
      }
      
      if (e.id) {
        await api.updateEntry(e.id, body)
        if (shouldApproveAfter && e.clock_out_at && !e.paid) {
          entryIdsToApprove.push(e.id)
        }
      } else {
        // New entry
        if (!body.clock_in_at) continue
        const newEntry = await api.createEntry({
          user_id: editEntry.value.user_id,
          company_token: companyToken.value,
          ...body
        })
        if (shouldApproveAfter && body.clock_out_at && newEntry.data?.id) {
          entryIdsToApprove.push(newEntry.data.id)
        }
      }
    }
    
    // If we should approve after saving, do it now
    if (shouldApproveAfter && entryIdsToApprove.length > 0) {
      for (const entryId of entryIdsToApprove) {
        await api.approveEntry(entryId)
      }
      
      window.showNotification?.({ 
        type: 'success', 
        title: 'Success', 
        message: `Entry saved and approved successfully` 
      })
    } else {
      window.showNotification?.({ 
        type: 'success', 
        title: 'Success', 
        message: 'Entry saved successfully' 
      })
    }
    
  } catch (error) {
    console.error('❌ Failed to save/approve entry:', error)
    window.showNotification?.({ 
      type: 'error', 
      title: 'Error', 
      message: 'Failed to save entry' 
    })
  }
  
  editEntry.value = null
  await loadEntries()
}

const editableCount = computed(() => (editEntry.value?.list || []).filter(e => !e.paid && !e.approved_by).length)
const editableSum = computed(() => (editEntry.value?.list || []).filter(e => !e.paid && !e.approved_by).reduce((s,e)=> s + Number(e.amount||0), 0))

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

// Calendar interaction functions
const showEntryTooltip = (entry, event) => {
  const timezone = auth.user?.timezone || 'America/Lima'
  const clockInTime = formatTime(entry.clock_in_at)
  const clockOutTime = entry.clock_out_at ? formatTime(entry.clock_out_at) : 'Still working'
  const duration = entry.clock_out_at ? formatDurationHours(entry.clock_in_at, entry.clock_out_at) : 'In progress'
  
  let statusText = ''
  if (entry.paid) {
    statusText = '✅ Paid'
  } else if (entry.approved_by) {
    statusText = `✅ Approved by ${entry.approved_by_name || 'Manager'}`
  } else if (entry.clock_out_at) {
            statusText = '⋯ Pending approval'
  } else {
    statusText = '🕒 Working'
  }
  
  const content = `
    <div class="text-sm font-medium">${userName(entry.user_id)}</div>
    <div class="text-xs text-gray-600 mt-1">
      <div><strong>Time:</strong> ${clockInTime} - ${clockOutTime}</div>
      <div><strong>Duration:</strong> ${duration}</div>
      <div><strong>Amount:</strong> ${entry.amount ? formatCurrency(entry.amount) : 'TBD'}</div>
      <div><strong>Status:</strong> ${statusText}</div>
    </div>
  `
  
  entryTooltip.value = {
    show: true,
    content,
    x: event.clientX + 10,
    y: event.clientY - 10
  }
}

const hideEntryTooltip = () => {
  entryTooltip.value.show = false
}

const openCalendarEntryActions = (entry, event) => {
  // If entry is pending approval, show quick actions
  if (entry.clock_out_at && !entry.approved_by && !entry.paid) {
    // Actions are handled by the hover overlay buttons
    return
  }
  
  // For other entries, just show the edit modal
  if (entry.clock_out_at) {
    openEditEntry(entry)
  }
}

// Approvals functionality

// Quick approve an entry without editing
const quickApproveEntry = async (entryId) => {
  approvingEntry.value = entryId
  try {
    const res = await api.approveEntry(entryId)
    if (res.success) {
      // Update the entry in the current entries list
      const entryIndex = entries.value.findIndex(e => e.id === entryId)
      if (entryIndex !== -1) {
        entries.value[entryIndex].approved_by = auth.user.id
        entries.value[entryIndex].approved_by_name = auth.user.name
      }
      
      window.showNotification?.({ 
        type: 'success', 
        title: 'Success', 
        message: 'Entry approved successfully' 
      })
      
      // Reload entries to get updated data
      await loadEntries()
    }
  } catch (e) {
    console.error('❌ Failed to approve entry:', e)
    window.showNotification?.({ 
      type: 'error', 
      title: 'Error', 
      message: 'Failed to approve entry' 
    })
  } finally {
    approvingEntry.value = null
  }
}

// Helper functions for smart detection
const getLateDuration = (entry) => {
  if (!entry.shift_start || !entry.clock_in_at) return 0
  
  const timezone = auth.user?.timezone || 'America/Lima'
  const clockInDate = new Date(entry.clock_in_at)
  const clockInTimeLocal = clockInDate.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  const clockInDateLocal = clockInDate.toLocaleDateString('sv-SE', { timeZone: timezone })
  const scheduledDateTime = new Date(`${clockInDateLocal}T${entry.shift_start}`)
  const actualDateTime = new Date(`${clockInDateLocal}T${clockInTimeLocal}`)
  
  const lateDurationMs = actualDateTime.getTime() - scheduledDateTime.getTime()
  return Math.round(lateDurationMs / (1000 * 60)) // minutes
}

const getWorkDuration = (entry) => {
  if (!entry.clock_in_at || !entry.clock_out_at) return 0
  return (new Date(entry.clock_out_at) - new Date(entry.clock_in_at)) / (1000 * 60 * 60) // hours
}

// Get human-readable reason for smart detection
const getSmartDetectionReason = (entry) => {
  const reasons = []
  
  // Check work duration whenever we have both times
  if (entry.clock_in_at && entry.clock_out_at) {
    const workDuration = getWorkDuration(entry)
    if (workDuration > 12) {
      reasons.push(`Long shift (${workDuration.toFixed(1)} hours)`)
    } else if (workDuration < 0.5) {
      reasons.push(`Very short shift (${(workDuration * 60).toFixed(0)} minutes)`)
    }
  }
  
  // Check lateness only if we have a scheduled shift start
  if (entry.shift_start && entry.clock_in_at) {
    const lateDuration = getLateDuration(entry)
    if (lateDuration > 30) {
      reasons.push(`${lateDuration} minutes late`)
    }
  }
  
  // Check if amount seems wrong or missing
  if (!entry.amount || entry.amount <= 0) {
    reasons.push("Missing or invalid amount") // TODO: Add to i18n
  }
  
  // If no specific reasons could be determined but shift data is missing, indicate it
  if (reasons.length === 0 && (!entry.shift_start || !entry.clock_in_at || !entry.clock_out_at)) {
    reasons.push("Missing shift or time data") // TODO: Add to i18n
  }
  
  return reasons.join(", ")
}

// Check if entry needs review before approval (complex cases)
const isComplexEntry = (entry) => {
  // Consider an entry complex if any of the following:
  // - Unusual hours (more than 12h or less than 30m) when both times exist
  // - Very late (more than 30 minutes) when shift start exists
  // - Missing or invalid amount
  
  if (entry.clock_in_at && entry.clock_out_at) {
    const workDuration = getWorkDuration(entry)
    if (workDuration > 12 || workDuration < 0.5) {
      return true
    }
  }
  
  if (entry.shift_start && entry.clock_in_at) {
    const lateDuration = getLateDuration(entry)
    if (lateDuration > 30) {
      return true
    }
  }
  
  if (!entry.amount || entry.amount <= 0) {
    return true
  }
  
  return false
}

// Open edit modal with approval context
const editBeforeApprove = (entry) => {
  editEntry.value = {
    user_id: entry.user_id,
    list: [{
      id: entry.id,
      clock_in_at: entry.clock_in_at,
      clock_out_at: entry.clock_out_at,
      amount: entry.amount,
      paid: entry.paid || false,
      approved_by: entry.approved_by,
      shift_start: entry.shift_start, // Required for smart detection
      shift_end: entry.shift_end // Required for smart detection
    }],
    approveAfterSave: true // Flag to approve after saving
  }
}

const approveEntry = async (entryId) => {
  approvingEntry.value = entryId
  try {
    const res = await api.approveEntry(entryId)
    if (res.success) {
      // Remove from pending approvals list
      pendingApprovals.value = pendingApprovals.value.filter(entry => entry.id !== entryId)
      window.showNotification?.({ 
        type: 'success', 
        title: 'Success', 
        message: 'Entry approved successfully' 
      })
    }
  } catch (e) {
    console.error('❌ Failed to approve entry:', e)
    window.showNotification?.({ 
      type: 'error', 
      title: 'Error', 
      message: 'Failed to approve entry' 
    })
  } finally {
    approvingEntry.value = null
  }
}

const openEditEntry = (entry) => {
  // Open the same edit modal but for a single entry in approval context
  editEntry.value = {
    user_id: entry.user_id,
    list: [{
      id: entry.id,
      clock_in_at: entry.clock_in_at,
      clock_out_at: entry.clock_out_at,
      amount: entry.amount,
      paid: entry.paid || false,
      approved_by: entry.approved_by,
      shift_start: entry.shift_start, // Required for smart detection
      shift_end: entry.shift_end // Required for smart detection
    }]
  }
}

// Utility functions for approvals tab
const formatDateTime = (iso) => {
  if (!iso) return '—'
  const timezone = auth.user?.timezone || 'America/Lima'
  return new Date(iso).toLocaleString('en-US', { 
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

const formatDurationHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return '—'
  const duration = (new Date(clockOut) - new Date(clockIn)) / 1000 / 3600
  return `${duration.toFixed(1)}h`
}

</script>

<style scoped>
</style>

