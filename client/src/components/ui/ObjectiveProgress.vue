<template>
  <div class="w-full" :class="compact ? 'space-y-0.5' : 'space-y-1'">
    <div v-if="showLabel" class="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 leading-none">
      <span class="truncate">{{ label }}</span>
      <span class="font-semibold tabular-nums" :class="percentTextClass">{{ percentDisplay }}</span>
    </div>
    <div
      class="relative w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      :class="compact ? 'h-1.5' : 'h-2'"
      role="progressbar"
      :aria-valuenow="Math.max(0, Math.round(percent))"
      aria-valuemin="0"
      aria-valuemax="100"
      :title="tooltip"
    >
      <div
        class="h-full transition-all duration-300 ease-out"
        :class="barClass"
        :style="{ width: barWidth }"
      ></div>
    </div>
    <div v-if="!showLabel" class="flex justify-end leading-none">
      <span class="text-[10px] font-semibold tabular-nums" :class="percentTextClass">{{ percentDisplay }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, required: true },
  objective: { type: Number, required: true },
  label: { type: String, default: '' },
  showLabel: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  tooltip: { type: String, default: '' }
})

const percent = computed(() => {
  if (!props.objective || props.objective <= 0) return 0
  return (props.value / props.objective) * 100
})

const percentDisplay = computed(() => {
  const p = percent.value
  if (!isFinite(p)) return '0%'
  return `${p.toFixed(0)}%`
})

const barWidth = computed(() => {
  const p = percent.value
  if (p < 0) return '100%'
  if (p > 100) return '100%'
  return `${p}%`
})

const barClass = computed(() => {
  const p = percent.value
  if (p < 0) return 'bg-red-500'
  if (p >= 100) return 'bg-green-500'
  if (p >= 75) return 'bg-green-400'
  if (p >= 50) return 'bg-yellow-400'
  if (p >= 25) return 'bg-orange-400'
  return 'bg-red-400'
})

const percentTextClass = computed(() => {
  const p = percent.value
  if (p < 0) return 'text-red-600 dark:text-red-400'
  if (p >= 100) return 'text-green-600 dark:text-green-400'
  return 'text-gray-600 dark:text-gray-300'
})
</script>
