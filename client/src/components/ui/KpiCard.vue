<template>
  <div class="card relative overflow-hidden transition-shadow duration-200 hover:shadow-md dark:bg-gray-800 dark:border-gray-700">
    <div class="card-body">
      <!-- Header with icon next to title -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="shrink-0 rounded-lg p-2" :class="iconBg">
            <slot name="icon" />
          </div>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{{ label }}</p>
        </div>
        <div class="ml-auto">
          <slot name="action" />
        </div>
      </div>
      
      <!-- Value -->
      <div class="mb-3">
        <p class="text-2xl sm:text-3xl font-bold" :class="valueClass">{{ value }}</p>
        <p v-if="subtext" class="text-xs text-gray-400 mt-1 dark:text-gray-500">{{ subtext }}</p>
      </div>
      
      <!-- Chart area - takes full width -->
      <div v-if="$slots.extra" class="w-full">
        <slot name="extra" />
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ label: String, value: [String, Number], subtext: String, tone: { type: String, default: 'neutral' } })

const toneToClasses = {
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-gray-900 dark:text-gray-100'
}

const iconToBg = {
  positive: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300',
  negative: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
}

const valueClass = computed(() => toneToClasses[props.tone] || toneToClasses.neutral)
const iconBg = computed(() => iconToBg[props.tone] || iconToBg.neutral)
</script>

<style scoped>
</style>


