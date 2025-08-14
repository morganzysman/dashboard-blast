<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-panel w-full sm:max-w-lg">
          <div class="modal-header">
            <h3 class="text-lg font-semibold text-gray-900">Manage Account Tokens</h3>
          </div>
          <div class="modal-body">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <!-- Account List -->
              <div class="space-y-4">
                <div v-for="account in accounts" :key="account.company_token" class="border rounded-lg p-4">
                  <!-- Account Name -->
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      v-model="account.account_name"
                      class="form-input w-full"
                      placeholder="Enter account name"
                    />
                  </div>

                  <!-- Company Token -->
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Company Token
                    </label>
                    <div class="flex space-x-2">
                      <input
                        type="text"
                        v-model="account.company_token"
                        class="form-input flex-1"
                        placeholder="Enter company token"
                      />
                    </div>
                  </div>

                  <!-- API Token -->
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      API Token
                    </label>
                    <div class="flex space-x-2">
                      <input
                        :type="account.showToken ? 'text' : 'password'"
                        v-model="account.api_token"
                        class="form-input flex-1"
                        :placeholder="account.api_token ? '••••••••' : 'Enter API token'"
                      />
                      <button
                        @click="toggleTokenVisibility(account)"
                        class="btn-secondary"
                        type="button"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path v-if="!account.showToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path v-if="!account.showToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          <path v-if="account.showToken" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Account Status -->
                  <div class="flex justify-between items-center mt-3">
                    <div class="flex items-center">
                      <label class="inline-flex items-center">
                        <input
                          type="checkbox"
                          v-model="account.is_active"
                          class="form-checkbox h-4 w-4 text-primary-600"
                        />
                        <span class="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                    <button
                      @click="testAccount(account)"
                      class="btn-sm btn-secondary"
                      :disabled="!account.api_token || !account.company_token"
                    >
                      Test Connection
                    </button>
                  </div>

                  <!-- Validation Status -->
                  <div class="mt-2">
                    <span class="text-sm" :class="getAccountStatusClass(account)">
                      {{ getAccountStatus(account) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
          <div class="modal-footer flex justify-end gap-2">
            <button type="button" class="btn-secondary" @click="close">Cancel</button>
            <button type="button" class="btn-primary" @click="saveChanges">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  show: Boolean,
  userId: String,
  initialAccounts: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'update'])

const authStore = useAuthStore()
const accounts = ref([])

// Initialize accounts with visibility flag
const initializeAccounts = () => {
  accounts.value = props.initialAccounts.map(account => ({
    ...account,
    showToken: false,
    originalToken: account.api_token,
    originalCompanyToken: account.company_token,
    originalName: account.account_name
  }))
}

// Watch for show prop changes
watch(() => props.show, (newVal) => {
  if (newVal) {
    initializeAccounts()
  }
})

const toggleTokenVisibility = (account) => {
  account.showToken = !account.showToken
}

const getAccountStatus = (account) => {
  if (!account.account_name) return 'Account name required'
  if (!account.company_token) return 'Company token required'
  if (!account.api_token) return 'API token required'
  if (account.api_token !== account.originalToken ||
      account.company_token !== account.originalCompanyToken ||
      account.account_name !== account.originalName) return 'Changes pending'
  return 'Account configured'
}

const getAccountStatusClass = (account) => {
  if (!account.account_name || !account.company_token || !account.api_token) return 'text-warning-600'
  if (account.api_token !== account.originalToken ||
      account.company_token !== account.originalCompanyToken ||
      account.account_name !== account.originalName) return 'text-primary-600'
  return 'text-success-600'
}

const testAccount = async (account) => {
  try {
    const response = await fetch('/api/test-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId
      },
      body: JSON.stringify({
        company_token: account.company_token,
        api_token: account.api_token
      })
    })

    if (response.ok) {
      window.showNotification?.({
        type: 'success',
        title: 'Connection Valid',
        message: 'Account credentials tested successfully'
      })
    } else {
      throw new Error('Account test failed')
    }
  } catch (error) {
    window.showNotification?.({
      type: 'error',
      title: 'Connection Test Failed',
      message: 'Failed to validate account credentials'
    })
  }
}

const saveChanges = async () => {
  try {
    const response = await fetch(`/api/users/${props.userId}/accounts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': authStore.sessionId
      },
      body: JSON.stringify({
        accounts: accounts.value.map(({ showToken, originalToken, originalCompanyToken, originalName, ...account }) => account)
      })
    })

    if (response.ok) {
      window.showNotification?.({
        type: 'success',
        title: 'Changes Saved',
        message: 'Account settings have been updated'
      })
      emit('update', accounts.value)
      emit('close')
    } else {
      throw new Error('Failed to save changes')
    }
  } catch (error) {
    window.showNotification?.({
      type: 'error',
      title: 'Save Failed',
      message: 'Failed to update account settings'
    })
  }
}

const close = () => {
  emit('close')
}
</script> 