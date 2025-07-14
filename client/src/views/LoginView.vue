<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
    <div class="max-w-md w-full space-y-8">
      <div class="bg-white rounded-xl shadow-2xl p-8 border border-gray-200">
        <!-- Logo and title -->
        <div class="text-center">
          <div class="flex justify-center mb-6">
            <img class="h-12 w-12" src="/icons/icon-192x192.png" alt="OlaClick">
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">OlaClick Analytics</h1>
          <p class="text-gray-600 text-sm">Sign in to access your dashboard</p>
        </div>

        <!-- Error message -->
        <div v-if="authStore.error" class="mt-6 notification-error">
          <div class="flex items-center">
            <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {{ authStore.error }}
          </div>
        </div>

        <!-- Login form -->
        <form @submit.prevent="handleLogin" class="mt-8 space-y-6">
          <div>
            <label for="email" class="form-label">Email address</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="form-input"
              :class="{ 'border-error-300': emailError }"
              placeholder="Enter your email"
            />
            <p v-if="emailError" class="form-error">{{ emailError }}</p>
          </div>

          <div>
            <label for="password" class="form-label">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              autocomplete="current-password"
              class="form-input"
              :class="{ 'border-error-300': passwordError }"
              placeholder="Enter your password"
            />
            <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
          </div>

          <div>
            <button
              type="submit"
              :disabled="authStore.isLoading"
              class="w-full btn-primary btn-lg"
            >
              <div v-if="authStore.isLoading" class="flex items-center justify-center">
                <div class="loading-spinner mr-2"></div>
                Signing in...
              </div>
              <span v-else>Sign in</span>
            </button>
          </div>
        </form>

        <!-- Footer -->
        <div class="mt-8 text-center text-sm text-gray-500">
          <p>OlaClick Analytics Dashboard v2.0.0</p>
          <p class="mt-1">Vue.js Edition with PostgreSQL</p>
        </div>
      </div>

      <!-- Features -->
      <div class="mt-8 bg-white/10 backdrop-blur-md rounded-lg p-6 text-white">
        <h3 class="text-lg font-semibold mb-4">✨ New Features</h3>
        <ul class="space-y-2 text-sm">
          <li class="flex items-center">
            <span class="text-green-400 mr-2">✓</span>
            Modern Vue.js interface with components
          </li>
          <li class="flex items-center">
            <span class="text-green-400 mr-2">✓</span>
            PostgreSQL database with migrations
          </li>
          <li class="flex items-center">
            <span class="text-green-400 mr-2">✓</span>
            Super-admin user management
          </li>
          <li class="flex items-center">
            <span class="text-green-400 mr-2">✓</span>
            Role-based access control
          </li>
          <li class="flex items-center">
            <span class="text-green-400 mr-2">✓</span>
            Enhanced push notifications
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  email: '',
  password: ''
})

const emailError = ref('')
const passwordError = ref('')

const validateForm = () => {
  emailError.value = ''
  passwordError.value = ''

  if (!form.value.email) {
    emailError.value = 'Email is required'
    return false
  }

  if (!form.value.email.includes('@')) {
    emailError.value = 'Please enter a valid email address'
    return false
  }

  if (!form.value.password) {
    passwordError.value = 'Password is required'
    return false
  }

  if (form.value.password.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    return false
  }

  return true
}

const handleLogin = async () => {
  if (!validateForm()) return

  authStore.clearError()

  try {
    const result = await authStore.login(form.value.email, form.value.password)
    
    if (result.success) {
      console.log('✅ Login successful, redirecting to dashboard')
      router.push('/')
    } else {
      console.error('❌ Login failed:', result.error)
      // Error is already set in the store
    }
  } catch (error) {
    console.error('❌ Login error:', error)
  }
}

onMounted(() => {
  // Clear any existing errors
  authStore.clearError()
  
  // Focus on email field
  document.getElementById('email')?.focus()
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style> 