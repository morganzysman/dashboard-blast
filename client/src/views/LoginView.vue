<template>
  <div class="login-bg min-h-screen w-full flex justify-center px-4 py-10">
    <!-- my-auto (not items-center) so the isologo stays reachable when the
         install instructions make the column taller than the viewport. -->
    <div class="max-w-md w-full my-auto login-container">
      <!-- Isologo sobre el crema, fuera de la loseta: el crema es el aire. -->
      <div class="login-brand">
        <BlastLogo variant="isologo" :height="76" />
        <p class="login-brand__claim">Menos circo, más costra.</p>
      </div>

      <div class="login-tile p-8">
        <div class="text-center">
          <h1 class="login-title">{{ $t('auth.loginTitle') }}</h1>
          <p class="login-kicker">Miraflores · Barranco · Lima, Perú</p>
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
          <span class="data text-[11px] text-center" style="color: var(--fg-muted);">v1.0.3</span>
        </form>
        
        <!-- App Download Section -->
        <div class="mt-8 pt-6" style="border-top: 1px solid var(--border);">
          <!-- Prominent header -->
          <div class="app-cta text-center">
            <div class="app-cta__icon">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
            </div>
            <h3 class="app-cta__title">{{ $t('pwa.getAppTitle') }}</h3>
            <p class="app-cta__subtitle">{{ $t('pwa.getAppSubtitle') }}</p>
          </div>

          <!-- One-tap install (Android / Chrome / Edge / Desktop) -->
          <div v-if="canInstallPwa" class="mt-4">
            <Button variant="primary" size="lg" class="w-full" @click="installPwa" :disabled="installing">
              <span class="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                {{ installing ? $t('pwa.preparing') : $t('pwa.installApp') }}
              </span>
            </Button>
            <p class="text-xs text-center mt-2" style="color: var(--fg3);">{{ $t('pwa.installDescription') }}</p>
          </div>

          <!-- Step-by-step for both platforms -->
          <div class="mt-4 grid grid-cols-1 gap-3">
            <!-- iOS -->
            <div class="app-step-card" :class="{ 'app-step-card--active': isIos }">
              <button
                type="button"
                class="app-step-card__head"
                :aria-expanded="expanded.ios ? 'true' : 'false'"
                aria-controls="install-steps-ios"
                @click="expanded.ios = !expanded.ios"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.84.98-2.22 1.74-3.38 1.65-.14-1.1.42-2.28 1.06-3.02.72-.84 2.02-1.5 3.14-1.55.02.1.02.2.02.9zM20.9 17.28c-.56 1.3-.82 1.88-1.54 3.03-1 1.6-2.42 3.6-4.18 3.62-1.56.02-1.96-1.02-4.08-1.02-2.12 0-2.56 1-4.04 1.04-1.7.06-3-1.74-4-3.34-2.8-4.32-3.1-9.4-1.36-12.1 1.22-1.92 3.16-3.04 4.98-3.04 1.86 0 3.02 1.02 4.56 1.02 1.48 0 2.38-1.02 4.56-1.02 1.62 0 3.34.88 4.56 2.4-4 2.2-3.36 7.92.54 9.41z"/></svg>
                <span class="app-step-card__label">{{ $t('pwa.iosInstructions') }}</span>
                <span v-if="isIos" class="app-step-card__badge">{{ $t('pwa.yourDevice') }}</span>
                <svg class="app-step-card__chevron" :class="{ 'is-open': expanded.ios }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-show="expanded.ios" id="install-steps-ios">
                <ol class="app-steps">
                  <li>{{ $t('pwa.iosStep1') }}</li>
                  <li>{{ $t('pwa.iosStep2') }}</li>
                  <li>{{ $t('pwa.iosStep3') }}</li>
                </ol>
                <p class="app-step-card__tip">{{ $t('pwa.iosTip') }}</p>
              </div>
            </div>

            <!-- Android -->
            <div class="app-step-card" :class="{ 'app-step-card--active': isAndroid }">
              <button
                type="button"
                class="app-step-card__head"
                :aria-expanded="expanded.android ? 'true' : 'false'"
                aria-controls="install-steps-android"
                @click="expanded.android = !expanded.android"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.14-.55.4.4 0 0 0-.55.15l-1.86 3.22a11.4 11.4 0 0 0-9.78 0L5.25 5.9a.4.4 0 0 0-.55-.15.4.4 0 0 0-.15.55L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg>
                <span class="app-step-card__label">{{ $t('pwa.androidInstructions') }}</span>
                <span v-if="isAndroid" class="app-step-card__badge">{{ $t('pwa.yourDevice') }}</span>
                <svg class="app-step-card__chevron" :class="{ 'is-open': expanded.android }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-show="expanded.android" id="install-steps-android">
                <ol class="app-steps">
                  <li>{{ $t('pwa.androidStep1') }}</li>
                  <li>{{ $t('pwa.androidStep2') }}</li>
                  <li>{{ $t('pwa.androidStep3') }}</li>
                </ol>
                <p class="app-step-card__tip">{{ $t('pwa.androidTip') }}</p>
              </div>
            </div>
          </div>

          <!-- Desktop hint -->
          <p v-if="!isIos && !isAndroid" class="text-xs text-center mt-3" style="color: var(--fg3);">
            <strong>{{ $t('pwa.desktopTitle') }}</strong> {{ $t('pwa.desktopInstructions') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Input from '../components/ui/Input.vue'
import Button from '../components/ui/Button.vue'
import BlastLogo from '../components/ui/BlastLogo.vue'
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
const isAndroid = computed(() => /android/i.test(window.navigator.userAgent))

// Sólo se abre la guía del equipo que estás usando; la otra queda a un toque.
const expanded = ref({ ios: isIos.value, android: isAndroid.value })

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
  background: var(--canvas);
  margin: 0;
  padding: 24px 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
}

/* Override any inherited padding/margin from global styles */
.login-bg * {
  box-sizing: border-box;
}

/* Ensure the login container has no inherited spacing */
.login-container {
  padding: 0;
}

/* ─── Brand lockup ─── */
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}

