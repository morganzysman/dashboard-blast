<template>
  <div v-if="isOpen" class="fixed inset-0 flex items-center justify-center z-50" style="background: rgba(15,23,42,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
    <div class="w-full max-w-md mx-4 rounded-2xl" style="background: rgba(255,255,255,0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 25px 60px rgba(0,0,0,0.12);">
      <div class="px-6 py-4 border-b" style="border-color: rgba(229,231,235,0.4);">
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

      <div class="px-6 py-4 border-t flex justify-end space-x-3" style="border-color: rgba(229,231,235,0.4);">
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
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const { t } = useI18n()

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
    errors.value.currentPassword = t('modals.changePassword.errors.currentRequired')
    isValid = false
  }

  if (!form.value.newPassword) {
    errors.value.newPassword = t('modals.changePassword.errors.newRequired')
    isValid = false
  } else if (form.value.newPassword.length < 6) {
    errors.value.newPassword = t('modals.changePassword.errors.minLength6')
    isValid = false
  }

  if (!form.value.confirmPassword) {
    errors.value.confirmPassword = t('modals.changePassword.errors.confirmRequired')
    isValid = false
  } else if (form.value.newPassword !== form.value.confirmPassword) {
    errors.value.confirmPassword = t('modals.changePassword.errors.mismatch')
    isValid = false
  }

  if (form.value.currentPassword === form.value.newPassword) {
    errors.value.newPassword = t('modals.changePassword.errors.newDifferent')
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
      success.value = t('modals.changePassword.passwordChanged')
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
      error.value = result.error || t('modals.changePassword.passwordError')
    }
  } catch (err) {
    error.value = t('modals.changePassword.errors.unexpected')
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
/* Uses global glassmorphism .btn-primary, .btn-secondary, .form-label, .form-input styles */
</style>
