<template>
  <div class="space-y-4 lg:space-y-6 max-w-xl mx-auto">
    <div class="card">
      <div class="card-body">
        <h2 class="text-lg font-bold text-gray-900">Employee Clock</h2>
        <p class="text-sm text-gray-600">Scan the QR to clock in/out for your shift.</p>
        <div v-if="!isEmployee">
          <div class="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            This page is reserved for employees. Please log in with an employee account.
          </div>
          <div class="mt-3">
            <router-link class="btn-primary w-full" :to="{ name: 'Login', query: loginPrefill }">Go to Login</router-link>
          </div>
        </div>
        <div v-else>
          <div class="mt-4 space-y-3">
            <template v-if="hasQrContext">
              <div class="text-gray-800">
                <span class="font-semibold text-xl">Hi {{ auth.user?.name?.split(' ')[0] || 'there' }}!</span>
              </div>
              <div class="text-xs text-gray-500">{{ todayLabel }}</div>
              <div class="text-sm text-gray-700">
                <span class="font-medium">Account:</span>
                <span>{{ accountLabel }}</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div v-if="openEntry">
                <div class="px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                  Clocked in at {{ formatTime(openEntry.clock_in_at) }}
                </div>
              </div>
              <button v-else class="btn-primary w-full" :disabled="submitting || !canClockIn" @click="submitClock('in')">
                {{ submitting && action==='in' ? 'Clocking in...' : 'Clock In' }}
              </button>
              <button class="btn-danger w-full" :disabled="submitting || !canClockOut" @click="submitClock('out')">
                {{ submitting && action==='out' ? 'Clocking out...' : 'Clock Out' }}
              </button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center">
                <div class="mt-2 rounded overflow-hidden border border-gray-200 relative w-full max-w-xl">
                  <video ref="videoEl" class="w-full h-64 object-cover" playsinline></video>
                  <div class="absolute inset-0 pointer-events-none border-2 border-green-500 m-8 rounded"></div>
                  <div class="absolute bottom-1 right-2 bg-black bg-opacity-50 text-white text-[10px] px-1 rounded">Scanner</div>
                </div>
              </div>
              <p class="text-xs text-gray-500 text-center">Scan the QR provided by your manager to begin.</p>
            </template>
            <p v-if="message" class="text-sm" :class="messageClass">{{ message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
const router = useRouter()
const accounts = computed(() => auth.user?.userAccounts || [])
const companyToken = ref(accounts.value[0]?.company_token || '')
const qrSecret = ref('')
const submitting = ref(false)
const message = ref('')
const messageClass = computed(() => success.value ? 'text-green-600' : 'text-red-600')
const success = ref(false)
const isEmployee = computed(() => auth.user?.role === 'employee')
const loginPrefill = computed(() => ({ redirect: '/clock', company_token: companyToken.value }))
const action = ref('')
const scannerOpen = ref(false)
const videoEl = ref(null)
let mediaStream = null
let frameHandle = null
let barcodeDetector = null
let zxingReader = null
let zxingControls = null

// Derived: account label for display
const accountLabel = computed(() => {
  const acc = accounts.value.find(a => a.company_token === companyToken.value)
  return acc?.account_name || acc?.name || companyToken.value || '—'
})

// Open entry state for current day
const hasOpenToday = ref(false)
const openEntry = ref(null)

const isSameDay = (isoA, isoB) => {
  if (!isoA || !isoB) return false
  const a = new Date(isoA)
  const b = new Date(isoB)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const refreshOpenState = async () => {
  if (!auth.sessionId) return
  try {
    const params = new URLSearchParams()
    params.set('date', new Date().toISOString().slice(0,10))
    if (companyToken.value) params.set('company_token', companyToken.value)
    const res = await fetch(`/api/payroll/me/open-entry?${params.toString()}`, {
      headers: { 'X-Session-ID': auth.sessionId }
    }).then(r => r.json())
    openEntry.value = res?.data || null
    hasOpenToday.value = !!openEntry.value
  } catch {
    hasOpenToday.value = false
    openEntry.value = null
  }
}

const canClockIn = computed(() => !!qrSecret.value && !!companyToken.value && !hasOpenToday.value)
const canClockOut = computed(() => !!qrSecret.value && !!companyToken.value && hasOpenToday.value)
const hasQrContext = computed(() => !!qrSecret.value && !!companyToken.value)

// Prefill from query params when entering via QR path
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('company_token')
  const secret = params.get('qr_secret')
  if (token) companyToken.value = token
  if (secret) qrSecret.value = secret
  if (!token || !secret) {
    await startScanner().catch(() => {})
  }
  refreshOpenState()
})

watch(companyToken, () => refreshOpenState())

const toggleScanner = async () => {
  if (scannerOpen.value) { stopScanner(); return }
  await startScanner()
}

const startScanner = async () => {
  try {
    scannerOpen.value = true
    // Prefer native BarcodeDetector if available
    if ('BarcodeDetector' in window) {
      try { barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }) } catch {}
    }
    if (barcodeDetector) {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (videoEl.value) {
        videoEl.value.srcObject = mediaStream
        await videoEl.value.play()
      }
      scanWithDetector()
    } else {
      await startZxing()
    }
  } catch (e) {
    message.value = 'Camera access denied. Please allow camera or use the QR link.'
    scannerOpen.value = false
  }
}

