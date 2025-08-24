<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          {{ $t('modals.changePassword.title') }}
        </h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="px-6 py-4 space-y-4">
        <!-- Current Password -->
        <div>
          <label for="currentPassword" class="form-label">
            {{ $t('modals.changePassword.currentPassword') }}
          </label>
          <input
            id="currentPassword"
            v-model="form.currentPassword"
            type="password"
            class="form-input"
            :class="{ 'border-red-500': errors.currentPassword }"
            :placeholder="$t('auth.currentPassword')"
            required
          />
          <p v-if="errors.currentPassword" class="mt-1 text-sm text-red-600">
            {{ errors.currentPassword }}
          </p>
        </div>

        <!-- New Password -->
        <div>
          <label for="newPassword" class="form-label">
            {{ $t('modals.changePassword.newPassword') }}
          </label>
          <input
            id="newPassword"
            v-model="form.newPassword"
            type="password"
            class="form-input"
            :class="{ 'border-red-500': errors.newPassword }"
            :placeholder="$t('auth.newPassword')"
            required
            minlength="6"
          />
          <p v-if="errors.newPassword" class="mt-1 text-sm text-red-600">
            {{ errors.newPassword }}
          </p>
          <p class="mt-1 text-xs text-gray-500">
            {{ $t('modals.changePassword.minLength') }}
          </p>
        </div>

        <!-- Confirm New Password -->
        <div>
          <label for="confirmPassword" class="form-label">
            {{ $t('modals.changePassword.confirmNewPassword') }}
          </label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            class="form-input"
            :class="{ 'border-red-500': errors.confirmPassword }"
            :placeholder="$t('auth.confirmPassword')"
            required
          />
          <p v-if="errors.confirmPassword" class="mt-1 text-sm text-red-600">
            {{ errors.confirmPassword }}
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{{ error }}</p>
        </div>

        <!-- Success Message -->
        <div v-if="success" class="p-3 bg-green-50 border border-green-200 rounded-md">
          <p class="text-sm text-green-600">{{ success }}</p>
        </div>
      </form>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
        <button
          type="button"
          @click="$emit('close')"
          class="btn-secondary"
          :disabled="isLoading"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          @click="handleSubmit"
          class="btn-primary"
          :disabled="isLoading || !isFormValid"
        >
          <div v-if="isLoading" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"></path>
            </svg>
            {{ $t('common.loading') }}
          </div>
          <span v-else>{{ $t('auth.changePassword') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()

const form = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const errors = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const error = ref('')
const success = ref('')
const isLoading = ref(false)

const isFormValid = computed(() => {
  return form.value.currentPassword.length > 0 &&
         form.value.newPassword.length >= 6 &&
         form.value.confirmPassword.length > 0 &&
         form.value.newPassword === form.value.confirmPassword
})

const validateForm = () => {
  errors.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }

  let isValid = true

  if (!form.value.currentPassword) {
    errors.value.currentPassword = 'Current password is required' // TODO: Add to i18n
    isValid = false
  }

  if (!form.value.newPassword) {
    errors.value.newPassword = 'New password is required' // TODO: Add to i18n
    isValid = false
  } else if (form.value.newPassword.length < 6) {
    errors.value.newPassword = 'Password must be at least 6 characters long' // TODO: Add to i18n
    isValid = false
  }

  if (!form.value.confirmPassword) {
    errors.value.confirmPassword = 'Please confirm your new password' // TODO: Add to i18n
    isValid = false
  } else if (form.value.newPassword !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match' // TODO: Add to i18n
    isValid = false
  }

  if (form.value.currentPassword === form.value.newPassword) {
    errors.value.newPassword = 'New password must be different from current password' // TODO: Add to i18n
    isValid = false
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  isLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const result = await authStore.changePassword(
      form.value.currentPassword,
      form.value.newPassword
    )

    if (result.success) {
      success.value = 'Password changed successfully!' // TODO: Add to i18n
      form.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        emit('close')
      }, 1500)
    } else {
      error.value = result.error || 'Failed to change password' // TODO: Add to i18n
    }
  } catch (err) {
    error.value = 'An unexpected error occurred' // TODO: Add to i18n
    console.error('Password change error:', err)
  } finally {
    isLoading.value = false
  }
}

// Clear form when modal opens/closes
watch(() => props.isOpen, (newValue) => {
  if (!newValue) {
    form.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    errors.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    error.value = ''
    success.value = ''
  }
})
</script>

<style scoped>
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.form-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1;
}

.form-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white;
}
</style>
