<template>
  <div class="space-y-4 lg:space-y-6 max-w-xl mx-auto">
    <div class="card">
      <div class="card-body">
        <h2 class="text-lg font-bold text-gray-900">{{ $t('employee.clock.title') }}</h2>
        <p class="text-sm text-gray-600">{{ $t('employee.clock.subtitle') }}</p>
        <div v-if="!isEmployee">
          <div class="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            {{ $t('employee.clock.employeesOnly') }}
          </div>
          <div class="mt-3">
            <router-link class="btn-primary w-full" :to="{ name: 'Login', query: loginPrefill }">{{ $t('employee.clock.goToLogin') }}</router-link>
          </div>
        </div>
        <div v-else>
          <div class="mt-4 space-y-3">
            <template v-if="hasQrContext">
              <div class="text-gray-800">
                <span class="font-semibold text-xl">{{ $t('employee.clock.greeting', { name: auth.user?.name?.split(' ')[0] || $t('employee.clock.defaultGreeting') }) }}!</span>
              </div>
              <div class="text-xs text-gray-500">{{ todayLabel }}</div>
              <div class="text-sm text-gray-700">
                <span class="font-medium">{{ $t('rentability.account') }}:</span>
                <span>{{ accountLabel }}</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div v-if="openEntry">
                <div class="px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                  {{ $t('employee.clock.clockedIn') }} {{ formatTime(openEntry.clock_in_at) }}
                </div>
              </div>
              <button v-else class="btn-primary w-full" :disabled="submitting || !canClockIn" @click="submitClock('in')">
                {{ submitting && action==='in' ? $t('employee.clock.clockingIn') : $t('employee.clock.clockIn') }}
              </button>
              <button 
                class="btn-danger w-full" 
                :disabled="submitting || !canClockOut" 
                :title="(submitting || !canClockOut) ? clockOutDisabledReason : ''"
                @click="submitClock('out')"
              >
                {{ submitting && action==='out' ? $t('employee.clock.clockingOut') : $t('employee.clock.clockOut') }}
              </button>
              <p 
                v-if="!submitting && !canClockOut && hasQrContext" 
                class="text-xs text-gray-500 text-center mt-1"
              >
                {{ clockOutDisabledReason }}
              </p>
              </div>
            </template>
            <template v-else>
              <!-- Camera Scanner -->
              <div v-if="cameraPermission !== 'denied'" class="flex items-center justify-center">
                <div class="mt-2 rounded overflow-hidden border border-gray-200 relative w-full max-w-xl">
                  <video ref="videoEl" class="w-full h-64 object-cover" playsinline></video>
                  <div class="absolute inset-0 pointer-events-none border-2 border-green-500 m-8 rounded"></div>
                  <div class="absolute bottom-1 right-2 bg-black bg-opacity-50 text-white text-[10px] px-1 rounded">{{ $t('employee.clock.scanner') }}</div>
                </div>
              </div>
              
              <!-- Camera permission reset option for denied access -->
              <div v-if="cameraPermission === 'denied'" class="space-y-3">
                <div class="text-center text-sm text-gray-600">
                  {{ $t('employee.clock.cameraAccessDenied') }}
                </div>
                <div class="flex justify-center">
                  <button 
                    @click="resetCameraPermission" 
                    class="btn-secondary btn-sm"
                  >
                    {{ $t('employee.clock.resetCameraPermission') }}
                  </button>
                </div>
              </div>
            </template>
            <p v-if="message" class="text-sm" :class="messageClass">{{ message }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Day recap modal after clock-out -->
    <div v-if="showRecap" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-md font-semibold">{{ recap.date }}</h3>
          <button class="btn-secondary btn-xs" @click="showRecap=false">Close</button>
        </div>
        <div class="space-y-2 max-h-[50vh] overflow-auto">
          <div v-if="recap.entries.length===0" class="text-sm text-gray-600 text-center">No entries today</div>
          <div v-for="e in recap.entries" :key="e.id || e.clock_in_at" class="flex items-center justify-between text-sm border-b pb-1">
            <div>
              <div class="text-gray-900">{{ formatTime(e.clock_in_at) }} → {{ e.clock_out_at ? formatTime(e.clock_out_at) : '…' }}</div>
              <div class="text-gray-500 text-xs">{{ formatDurationHms(e.seconds) }}</div>
            </div>
            <div class="font-medium">{{ formatCurrency(e.amount || 0) }}</div>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <div class="text-gray-600">Total</div>
          <div class="font-semibold">{{ formatDurationHms(recap.totalSeconds) }} · {{ formatCurrency(recap.totalAmount) }}</div>
        </div>
        <div class="mt-3 text-right">
          <button class="btn-primary btn-sm" @click="showRecap=false">Close</button>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
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
const cameraPermission = ref('unknown') // 'granted', 'denied', 'prompt', 'unknown'
let mediaStream = null
let frameHandle = null
let barcodeDetector = null
let zxingReader = null
let zxingControls = null

// Recap modal
const showRecap = ref(false)
const recap = ref({ date: '', entries: [], totalSeconds: 0, totalAmount: 0 })

// Derived: account label for display
const accountLabel = computed(() => {
  const acc = accounts.value.find(a => a.company_token === companyToken.value)
  return acc?.account_name || acc?.name || companyToken.value || '—'
})

// Open entry state for current day
const hasOpenToday = ref(false)
const openEntry = ref(null)
const nowTick = ref(Date.now())

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
const clockOutDisabledReason = computed(() => {
  if (submitting.value) return t('employee.clock.pleaseWait')
  if (!qrSecret.value || !companyToken.value) return t('employee.clock.disableClockOut.noQrContext')
  if (!hasOpenToday.value) return t('employee.clock.disableClockOut.noOpenEntry')
  return ''
})
const hasQrContext = computed(() => !!qrSecret.value && !!companyToken.value)

// Check camera permissions
const checkCameraPermission = async () => {
  try {
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'camera' })
      cameraPermission.value = permission.state
      permission.addEventListener('change', () => {
        cameraPermission.value = permission.state
        localStorage.setItem('cameraPermission', permission.state)
      })
      localStorage.setItem('cameraPermission', permission.state)
      return permission.state
    } else {
      const stored = localStorage.getItem('cameraPermission')
      if (stored) {
        cameraPermission.value = stored
        return stored
      }
      cameraPermission.value = 'prompt'
      return 'prompt'
    }
  } catch (error) {
    cameraPermission.value = 'prompt'
    return 'prompt'
  }
}

