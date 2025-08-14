<template>
  <div class="card relative overflow-hidden transition-shadow duration-200 hover:shadow-md dark:bg-gray-800 dark:border-gray-700">
    <div class="card-body flex items-center gap-3 sm:gap-4">
      <div class="shrink-0 rounded-lg p-2 sm:p-3" :class="iconBg">
        <slot name="icon" />
      </div>
      <div class="min-w-0">
        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
        <p class="text-lg sm:text-xl font-semibold truncate" :class="valueClass">{{ value }}</p>
        <p v-if="subtext" class="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{{ subtext }}</p>
        <div v-if="$slots.extra" class="mt-2">
          <slot name="extra" />
        </div>
      </div>
      <div class="ml-auto">
        <slot name="action" />
      </div>
    </div>
  </div>
  
</template>

<script setup>
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

const valueClass = toneToClasses[props.tone] || toneToClasses.neutral
const iconBg = iconToBg[props.tone] || iconToBg.neutral
</script>

<style scoped>
</style>


