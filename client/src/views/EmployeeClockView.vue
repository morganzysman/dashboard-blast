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
    const res = await api.clock(companyToken.value, qrSecret.value)
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

 

