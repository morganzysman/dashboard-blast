<template>
  <div class="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">My Timesheet</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="space-x-2">
            <button class="btn-secondary btn-sm" @click="prevPeriod">Prev</button>
            <button class="btn-secondary btn-sm" @click="nextPeriod">Next</button>
            <button class="btn-primary btn-sm" @click="loadEntries">Refresh</button>
          </div>
        </div>
        <div class="mt-4">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="py-2">Clock In</th>
                <th class="py-2">Clock Out</th>
                <th class="py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in entries" :key="e.id" class="border-t">
                <td class="py-2">{{ formatDateTime(e.clock_in_at) }}</td>
                <td class="py-2">{{ e.clock_out_at ? formatDateTime(e.clock_out_at) : '—' }}</td>
                <td class="py-2">{{ formatDuration(secondsBetween(e.clock_in_at, e.clock_out_at)) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="mt-4 text-right text-gray-800 font-medium">
            Total: {{ formatDuration(totalSeconds) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '../utils/api'

const entries = ref([])
const period = ref({ start: '', end: '' })

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const secondsBetween = (a,b) => {
  if (!a || !b) return 0
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime())/1000)
}

const totalSeconds = computed(() => entries.value.reduce((s, e) => s + secondsBetween(e.clock_in_at, e.clock_out_at), 0))

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}

const formatDateTime = (iso) => new Date(iso).toLocaleString('en-CL', { timeZone: 'America/Santiago' })

const loadEntries = async () => {
  const res = await api.getMyEntries()
  if (res.success) {
    entries.value = res.data
    period.value = res.period
  }
}

const shiftPeriod = (direction) => {
  // Allow preview by shifting client labels; actual API is current period only as spec
  // Keep UI navigation but still loads current period from API for safety
  loadEntries()
}

const prevPeriod = () => shiftPeriod(-1)
const nextPeriod = () => shiftPeriod(1)

loadEntries()
</script>

<style scoped>
</style>