const scanWithDetector = async () => {
  if (!barcodeDetector || !scannerOpen.value) return
  try {
    const barcodes = await barcodeDetector.detect(videoEl.value)
    if (barcodes && barcodes.length) {
      const raw = barcodes[0].rawValue || ''
      try {
        const url = new URL(raw)
        const token = url.searchParams.get('company_token')
        const secret = url.searchParams.get('qr_secret')
        if (token && secret) {
          companyToken.value = token
          qrSecret.value = secret
          stopScanner()
          return
        }
      } catch {}
    }
  } catch {}
  frameHandle = requestAnimationFrame(scanWithDetector)
}

const stopScanner = () => {
  scannerOpen.value = false
  if (frameHandle) cancelAnimationFrame(frameHandle)
  frameHandle = null
  try { if (videoEl.value) videoEl.value.pause() } catch {}
  if (mediaStream) {
    for (const t of mediaStream.getTracks()) t.stop()
  }
  mediaStream = null
  if (zxingControls && typeof zxingControls.stop === 'function') {
    try { zxingControls.stop() } catch {}
  }
  zxingControls = null
}

onBeforeUnmount(() => stopScanner())

// ZXing fallback
const startZxing = async () => {
  try {
    const mod = await import('@zxing/browser')
    const { BrowserMultiFormatReader } = mod
    zxingReader = new BrowserMultiFormatReader()
    const video = videoEl.value
    if (!video) return
    zxingControls = await zxingReader.decodeFromVideoDevice(undefined, video, (result, err) => {
      if (!result) return
      const raw = result.getText()
      try {
        const url = new URL(raw)
        const token = url.searchParams.get('company_token')
        const secret = url.searchParams.get('qr_secret')
        if (token && secret) {
          companyToken.value = token
          qrSecret.value = secret
          stopScanner()
        }
      } catch {}
    })
    scannerOpen.value = true
  } catch (e) {
    message.value = 'Scanner not supported on this device/browser.'
  }
}

const submitClock = async (dir) => {
  try {
    submitting.value = true
    action.value = dir
    message.value = ''
    success.value = false
    const res = await api.clock(companyToken.value, qrSecret.value)
    if (res.success) {
      success.value = true
      const action = res.data?.action
      const late = res.data?.lateNotice
      message.value = action === 'clock_out' ? 'Clocked out successfully' : (late ? `${late}` : 'Clocked in successfully')
      qrSecret.value = ''
      await refreshOpenState()
      if (action === 'clock_in') {
        setTimeout(() => { router.push('/timesheet') }, 15000)
      }
    } else {
      message.value = res.error || 'Failed'
    }
  } catch (e) {
    message.value = e.message || 'Error'
  } finally {
    submitting.value = false
    action.value = ''
  }
}

const todayLabel = computed(() => new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
}))

const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
</script>

<style scoped>
</style>

 

