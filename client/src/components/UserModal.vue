<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-2xl" @click.stop>
      <!-- Modal Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          {{ isEdit ? 'Edit User' : 'Create New User' }}
        </h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Basic Info -->
        <div>
          <label class="form-label">Full Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            class="form-input"
            placeholder="Enter full name"
          />
        </div>

        <div>
          <label class="form-label">Email Address</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="form-input"
            placeholder="Enter email address"
            :disabled="isEdit"
          />
        </div>

        <div v-if="!isEdit">
          <label class="form-label">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            class="form-input"
            placeholder="Enter password"
            minlength="6"
          />
        </div>

        <!-- Role Selection -->
        <div>
          <label class="form-label">Role</label>
          <select v-model="form.role" class="form-input" required>
            <option value="">Select role</option>
            <option v-if="isSuperAdmin" value="super-admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </select>
          <p class="text-xs text-gray-500 mt-1" v-if="!isSuperAdmin">Admins can only create Admins and Employees for their company.</p>
        </div>

        <!-- Hourly Rate (for employees) -->
        <div v-if="form.role === 'employee'" class="grid grid-cols-2 gap-2">
          <div>
            <label class="form-label">Hourly Rate</label>
            <input
              v-model.number="form.hourly_rate"
              type="number"
              min="0"
              step="0.01"
              class="form-input"
              placeholder="0.00"
            />
          </div>
        </div>

        <!-- Company Selection (super-admin only) -->
        <div v-if="isSuperAdmin">
          <label class="form-label">Company (Tenant)</label>
          <select v-model="form.company_id" class="form-input">
            <option value="">Select a company</option>
            <option v-for="c in companies" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-1">As super-admin, set the tenant company. Admins default to their own company.</p>
        </div>

        <!-- Settings are managed at the company level -->

        <!-- Company notice -->
        <div class="border-t pt-4 text-sm text-gray-500">
          Accounts are managed under companies. Use the Companies screen to add or edit accounts.
        </div>

        <!-- Employee Warnings Section (for editing employees only) -->
        <div v-if="isEdit && form.role === 'employee' && auth.user?.role === 'admin'" class="border-t border-gray-200 dark:border-gray-600 pt-8 mt-8">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-yellow-100 dark:bg-yellow-950/40 rounded-lg">
                <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Employee Warnings</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">Manage disciplinary records and performance issues</p>
              </div>
            </div>
            <button type="button" @click="showAddWarningForm = !showAddWarningForm" 
                    class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800 transition-colors duration-200">
              <svg v-if="!showAddWarningForm" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              {{ showAddWarningForm ? 'Cancel' : 'Add Warning' }}
            </button>
          </div>
          
          <!-- Add Warning Form -->
          <div v-if="showAddWarningForm" class="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8 shadow-sm">
            <div class="flex items-center gap-2 mb-6">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <h5 class="text-lg font-medium text-red-900 dark:text-red-100">Issue New Warning</h5>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warning Category</label>
                <select v-model="warningForm.category" 
                        class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 dark:focus:border-red-400 dark:focus:ring-red-400" 
                        @change="onCategoryChange">
                  <option value="">Select category</option>
                  <option v-for="(cat, key) in warningCategories" :key="key" :value="key">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity Level</label>
                <select v-model="warningForm.severity" 
                        class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 dark:focus:border-red-400 dark:focus:ring-red-400">
                  <option value="low">🟡 Low - Minor infraction</option>
                  <option value="medium">🟠 Medium - Moderate concern</option>
                  <option value="high">🔴 High - Serious violation</option>
                  <option value="critical">⚫ Critical - Major infraction</option>
                </select>
              </div>
            </div>
            
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Specific Motive</label>
              <select v-model="warningForm.motive" 
                      class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 dark:focus:border-red-400 dark:focus:ring-red-400 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500" 
                      :disabled="!warningForm.category">
                <option value="">{{ warningForm.category ? 'Select specific motive' : 'Select category first' }}</option>
                <option v-for="motive in availableMotives" :key="motive" :value="motive">
                  {{ motive }}
                </option>
              </select>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description <span class="text-gray-500">(Optional)</span></label>
              <textarea v-model="warningForm.description" 
                       class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 dark:focus:border-red-400 dark:focus:ring-red-400" 
                       rows="3" 
                       placeholder="Provide additional details about the incident, circumstances, or any relevant context..."></textarea>
            </div>
            
            <button type="button" @click="addWarning" 
                    class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    :disabled="!warningForm.category || !warningForm.motive">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              Issue Warning
            </button>
          </div>
          
          <!-- Existing Warnings List -->
          <div>
            <div class="flex items-center justify-between mb-6">
              <h5 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Warning History</h5>
              <span class="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{{ userWarnings.length }} total</span>
            </div>
            
            <div class="space-y-4 max-h-72 overflow-y-auto pr-2">
              <!-- Loading State -->
              <div v-if="loadingWarnings" class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-red-600"></div>
                <span class="ml-2 text-gray-500 dark:text-gray-400 text-sm">Loading warnings...</span>
              </div>
              
              <!-- Empty State -->
              <div v-else-if="userWarnings.length === 0" class="text-center py-12">
                <div class="mx-auto w-12 h-12 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mb-3">
                  <svg class="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <p class="text-sm text-green-600 dark:text-green-400 font-medium">✅ No warnings on record</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Employee has a clean disciplinary record</p>
              </div>
              
              <!-- Warnings List -->
              <div v-else v-for="warning in userWarnings" :key="warning.id" 
                   class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-red-300 dark:hover:border-red-700">
                
                <!-- Warning Header -->
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-start gap-3 flex-1">
                    <div class="flex-shrink-0 mt-0.5">
                      <span class="severity-badge" :class="getSeverityClass(warning.severity_level)">
                        {{ getSeverityIcon(warning.severity_level) }} {{ warning.severity_level }}
                      </span>
                    </div>
                    <div class="flex-1">
                      <h6 class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ warning.warning_motive }}</h6>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span class="font-medium">{{ getWarningCategoryName(warning.warning_category) }}</span>
                      </p>
                    </div>
                  </div>
                  
                  <button @click="deleteWarning(warning.id)" 
                          class="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors duration-200"
                          title="Delete warning">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
                
                <!-- Warning Details -->
                <div v-if="warning.description" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                  <p class="text-sm text-gray-700 dark:text-gray-300">{{ warning.description }}</p>
                </div>
                
                <!-- Warning Metadata -->
                <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <div class="flex items-center gap-2">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3M5 11h14M5 19h14M5 7h14"></path>
                    </svg>
                    <span>{{ formatDate(warning.issued_at) }}</span>
                    <span class="text-gray-300 dark:text-gray-600">•</span>
                    <span>by {{ warning.issued_by_name }}</span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <span v-if="warning.acknowledged_at" class="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Acknowledged {{ formatDate(warning.acknowledged_at) }}
                    </span>
                    <span v-else class="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Pending acknowledgment
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="modal-footer flex justify-end gap-2">
          <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">{{ isEdit ? 'Update User' : 'Create User' }}</button>
        </div>
      </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
