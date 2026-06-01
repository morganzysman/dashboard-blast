<template>
  <div
    class="achievement-badge relative rounded-xl border p-4 transition-all duration-300"
    :class="[
      unlocked ? tierClass : 'achievement-locked opacity-75',
      unlocked ? 'achievement-unlocked shadow-md' : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40'
    ]"
  >
    <div v-if="unlocked" class="achievement-sparkle pointer-events-none" aria-hidden="true"></div>

    <div class="flex items-start gap-3">
      <div
        class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl"
        :class="unlocked ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 grayscale'"
      >
        {{ icon }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
          <span v-if="unlocked" class="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-white/30">
            {{ $t('achievements.unlocked') }}
          </span>
        </div>
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ description }}</p>

        <div v-if="!unlocked && progress != null" class="mt-2">
          <ObjectiveProgress
            compact
            :value="current"
            :objective="target"
            :tooltip="progressTooltip"
          />
          <p class="text-[10px] text-gray-500 mt-1 tabular-nums">{{ progressLabel }}</p>
        </div>
        <p v-else-if="unlocked && unlockedLabel" class="text-xs font-medium mt-2 text-white/90">
          {{ unlockedLabel }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import ObjectiveProgress from './ui/ObjectiveProgress.vue'

defineProps({
  icon: { type: String, default: '🏆' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  unlocked: { type: Boolean, default: false },
  tierClass: { type: String, default: '' },
  current: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  progress: { type: Number, default: null },
  progressLabel: { type: String, default: '' },
  progressTooltip: { type: String, default: '' },
  unlockedLabel: { type: String, default: '' }
})
</script>

<style scoped>
.achievement-unlocked {
  transform: translateY(-1px);
}

.achievement-tier-bronze {
  border-color: rgb(180 83 9 / 0.5);
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: white;
}
.achievement-tier-bronze h3,
.achievement-tier-bronze p {
  color: inherit;
}
.achievement-tier-bronze .text-gray-600,
.achievement-tier-bronze .text-gray-400,
.achievement-tier-bronze .text-gray-500 {
  color: rgb(255 255 255 / 0.85) !important;
}

.achievement-tier-silver {
  border-color: rgb(107 114 128 / 0.5);
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  color: white;
}
.achievement-tier-silver h3,
.achievement-tier-silver p {
  color: inherit;
}
.achievement-tier-silver .text-gray-600,
.achievement-tier-silver .text-gray-400,
.achievement-tier-silver .text-gray-500 {
  color: rgb(255 255 255 / 0.85) !important;
}

.achievement-tier-gold {
  border-color: rgb(202 138 4 / 0.5);
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
  color: #422006;
}
.achievement-tier-gold .text-gray-600,
.achievement-tier-gold .text-gray-400 {
  color: rgb(66 32 6 / 0.75) !important;
}

.achievement-tier-platinum {
  border-color: rgb(139 92 246 / 0.5);
  background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
  color: white;
}
.achievement-tier-platinum h3,
.achievement-tier-platinum p {
  color: inherit;
}
.achievement-tier-platinum .text-gray-600,
.achievement-tier-platinum .text-gray-400,
.achievement-tier-platinum .text-gray-500 {
  color: rgb(255 255 255 / 0.9) !important;
}

.achievement-sparkle {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0%, transparent 45%),
              radial-gradient(circle at 80% 30%, rgba(255,255,255,0.2) 0%, transparent 40%);
  animation: achievement-shimmer 3s ease-in-out infinite;
}

@keyframes achievement-shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
