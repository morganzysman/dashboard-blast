<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium border"
    :class="[sizeClass, styleClass]"
  >
    <span class="inline-block rounded-full" :class="dotClass" :style="dotStyle"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  // 'none' | 'awaiting_employer' | 'awaiting_worker' | 'pending' | 'active' | 'expired' | 'cancelled'
  status: { type: String, default: 'none' },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})

const { t } = useI18n()

const STYLES = {
  active: 'bg-green-50 text-green-700 border-green-200',
  awaiting_employer: 'bg-amber-50 text-amber-700 border-amber-200',
  awaiting_worker: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  none: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}
const DOTS = {
  active: '#16a34a',
  awaiting_employer: '#d97706',
  awaiting_worker: '#2563eb',
  pending: '#d97706',
  expired: '#dc2626',
  none: '#dc2626',
  cancelled: '#9ca3af',
}

const styleClass = computed(() => STYLES[props.status] || STYLES.none)
const dotStyle = computed(() => ({ backgroundColor: DOTS[props.status] || DOTS.none }))
const sizeClass = computed(() => (props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'))
const dotClass = computed(() => (props.size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'))
const label = computed(() => t(`contract.status.${props.status}`))
</script>