const auth = useAuthStore()
const isSuperAdmin = auth.user?.role === 'super-admin'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save'])

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: '',
  company_id: '',
  hourly_rate: null
})

// Companies list for dropdown (super-admin only)
const companies = ref([])

// Warnings management
const showAddWarningForm = ref(false)
const warningCategories = ref({})
const userWarnings = ref([])
const loadingWarnings = ref(false)

const warningForm = reactive({
  category: '',
  motive: '',
  severity: 'low',
  description: ''
})

const availableMotives = ref([])

// Initialize form with user data if editing
watch(() => props.user, (user) => {
  if (user && props.isEdit) {
    form.name = user.name || ''
    form.email = user.email || ''
    form.role = user.role || ''
    form.company_id = (user.company && user.company.id) || user.company_id || ''
    form.hourly_rate = user.hourly_rate ?? null
  }
}, { immediate: true })

const closeModal = () => {
  emit('close')
}

const handleSubmit = () => {
  const userData = {
    name: form.name,
    email: form.email,
    role: form.role,
    company_id: form.company_id || undefined,
    hourly_rate: form.hourly_rate != null ? Number(form.hourly_rate) : undefined
  }

  if (!props.isEdit) {
    userData.password = form.password
  }

  emit('save', userData)
}

// Warning-related methods
const onCategoryChange = () => {
  warningForm.motive = ''
  if (warningForm.category && warningCategories.value[warningForm.category]) {
    availableMotives.value = warningCategories.value[warningForm.category].motives || []
  } else {
    availableMotives.value = []
  }
}

