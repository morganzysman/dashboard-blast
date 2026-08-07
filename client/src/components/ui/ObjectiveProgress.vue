<template>
  <div class="w-full" :class="compact ? 'space-y-0.5' : 'space-y-1'">
    <div v-if="showLabel" class="flex items-center justify-between text-[10px] leading-none" style="color: var(--fg3);">
      <span class="label-mono truncate">{{ label }}</span>
      <span class="data font-bold" :class="percentTextClass">{{ percentDisplay }}</span>
    </div>
    <div
      class="relative w-full overflow-hidden rounded-full"
      :class="[compact ? 'h-1.5' : 'h-2', trackClass]"
      role="progressbar"
      :aria-valuenow="Math.max(0, Math.round(percent))"
      aria-valuemin="0"
      aria-valuemax="100"
      :title="tooltip"
    >
      <div
        v-if="percent >= 0"
        class="h-full transition-all duration-300 ease-out"
        :class="barClass"
        :style="{ width: barWidth }"
      ></div>
      <div
        v-for="(tick, i) in tickPositions"
        :key="i"
        class="absolute top-0 bottom-0 w-px pointer-events-none z-10"
        style="background: var(--border-strong);"
        :style="{ left: `${tick}%` }"
      ></div>
    </div>
    <div v-if="!showLabel" class="flex justify-end leading-none">
      <span class="data text-[10px] font-bold" :class="percentTextClass">{{ percentDisplay }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, required: true },
  objective: { type: Number, default: null },
  objectives: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  showLabel: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  tooltip: { type: String, default: '' }
})

const sortedTargets = computed(() => {
  if (Array.isArray(props.objectives) && props.objectives.length > 0) {
    return [...props.objectives].filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  }
  if (Number.isFinite(props.objective) && props.objective > 0) return [props.objective]
  return []
})

const fullTarget = computed(() => {
  const arr = sortedTargets.value
  return arr.length ? arr[arr.length - 1] : 0
})

const percent = computed(() => {
  if (!fullTarget.value || fullTarget.value <= 0) return 0
  return (props.value / fullTarget.value) * 100
})

const percentDisplay = computed(() => {
  const p = percent.value
  if (!isFinite(p)) return '0%'
  return `${p.toFixed(0)}%`
})

const barWidth = computed(() => {
  const p = percent.value
  if (p < 0) return '0%'
  if (p > 100) return '100%'
  return `${p}%`
})

const reachedTierIndex = computed(() => {
  let idx = -1
  for (let i = 0; i < sortedTargets.value.length; i++) {
    if (props.value >= sortedTargets.value[i]) idx = i
  }
  return idx
})

const tickPositions = computed(() => {
  const max = fullTarget.value
  if (!max || sortedTargets.value.length < 2) return []
  return sortedTargets.value.slice(0, -1).map(t => (t / max) * 100)
})

/* Menta = en marcha, verde éxito = meta cumplida, mostaza/ladrillo = alerta. */
const barClass = computed(() => {
  const tiers = sortedTargets.value.length
  const reached = reachedTierIndex.value
  if (tiers >= 2) {
    if (reached >= tiers - 1) return 'bg-success-500'
    if (reached >= 0) return 'bg-warning-400'
    if (percent.value >= 50) return 'bg-accent'
    return 'bg-error-400'
  }
  const p = percent.value
  if (p >= 100) return 'bg-success-500'
  if (p >= 75) return 'bg-accent'
  if (p >= 50) return 'bg-warning-400'
  if (p >= 25) return 'bg-warning-500'
  return 'bg-error-400'
})

const trackClass = computed(() => {
  if (percent.value < 0) return 'bg-transparent border border-error-500'
  return 'bg-surface-2'
})

const percentTextClass = computed(() => {
  const tiers = sortedTargets.value.length
  if (percent.value < 0) return 'text-error-600'
  if (tiers >= 2) {
    const reached = reachedTierIndex.value
    if (reached >= tiers - 1) return 'text-success-600 dark:text-success-400'
    if (reached >= 0) return 'text-warning-600 dark:text-warning-400'
    return 'text-fg-muted'
  }
  if (percent.value >= 100) return 'text-success-600 dark:text-success-400'
  return 'text-fg-muted'
})
</script>