// Prefill from query params when entering via QR path
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('company_token')
  const secret = params.get('qr_secret')
  if (token) companyToken.value = token
  if (secret) qrSecret.value = secret
  const permission = await checkCameraPermission()
  if (!token || !secret) {
    if (permission === 'granted' || permission === 'prompt') {
      await startScanner().catch(() => {})
    }
  }
  refreshOpenState()
  tickHandle = window.setInterval(() => { nowTick.value = Date.now() }, 1000)
})

watch(companyToken, () => refreshOpenState())

const resetCameraPermission = () => {
  localStorage.removeItem('cameraPermission')
  cameraPermission.value = 'unknown'
  message.value = t('employee.clock.cameraPermissionReset')
  startScanner().catch(() => {})
}

const toggleScanner = async () => {
  if (scannerOpen.value) { stopScanner(); return }
  await startScanner()
}

const startScanner = async () => {
  try {
    message.value = ''
    if (cameraPermission.value === 'unknown') {
      await checkCameraPermission()
    }
    if (cameraPermission.value === 'denied') {
      message.value = t('employee.clock.cameraAccessDenied')
      return
    }
    scannerOpen.value = true
    if ('BarcodeDetector' in window) {
      try { barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }) } catch {}
    }
    if (barcodeDetector) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } }, 
          audio: false 
        })
        cameraPermission.value = 'granted'
        localStorage.setItem('cameraPermission', 'granted')
        if (videoEl.value) {
          videoEl.value.srcObject = mediaStream
          await videoEl.value.play()
        }
        scanWithDetector()
      } catch (permissionError) {
        cameraPermission.value = 'denied'
        localStorage.setItem('cameraPermission', 'denied')
        throw permissionError
      }
    } else {
      await startZxing()
    }
  } catch (e) {
    scannerOpen.value = false
    if (e.name === 'NotAllowedError') {
      cameraPermission.value = 'denied'
      localStorage.setItem('cameraPermission', 'denied')
      message.value = t('employee.clock.cameraAccessDenied')
    } else if (e.name === 'NotFoundError') {
      message.value = t('employee.clock.noCameraFound')
    } else {
      message.value = t('employee.clock.unableToAccessCamera')
    }
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

onBeforeUnmount(() => { stopScanner(); if (tickHandle) window.clearInterval(tickHandle) })

let tickHandle = null

watch(openEntry, () => { nowTick.value = Date.now() })

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
    message.value = t('employee.clock.scannerNotSupported')
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
      message.value = action === 'clock_out' ? t('employee.clock.clockOutSuccess') : (late ? `${late}` : t('employee.clock.clockInSuccess'))
      qrSecret.value = ''
      await refreshOpenState()
      // After clock-out, show a day recap modal instead of redirecting
      if (action === 'clock_out') {
        try { await loadDayRecap() } catch {}
        showRecap.value = true
      }
    } else {
      message.value = res.error || t('common.failed')
    }
  } catch (e) {
    message.value = e.message || t('common.error')
  } finally {
    submitting.value = false
    action.value = ''
  }
}

const todayLabel = computed(() => new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
}))

const formatTime = (iso) => {
  const timezone = auth.user?.timezone || 'America/Lima'
  return new Date(iso).toLocaleTimeString('en-US', { 
    timeZone: timezone,
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

// Fetch today's entries for recap
const loadDayRecap = async () => {
  const tzDate = new Date()
  const today = tzDate.toISOString().slice(0,10)
  const data = await api.getMyEntries(today, today)
  const items = Array.isArray(data?.data) ? data.data : []
  let totalSeconds = 0
  let totalAmount = 0
  const entries = items.map(e => {
    const start = e.clock_in_at ? new Date(e.clock_in_at) : null
    const end = e.clock_out_at ? new Date(e.clock_out_at) : null
    const secs = (start && end) ? Math.max(0, Math.floor((end - start) / 1000)) : 0
    totalSeconds += secs
    totalAmount += Number(e.amount || 0)
    return {
      id: e.id,
      clock_in_at: e.clock_in_at,
      clock_out_at: e.clock_out_at,
      amount: e.amount || 0,
      seconds: secs
    }
  })
  recap.value = { date: today, entries, totalSeconds, totalAmount }
}

const formatDurationHms = (secs) => {
  const h = Math.floor(secs / 3600).toString().padStart(2,'0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2,'0')
  const s = Math.floor(secs % 60).toString().padStart(2,'0')
  return `${h}:${m}:${s}`
}

const formatCurrency = (n) => {
  const symbol = auth.user?.currencySymbol || 'S/'
  return `${symbol} ${(Number(n)||0).toFixed(2)}`
}

// Removed extra context: only show clock-in time per request
</script>

<style scoped>
</style>

 