/* El claim es una etiqueta de barra: Space Mono, mayúsculas, tracking abierto. */
.login-brand__claim {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg3);
  margin: 0;
}

.login-tile {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
}

.login-title {
  font-family: var(--font-display);
  font-weight: 400;
  text-transform: uppercase;
  line-height: 1.1;
  letter-spacing: 0.005em;
  font-size: 26px;
  color: var(--fg2);
  margin-bottom: 6px;
}

.login-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

/* App download call-to-action */
.app-cta__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0 auto 8px;
  border-radius: var(--r-md);
  color: var(--nav-active-fg);
  background: var(--accent-wash);
}

.app-cta__title {
  font-family: var(--font-display);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.005em;
  line-height: 1.1;
  font-size: 1.05rem;
  color: var(--fg2);
  margin-bottom: 4px;
}

.app-cta__subtitle {
  font-size: 0.8rem;
  color: var(--fg3);
}

/* Per-platform step cards */
.app-step-card {
  border: 1px solid var(--border);
  border-radius: var(--r-md, 10px);
  padding: 12px 14px;
  background: var(--bg);
}

.app-step-card--active {
  order: -1; /* Show the user's device first */
  border-color: var(--accent);
  background: var(--accent-wash);
}

.app-step-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fg1);
  /* Reset del botón: la cabecera sigue leyéndose como título, no como CTA. */
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  /* El padding negativo estira el área táctil hasta el borde de la loseta
     (44px de alto) sin mover un pixel del diseño. Un <button> no se estira
     solo, así que hay que recuperar el ancho que se comen los márgenes. */
  padding: 12px 14px;
  margin: -12px -14px;
  width: calc(100% + 28px);
}

.app-step-card__head:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: var(--r-md, 10px);
}

.app-step-card__label {
  margin-right: auto;
}

.app-step-card__chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--fg3);
  transition: transform 0.18s var(--ease-ds, cubic-bezier(0.16, 1, 0.3, 1));
}

.app-step-card__chevron.is-open {
  transform: rotate(180deg);
}

/* Sólo se abre aire bajo la cabecera cuando hay pasos que mostrar. */
.app-step-card__head[aria-expanded='true'] {
  margin-bottom: -2px;
}

.app-step-card__badge {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  /* En 390px la etiqueta partía en dos líneas y descuadraba la fila. */
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--accent-fg);
  background: var(--accent);
  padding: 2px 8px;
  border-radius: var(--r-full);
}

.app-steps {
  list-style: none;
  counter-reset: step;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-steps li {
  counter-increment: step;
  position: relative;
  padding-left: 30px;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--fg2, var(--fg1));
}

.app-steps li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--brand-fg);
  background: var(--brand);
  border-radius: var(--r-full);
}

.app-step-card__tip {
  margin-top: 8px;
  font-size: 0.7rem;
  color: var(--fg3);
}
</style> 