const addWarning = async () => {
  if (!warningForm.category || !warningForm.motive || !props.user?.id) return
  
  try {
    const response = await api.post('/api/warnings', {
      employee_id: props.user.id,
      warning_category: warningForm.category,
      warning_motive: warningForm.motive,
      severity_level: warningForm.severity,
      description: warningForm.description || null
    })
    
    if (response.success) {
      // Reset form
      warningForm.category = ''
      warningForm.motive = ''
      warningForm.severity = 'low'
      warningForm.description = ''
      availableMotives.value = []
      showAddWarningForm.value = false
      
      // Reload warnings
      await loadUserWarnings()
      
      window.showNotification?.({
        type: 'success',
        title: 'Warning Issued',
        message: 'Warning has been successfully added to the employee record.'
      })
    }
  } catch (error) {
    console.error('Error adding warning:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: error.response?.data?.error || 'Failed to add warning'
    })
  }
}

const deleteWarning = async (warningId) => {
  if (!confirm('Are you sure you want to delete this warning? This action cannot be undone.')) {
    return
  }
  
  try {
    const response = await api.delete(`/api/warnings/${warningId}`)
    
    if (response.success) {
      await loadUserWarnings()
      window.showNotification?.({
        type: 'success',
        title: 'Warning Deleted',
        message: 'Warning has been removed from the employee record.'
      })
    }
  } catch (error) {
    console.error('Error deleting warning:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: error.response?.data?.error || 'Failed to delete warning'
    })
  }
}

const loadUserWarnings = async () => {
  if (!props.user?.id || !props.isEdit) return
  
  loadingWarnings.value = true
  try {
    const response = await api.get(`/api/warnings?employee_id=${props.user.id}`)
    if (response.success) {
      userWarnings.value = response.warnings || []
    }
  } catch (error) {
    console.error('Error loading warnings:', error)
  } finally {
    loadingWarnings.value = false
  }
}

const loadWarningCategories = async () => {
  try {
    const response = await api.get('/api/warnings/categories')
    if (response.success) {
      warningCategories.value = response.categories || {}
    }
  } catch (error) {
    console.error('Error loading warning categories:', error)
  }
}

// Helper methods
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getSeverityClass = (severity) => {
  const classes = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-orange-100 text-orange-800',
    high: 'bg-red-100 text-red-800',
    critical: 'bg-gray-100 text-gray-800'
  }
  return classes[severity] || classes.low
}

const getSeverityIcon = (severity) => {
  const icons = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '⚫'
  }
  return icons[severity] || '🟡'
}

const getWarningCategoryName = (categoryKey) => {
  return warningCategories.value[categoryKey]?.name || categoryKey
}

// Watch for user changes to load warnings
watch(() => props.user, async (user) => {
  if (user && props.isEdit && user.role === 'employee' && auth.user?.role === 'admin') {
    await loadUserWarnings()
  }
}, { immediate: true })

// Account management removed; handled under Companies

onMounted(async () => {
  if (isSuperAdmin) {
    try {
      const res = await api.listCompanies()
      companies.value = res?.data || []
    } catch (e) {
      console.error('Failed to load companies', e)
      window.showNotification?.({ type: 'error', title: 'Error', message: 'Failed to load companies' })
    }
  }
  
  // Load warning categories for admins
  if (auth.user?.role === 'admin') {
    await loadWarningCategories()
  }
})
</script>

<style scoped>
.severity-badge {
  @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border;
}

.btn-sm {
  @apply px-3 py-1.5 text-sm font-medium;
}

/* Custom scrollbar for warnings list */
.max-h-72::-webkit-scrollbar {
  width: 8px;
}

.max-h-72::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800 rounded-full;
}

.max-h-72::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.max-h-72::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}

/* Improved spacing for form elements */
.form-input,
select,
textarea {
  @apply px-4 py-3;
}

/* Better card spacing */
.space-y-4 > * + * {
  margin-top: 1rem;
}

/* Focus styles for form elements */
.form-input:focus,
select:focus,
textarea:focus {
  @apply ring-2 ring-offset-2 ring-red-500 dark:ring-red-400 border-red-500 dark:border-red-400;
}

/* Improved button hover effects */
button:hover {
  @apply transform scale-105 transition-transform duration-150;
}

button:active {
  @apply scale-95;
}

/* Gradient animation for the warning form */
.bg-gradient-to-r {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>