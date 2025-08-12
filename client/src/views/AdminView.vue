<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">User Management</h2>
        <p class="text-sm sm:text-base text-gray-600">Manage system users and their account access</p>
      </div>
      <button @click="openCreateUserModal" class="btn-primary text-sm sm:text-base">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Create User
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 11a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-3 min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-500">Total Users</p>
              <p class="text-xl sm:text-2xl font-bold text-gray-900">{{ users.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-3 min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-500">Active Users</p>
              <p class="text-xl sm:text-2xl font-bold text-gray-900">{{ activeUsers }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
            </div>
            <div class="ml-3 min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-500">Admins</p>
              <p class="text-xl sm:text-2xl font-bold text-gray-900">{{ adminUsers }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
            </div>
            <div class="ml-3 min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-500">Total Accounts</p>
              <p class="text-xl sm:text-2xl font-bold text-gray-900">{{ totalAccounts }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filter -->
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search users..."
              class="form-input w-full text-sm"
            />
          </div>
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <select v-model="roleFilter" class="form-input w-full sm:w-auto text-sm">
              <option value="">All Roles</option>
              <option value="super-admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
            </select>
            <select v-model="statusFilter" class="form-input w-full sm:w-auto text-sm">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="card">
      <div class="card-body p-0">
        <!-- Mobile Card View -->
        <div class="lg:hidden">
          <div v-for="user in filteredUsers" :key="user.id" class="border-b border-gray-200 last:border-b-0 p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 h-10 w-10">
                  <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span class="text-sm font-medium text-primary-600">
                      {{ user.name.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-gray-900 truncate">{{ user.name }}</div>
                  <div class="text-xs text-gray-500 truncate hidden sm:block">{{ user.email }}</div>
                </div>
              </div>
              <span class="badge" :class="user.is_active ? 'badge-success' : 'badge-gray'">
                {{ user.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="badge text-xs" :class="getRoleBadgeClass(user.role)">
                {{ user.role?.replace('-', ' ') }}
              </span>
              <span class="text-xs text-gray-500">Company: {{ user.company?.name || '—' }}</span>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-2">
              <button
                @click="editUser(user)"
                class="btn-sm btn-secondary flex-1 text-xs"
              >
                Edit
              </button>
              <button
                @click="toggleUserStatus(user)"
                :class="user.is_active ? 'btn-sm btn-warning flex-1 text-xs' : 'btn-sm btn-success flex-1 text-xs'"
              >
                {{ user.is_active ? 'Deactivate' : 'Activate' }}
              </button>
              <button
                v-if="isSuperAdmin"
                @click="confirmDeleteUser(user)"
                class="btn-sm btn-danger flex-1 text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                 <th>Company</th>
                <th>Hourly Rate</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span class="text-sm font-medium text-primary-600">
                          {{ user.name.charAt(0).toUpperCase() }}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">{{ user.name }}</div>
                      <div class="text-sm text-gray-500">{{ user.email }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge" :class="getRoleBadgeClass(user.role)">
                    {{ user.role?.replace('-', ' ') }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="user.is_active ? 'badge-success' : 'badge-gray'">
                    {{ user.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td>
                  <div class="text-sm text-gray-900">{{ user.company?.name || '—' }}</div>
                </td>
                <td>
                  <div class="flex items-center gap-1">
                    <input type="number" min="0" step="0.01" class="form-input w-24 text-sm" :value="formatRate(user.hourly_rate)" @change="e => onRateInput(user, e)" />
                  </div>
                </td>
                <td>
                  <div class="text-sm text-gray-900">
                    {{ user.last_login ? formatDate(user.last_login) : 'Never' }}
                  </div>
                </td>
                <td>
                  <div class="flex items-center space-x-2">
                    <button
                      @click="editUser(user)"
                      class="btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      v-if="!isSuperAdmin"
                      @click="manageShifts(user)"
                      class="btn-sm btn-secondary"
                    >
                      Shifts
                    </button>
                    <button
                      @click="resetPassword(user)"
                      class="btn-sm btn-warning"
                    >
                      Reset Password
                    </button>
                    <button
                      @click="toggleUserStatus(user)"
                      :class="user.is_active ? 'btn-sm btn-warning' : 'btn-sm btn-success'"
                    >
                      {{ user.is_active ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button
                      v-if="isSuperAdmin"
                      @click="confirmDeleteUser(user)"
                      class="btn-sm btn-danger"
                    >
                      Delete
                    </button>
                    
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create/Edit User Modal -->
    <UserModal
      v-if="showUserModal"
      :user="selectedUser"
      :is-edit="isEditMode"
      @close="closeUserModal"
      @save="handleUserSave"
    />

    <ShiftManagerModal
      v-if="showShiftModal"
      :user="selectedUser"
      :companyId="selectedUser?.company?.id || selectedUser?.company_id || ''"
      @close="() => { showShiftModal = false; selectedUser = null }"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import UserModal from '../components/UserModal.vue'
import ShiftManagerModal from '../components/ShiftManagerModal.vue'
import api from '../utils/api'

const authStore = useAuthStore()
const isSuperAdmin = computed(() => authStore.user?.role === 'super-admin')

// State
const users = ref([])
const loading = ref(false)
const searchQuery = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const showUserModal = ref(false)
const selectedUser = ref(null)
const isEditMode = ref(false)
const showShiftModal = ref(false)

// Computed
const filteredUsers = computed(() => {
  return users.value.filter(user => {
    const matchesSearch = !searchQuery.value || 
      user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    const matchesRole = !roleFilter.value || user.role === roleFilter.value
    const matchesStatus = !statusFilter.value || 
      (statusFilter.value === 'active' && user.is_active) ||
      (statusFilter.value === 'inactive' && !user.is_active)
    
    return matchesSearch && matchesRole && matchesStatus
  })
})

const activeUsers = computed(() => users.value.filter(user => user.is_active).length)
const adminUsers = computed(() => users.value.filter(user => user.role === 'admin').length)
const totalAccounts = computed(() => 0)

// Methods
const fetchUsers = async () => {
  loading.value = true
  try {
    const data = await api.get('/api/admin/users')
    users.value = data.users
  } catch (error) {
    console.error('Error fetching users:', error)
    
    // Only show error notification if it's not session expiration (handled by API wrapper)
    if (error.status !== 401) {
      window.showNotification?.({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch users'
      })
    }
  } finally {
    loading.value = false
  }
}

const openCreateUserModal = () => {
  selectedUser.value = null
  isEditMode.value = false
  showUserModal.value = true
}

const editUser = (user) => {
  selectedUser.value = user
  isEditMode.value = true
  showUserModal.value = true
}

const closeUserModal = () => {
  showUserModal.value = false
  selectedUser.value = null
  isEditMode.value = false
}

const handleUserSave = async (userData) => {
  try {
    if (isEditMode.value) {
      // Update existing user
      await updateUser(selectedUser.value.id, userData)
    } else {
      // Create new user
      await createUser(userData)
    }
    
    closeUserModal()
    await fetchUsers()
    
    window.showNotification?.({
      type: 'success',
      title: 'Success',
      message: `User ${isEditMode.value ? 'updated' : 'created'} successfully`
    })
  } catch (error) {
    console.error('Error saving user:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: `Failed to ${isEditMode.value ? 'update' : 'create'} user`
    })
  }
}

const createUser = async (userData) => {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': authStore.sessionId,
    },
    body: JSON.stringify(userData),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create user')
  }

  return response.json()
}

const updateUser = async (userId, userData) => {
  // Update user role if changed
  if (userData.role) {
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId,
      },
      body: JSON.stringify({ role: userData.role }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user role')
    }
  }

  // Update user company if provided
  if (userData.company_id) {
    const response = await fetch(`/api/admin/users/${userId}/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId,
      },
      body: JSON.stringify({ company_id: userData.company_id }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user company')
    }
  }

  // Update hourly rate if provided and role is employee
  if (userData.hourly_rate != null && (userData.role === 'employee' || selectedUser.value?.role === 'employee')) {
    const response = await fetch(`/api/admin/users/${userId}/hourly-rate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId,
      },
      body: JSON.stringify({ hourly_rate: Number(userData.hourly_rate) })
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Failed to update hourly rate')
    }
  }
}

const toggleUserStatus = async (user) => {
  try {
    const response = await fetch(`/api/admin/users/${user.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId,
      },
      body: JSON.stringify({ is_active: !user.is_active }),
    })

    if (response.ok) {
      user.is_active = !user.is_active
      window.showNotification?.({
        type: 'success',
        title: 'Success',
        message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`
      })
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user status')
    }
  } catch (error) {
    console.error('Error toggling user status:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: 'Failed to update user status'
    })
  }
}

const updateHourlyRate = async (user) => {
  try {
    const rate = Number(user.hourly_rate || 0)
    const res = await fetch(`/api/admin/users/${user.id}/hourly-rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': authStore.sessionId },
      body: JSON.stringify({ hourly_rate: rate })
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || 'Failed to update hourly rate')
    }
    window.showNotification?.({ type: 'success', title: 'Hourly Rate', message: 'Updated' })
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Hourly Rate', message: e.message || 'Failed' })
  }
}

const resetPassword = async (user) => {
  try {
    const newPassword = window.prompt(`Enter a new password for ${user.email} (min 6 chars):`)
    if (newPassword == null) return
    const trimmed = newPassword.trim()
    if (trimmed.length < 6) {
      window.showNotification?.({ type: 'warning', title: 'Password', message: 'Password must be at least 6 characters' })
      return
    }
    await api.resetUserPassword(user.id, trimmed)
    window.showNotification?.({ type: 'success', title: 'Password Reset', message: `Password reset for ${user.email}` })
  } catch (e) {
    window.showNotification?.({ type: 'error', title: 'Password Reset', message: e?.message || 'Failed to reset password' })
  }
}

// Minimal shifts manager: prompt-based (future: dedicated modal/calendar)
const manageShifts = async (user) => {
  selectedUser.value = user
  showShiftModal.value = true
}

const formatRate = (r) => {
  const n = Number(r || 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

const onRateInput = (user, e) => {
  const v = Number(e.target.value)
  user.hourly_rate = Number.isFinite(v) ? Number(v.toFixed(2)) : 0
  updateHourlyRate(user)
}
const confirmDeleteUser = async (user) => {
  try {
    const ok = window.confirm(`Delete user ${user.email}? This cannot be undone.`)
    if (!ok) return
    await api.delete(`/api/admin/users/${user.id}`)
    users.value = users.value.filter(u => u.id !== user.id)
    window.showNotification?.({
      type: 'success',
      title: 'User deleted',
      message: `${user.email} removed`
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    window.showNotification?.({
      type: 'error',
      title: 'Error',
      message: error?.message || 'Failed to delete user'
    })
  }
}

const getRoleBadgeClass = (role) => {
  switch (role) {
    case 'super-admin':
      return 'badge-primary'
    case 'admin':
      return 'badge-success'
    case 'employee':
      return 'badge-warning'
    default:
      return 'badge-gray'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 