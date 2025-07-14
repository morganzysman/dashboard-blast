<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeModal">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" @click.stop>
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
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <!-- User Settings -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Timezone</label>
            <select v-model="form.timezone" class="form-input">
              <option value="America/Lima">Lima (UTC-5)</option>
              <option value="America/New_York">New York (UTC-5)</option>
              <option value="America/Chicago">Chicago (UTC-6)</option>
              <option value="America/Denver">Denver (UTC-7)</option>
              <option value="America/Los_Angeles">Los Angeles (UTC-8)</option>
              <option value="Europe/London">London (UTC+0)</option>
              <option value="Europe/Madrid">Madrid (UTC+1)</option>
              <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
            </select>
          </div>

          <div>
            <label class="form-label">Currency</label>
            <select v-model="form.currency" class="form-input">
              <option value="PEN">PEN (Soles)</option>
              <option value="USD">USD (Dollars)</option>
              <option value="EUR">EUR (Euros)</option>
            </select>
          </div>
        </div>

        <!-- Account Assignment -->
        <div class="border-t pt-4">
          <div class="flex justify-between items-center mb-3">
            <label class="form-label mb-0">Account Access</label>
            <button
              type="button"
              @click="showAccountModal = true"
              class="btn-sm btn-secondary"
            >
              Add Account
            </button>
          </div>

          <div v-if="form.accounts.length === 0" class="text-sm text-gray-500 p-3 bg-gray-50 rounded">
            No accounts assigned. Click "Add Account" to assign restaurant accounts.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(account, index) in form.accounts"
              :key="index"
              class="flex items-center justify-between p-3 bg-gray-50 rounded"
            >
              <div>
                <div class="font-medium">{{ account.account_name }}</div>
                <div class="text-sm text-gray-500">{{ account.company_token }}</div>
              </div>
              <button
                type="button"
                @click="removeAccount(index)"
                class="text-red-500 hover:text-red-700"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t">
          <button type="button" @click="closeModal" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            {{ isEdit ? 'Update User' : 'Create User' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Account Selection Modal -->
    <div v-if="showAccountModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60" @click="showAccountModal = false">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" @click.stop>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-gray-900">Add Account</h3>
          <button @click="showAccountModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="form-label">Account Name</label>
            <input
              v-model="newAccount.name"
              type="text"
              class="form-input"
              placeholder="Enter restaurant name"
            />
          </div>

          <div>
            <label class="form-label">Company Token</label>
            <input
              v-model="newAccount.company_token"
              type="text"
              class="form-input"
              placeholder="Enter company token"
            />
          </div>

          <div>
            <label class="form-label">API Token</label>
            <div class="flex space-x-2">
              <input
                :type="showApiToken ? 'text' : 'password'"
                v-model="newAccount.api_token"
                class="form-input flex-1"
                placeholder="Enter API token"
              />
              <button
                @click="toggleApiToken"
                class="btn-secondary"
                type="button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="!showApiToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path v-if="!showApiToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  <path v-if="showApiToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" @click="showAccountModal = false" class="btn-secondary">
              Cancel
            </button>
            <button type="button" @click="addAccount" class="btn-primary">
              Add Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

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

const showAccountModal = ref(false)
const showApiToken = ref(false)

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: '',
  timezone: 'America/Lima',
  currency: 'PEN',
  accounts: []
})

const newAccount = reactive({
  name: '',
  company_token: '',
  api_token: ''
})

// Initialize form with user data if editing
watch(() => props.user, (user) => {
  if (user && props.isEdit) {
    form.name = user.name || ''
    form.email = user.email || ''
    form.role = user.role || ''
    form.timezone = user.timezone || 'America/Lima'
    form.currency = user.currency || 'PEN'
    form.accounts = user.accounts ? [...user.accounts] : []
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
    timezone: form.timezone,
    currency: form.currency,
    accounts: form.accounts
  }

  if (!props.isEdit) {
    userData.password = form.password
  }

  emit('save', userData)
}

const toggleApiToken = () => {
  showApiToken.value = !showApiToken.value
}

const addAccount = () => {
  if (newAccount.name && newAccount.company_token && newAccount.api_token) {
    form.accounts.push({
      account_name: newAccount.name,
      company_token: newAccount.company_token,
      api_token: newAccount.api_token,
      is_active: true
    })

    // Reset form
    newAccount.name = ''
    newAccount.company_token = ''
    newAccount.api_token = ''
    showApiToken.value = false
    
    showAccountModal.value = false
  }
}

const removeAccount = (index) => {
  form.accounts.splice(index, 1)
}
</script>

<style scoped>
.z-60 {
  z-index: 60;
}
</style> 