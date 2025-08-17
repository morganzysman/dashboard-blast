<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full max-w-md" @click.stop>
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
        <div v-if="isEdit && form.role === 'employee' && auth.user?.role === 'admin'" class="border-t pt-4">
          <div class="flex justify-between items-center mb-3">
            <h4 class="text-md font-medium text-gray-900">⚠️ Employee Warnings</h4>
            <button type="button" @click="showAddWarningForm = !showAddWarningForm" 
                    class="btn-primary btn-sm">
              {{ showAddWarningForm ? 'Cancel' : 'Add Warning' }}
            </button>
          </div>
          
          <!-- Add Warning Form -->
          <div v-if="showAddWarningForm" class="bg-gray-50 p-3 rounded-lg mb-4 space-y-3">
            <div>
              <label class="form-label text-sm">Warning Category</label>
              <select v-model="warningForm.category" class="form-input text-sm" @change="onCategoryChange">
                <option value="">Select category</option>
                <option v-for="(cat, key) in warningCategories" :key="key" :value="key">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            
            <div>
              <label class="form-label text-sm">Specific Motive</label>
              <select v-model="warningForm.motive" class="form-input text-sm" :disabled="!warningForm.category">
                <option value="">Select motive</option>
                <option v-for="motive in availableMotives" :key="motive" :value="motive">
                  {{ motive }}
                </option>
              </select>
            </div>
            
            <div>
              <label class="form-label text-sm">Severity Level</label>
              <select v-model="warningForm.severity" class="form-input text-sm">
                <option value="low">🟡 Low</option>
                <option value="medium">🟠 Medium</option>
                <option value="high">🔴 High</option>
                <option value="critical">⚫ Critical</option>
              </select>
            </div>
            
            <div>
              <label class="form-label text-sm">Description (Optional)</label>
              <textarea v-model="warningForm.description" 
                       class="form-input text-sm" 
                       rows="2" 
                       placeholder="Additional details about the incident..."></textarea>
            </div>
            
            <button type="button" @click="addWarning" 
                    class="btn-primary btn-sm w-full"
                    :disabled="!warningForm.category || !warningForm.motive">
              Issue Warning
            </button>
          </div>
          
          <!-- Existing Warnings List -->
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div v-if="loadingWarnings" class="text-center py-2 text-gray-500 text-sm">
              Loading warnings...
            </div>
            <div v-else-if="userWarnings.length === 0" class="text-center py-2 text-gray-500 text-sm">
              ✅ No warnings on record
            </div>
            <div v-else v-for="warning in userWarnings" :key="warning.id" 
                 class="bg-white border rounded-lg p-3 text-sm">
              <div class="flex justify-between items-start mb-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ warning.warning_motive }}</span>
                  <span class="severity-badge" :class="getSeverityClass(warning.severity_level)">
                    {{ getSeverityIcon(warning.severity_level) }} {{ warning.severity_level }}
                  </span>
                </div>
                <button @click="deleteWarning(warning.id)" 
                        class="text-red-500 hover:text-red-700 text-xs">
                  🗑️
                </button>
              </div>
              
              <div class="text-gray-600 text-xs mb-1">
                <strong>Category:</strong> {{ getWarningCategoryName(warning.warning_category) }}
              </div>
              
              <div v-if="warning.description" class="text-gray-600 text-xs mb-1">
                <strong>Details:</strong> {{ warning.description }}
              </div>
              
              <div class="text-gray-500 text-xs">
                <strong>Issued:</strong> {{ formatDate(warning.issued_at) }} by {{ warning.issued_by_name }}
                <span v-if="warning.acknowledged_at" class="text-green-600 ml-2">
                  ✓ Acknowledged {{ formatDate(warning.acknowledged_at) }}
                </span>
                <span v-else class="text-orange-600 ml-2">
                  ⏳ Pending acknowledgment
                </span>
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
  @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
}

.btn-sm {
  @apply px-3 py-1 text-sm;
}
</style>