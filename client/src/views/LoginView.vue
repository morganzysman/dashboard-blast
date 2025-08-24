<template>
  <div class="login-bg min-h-screen w-screen flex items-center justify-center">
    <div class="max-w-md w-full login-container">
      <div class="bg-white rounded-xl shadow-2xl p-8 border border-gray-200">
        <!-- Logo and title -->
        <div class="text-center">
          <div class="flex justify-center mb-6">
            <img class="h-12 w-12" src="/icons/icon-192x192.png" alt="OlaClick">
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('login.appTitle') }}</h1>
          <p class="text-gray-600 text-sm">{{ $t('auth.loginTitle') }}</p>
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
            <label for="email" class="form-label">{{ $t('auth.email') }}</label>
            <Input id="email" v-model="form.email" type="email" required autocomplete="email" :placeholder="$t('auth.email')" :class="{ 'border-error-300': emailError }" />
            <p v-if="emailError" class="form-error">{{ emailError }}</p>
          </div>

          <div>
            <label for="password" class="form-label">{{ $t('auth.password') }}</label>
            <Input id="password" v-model="form.password" type="password" required autocomplete="current-password" :placeholder="$t('auth.password')" :class="{ 'border-error-300': passwordError }" />
            <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
          </div>

          <div>
            <Button type="submit" :disabled="authStore.isLoading" variant="primary" size="lg" class="w-full">
              <div v-if="authStore.isLoading" class="flex items-center justify-center">
                <div class="loading-spinner mr-2"></div>
                {{ $t('common.loading') }}
              </div>
              <span v-else>{{ $t('auth.loginButton') }}</span>
            </Button>
          </div>
          <span class="text-sm text-gray-600 text-center">v1.0.3</span>
        </form>
        
        <!-- PWA Install Section -->
        <div class="mt-6 border-t pt-6">
          <div class="text-center">
            <h3 class="text-sm font-semibold text-gray-900 mb-2">{{ $t('pwa.installApp') }}</h3>
            <div v-if="canInstallPwa">
              <Button variant="secondary" @click="installPwa" :disabled="installing">{{ installing ? $t('pwa.preparing') : $t('pwa.installApp') }}</Button>
              <p class="text-xs text-gray-500 mt-2">{{ $t('pwa.installDescription') }}</p>
            </div>
            <div v-else>
              <details class="text-left inline-block max-w-sm">
                <summary class="cursor-pointer text-xs text-gray-600">{{ $t('pwa.howToInstall') }}</summary>
                <div class="mt-3 text-xs text-gray-700 space-y-2" v-if="isIos">
                  <p class="font-semibold">{{ $t('pwa.iosInstructions') }}</p>
                  <div class="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/><path d="M7 7h10v10H7z"/></svg>
                    <p>{{ $t('pwa.step1') }}</p>
                  </div>
                  <div class="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    <p>{{ $t('pwa.step2') }}</p>
                  </div>
                  <div class="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    <p>{{ $t('pwa.step3') }}</p>
                  </div>
                  <p class="text-[11px] text-gray-500">{{ $t('pwa.tip') }}</p>
                </div>
                <div class="mt-2 text-xs text-gray-600 space-y-1" v-else>
                  <p><strong>{{ $t('pwa.desktopTitle') }}</strong></p>
                  <p>{{ $t('pwa.desktopInstructions') }}</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Input from '../components/ui/Input.vue'
import Button from '../components/ui/Button.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

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
    emailError.value = t('auth.validation.emailRequired')
    return false
  }

  if (!form.value.email.includes('@')) {
    emailError.value = t('auth.validation.emailInvalid')
    return false
  }

  if (!form.value.password) {
    passwordError.value = t('auth.validation.passwordRequired')
    return false
  }

  if (form.value.password.length < 6) {
    passwordError.value = t('auth.validation.passwordTooShort')
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

// PWA install flow
const deferredPrompt = ref(null)
const canInstallPwa = ref(false)
const installing = ref(false)
const isIos = computed(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent))

const onBeforeInstallPrompt = (e) => {
  // Prevent the mini-infobar
  e.preventDefault()
  deferredPrompt.value = e
  canInstallPwa.value = true
}

const installPwa = async () => {
  if (!deferredPrompt.value) return
  installing.value = true
  try {
    deferredPrompt.value.prompt()
    await deferredPrompt.value.userChoice
  } finally {
    installing.value = false
    canInstallPwa.value = false
    deferredPrompt.value = null
  }
}

onMounted(() => {
  // Clear any existing errors
  authStore.clearError()
  
  // Focus on email field
  document.getElementById('email')?.focus()

  // Hook PWA prompt
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
</script>

<style scoped>
.login-bg {
  min-height: 100vh;
  min-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #1a202c 100%);
  margin: 0;
  padding: 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Override any inherited padding/margin from global styles */
.login-bg * {
  box-sizing: border-box;
}

/* Ensure the login container has no inherited spacing */
.login-container {
  margin: 0;
  padding: 0;
}
</style> 