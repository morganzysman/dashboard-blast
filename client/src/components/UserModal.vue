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
})
</script>