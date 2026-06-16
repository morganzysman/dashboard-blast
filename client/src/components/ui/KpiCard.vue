<template>
  <div class="card relative overflow-hidden">
    <div class="card-body !p-3 sm:!p-4">
      <!-- Header with icon next to title -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="shrink-0 rounded-md p-1.5 sm:p-2" :class="iconBg">
            <slot name="icon" />
          </div>
          <p class="text-xs sm:text-sm font-medium truncate" style="color: var(--fg3);" :title="label">{{ label }}</p>
        </div>
        <div class="ml-auto">
          <slot name="action" />
        </div>
      </div>
      
      <!-- Value -->
      <div class="mb-2">
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums" :class="valueClass">{{ value }}</p>
        <p v-if="subtext" class="text-xs mt-0.5 leading-tight" style="color: var(--fg-muted);">{{ subtext }}</p>
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
  positive: 'text-success-700 dark:text-success-400',
  negative: 'text-error-600 dark:text-error-400',
  neutral: 'text-fg'
}

const iconToBg = {
  positive: 'bg-success-100 text-success-700',
  negative: 'bg-error-100 text-error-600',
  neutral: 'bg-surface-2 text-fg-muted'
}

const valueClass = computed(() => toneToClasses[props.tone] || toneToClasses.neutral)
const iconBg = computed(() => iconToBg[props.tone] || iconToBg.neutral)
</script>

<style scoped>
</style>


