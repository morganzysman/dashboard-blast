<template>
  <div class="space-y-4 lg:space-y-6 max-w-xl mx-auto">
    <div class="card">
      <div class="card-body">
        <h2 class="text-lg font-bold text-gray-900">Employee Clock</h2>
        <p class="text-sm text-gray-600">Scan or paste the account QR code to clock in/out.</p>
        <div class="mt-4 space-y-3">
          <div>
            <label class="text-xs text-gray-700">QR Secret</label>
            <input v-model="qrSecret" type="text" class="form-input w-full" placeholder="Paste QR secret" />
          </div>
          <div>
            <label class="text-xs text-gray-700">Account</label>
            <select v-model="companyToken" class="form-input w-full">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">{{ acc.name || acc.company_token }}</option>
            </select>
          </div>
          <button class="btn-primary w-full" :disabled="submitting || !qrSecret || !companyToken" @click="submitClock">
            {{ submitting ? 'Submitting...' : 'Clock In/Out' }}
          </button>
          <p v-if="message" class="text-sm" :class="messageClass">{{ message }}</p>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const auth = useAuthStore()
const accounts = computed(() => auth.user?.userAccounts || [])
const companyToken = ref(accounts.value[0]?.company_token || '')
const qrSecret = ref('')
const submitting = ref(false)
const message = ref('')
const messageClass = computed(() => success.value ? 'text-green-600' : 'text-red-600')
const success = ref(false)

const submitClock = async () => {
  try {
    submitting.value = true
    message.value = ''
    success.value = false
    const res = await api.post('/api/payroll/clock', { company_token: companyToken.value, qr_secret: qrSecret.value })
    if (res.success) {
      success.value = true
      const action = res.data?.action
      message.value = action === 'clock_out' ? 'Clocked out successfully' : 'Clocked in successfully'
      qrSecret.value = ''
    } else {
      message.value = res.error || 'Failed'
    }
  } catch (e) {
    message.value = e.message || 'Error'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
</style>

<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <h2 class="text-lg font-bold text-gray-900">Clock In / Out</h2>
        <p class="text-sm text-gray-600">Scan the restaurant QR or paste the code to clock in or out. Action requires authentication.</p>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Company Token</label>
            <input v-model="companyToken" class="form-input w-full" placeholder="COMPANY_TOKEN" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">QR Secret</label>
            <input v-model="qrSecret" class="form-input w-full" placeholder="QR secret" />
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button class="btn-primary" :disabled="loading || !companyToken || !qrSecret" @click="submitClock">
            {{ loading ? 'Processing...' : 'Clock In / Out' }}
          </button>
          <span v-if="lastAction" class="text-sm text-gray-600">Last action: <strong>{{ lastAction }}</strong></span>
        </div>

        <div v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</div>
        <div v-if="successMsg" class="mt-3 text-sm text-green-600">{{ successMsg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const error = ref('')
const successMsg = ref('')
const lastAction = ref('')
const companyToken = ref(auth.user?.accounts?.[0]?.company_token || '')
const qrSecret = ref('')

const submitClock = async () => {
  error.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    const res = await api.post('/api/payroll/clock', { company_token: companyToken.value, qr_secret: qrSecret.value })
    if (res.success) {
      lastAction.value = res.data.action
      successMsg.value = `Success: ${res.data.action.replace('_', ' ')}`
    } else {
      error.value = res.error || 'Failed'
    }
  } catch (e: any) {
    error.value = e.message || 'Request failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
</style>

