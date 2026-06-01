<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
    <!-- Header: metric + how many reached -->
    <div class="flex items-center justify-between gap-3 mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-lg">{{ track.category === 'sales' ? '💵' : '📈' }}</span>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ title }}</h3>
      </div>
      <span class="text-xs text-gray-500 whitespace-nowrap">
        {{ $t('achievements.reached', { achieved: track.achievedCount, total: track.totalCount }) }}
      </span>
    </div>

    <!-- Current value + next goal -->
    <div class="flex items-end justify-between gap-3 mb-3">
      <div class="min-w-0">
        <p class="text-xl font-bold tabular-nums" :class="valueClass">{{ formatValue(track.current) }}</p>
        <p v-if="track.complete" class="text-xs font-medium text-green-600 mt-0.5">
          {{ $t('achievements.allReached') }} 🎉
        </p>
        <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ $t('achievements.nextGoal', { target: tierLabel(track.nextTier) }) }}
          <span class="text-gray-400">· {{ $t('achievements.toGo', { amount: formatValue(Math.max(0, track.nextTier.target - track.current)) }) }}</span>
        </p>
      </div>
      <span class="text-2xl flex-shrink-0">{{ track.complete ? '🏆' : track.nextTier.icon }}</span>
    </div>

    <!-- Progress toward the next milestone -->
    <div v-if="!track.complete" class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-4">
      <div class="h-full rounded-full bg-blue-500 transition-all duration-500" :style="{ width: track.progressToNext + '%' }"></div>
    </div>
    <div v-else class="h-1.5 rounded-full bg-green-500 mb-4"></div>

    <!-- Milestone ladder -->
    <div class="flex items-start">
      <div
        v-for="tier in track.tiers"
        :key="tier.id"
        class="flex flex-col items-center flex-1 min-w-0"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2"
          :class="nodeClass(tier)"
        >
          <span v-if="tier.unlocked">✓</span>
          <span v-else>{{ tier.step }}</span>
        </div>
        <span class="mt-1 text-[10px] text-center leading-tight tabular-nums px-0.5" :class="labelClass(tier)">
          {{ tierLabel(tier) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  track: { type: Object, required: true },
  title: { type: String, required: true },
  symbol: { type: String, default: 'S/' }
})

const valueClass = computed(() => {
  if (props.track.category === 'profit' && props.track.current < 0) return 'text-red-600'
  return 'text-gray-900 dark:text-gray-100'
})

function formatValue(n) {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toLocaleString('en-US')
  return v < 0 ? `-${props.symbol} ${s}` : `${props.symbol} ${s}`
}

function tierLabel(tier) {
  if (!tier) return ''
  // A "positive net gain" rung (target <= 1) reads better as a word than a tiny amount.
  if (props.track.category === 'profit' && tier.target <= 1) return tierProfitableLabel.value
  return formatValue(tier.target)
}

const tierProfitableLabel = computed(() => t('achievements.profitable'))

function nodeClass(tier) {
  if (tier.unlocked) return 'bg-green-500 border-green-500 text-white'
  if (props.track.nextTier && tier.id === props.track.nextTier.id) return 'border-blue-500 text-blue-600 dark:text-blue-400'
  return 'border-gray-300 dark:border-gray-600 text-gray-400'
}

function labelClass(tier) {
  if (tier.unlocked) return 'text-gray-700 dark:text-gray-300'
  if (props.track.nextTier && tier.id === props.track.nextTier.id) return 'text-blue-600 dark:text-blue-400 font-semibold'
  return 'text-gray-400'
}
</script>
