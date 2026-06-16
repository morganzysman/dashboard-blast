<template>
  <span
    class="material-symbols-rounded"
    :class="{ 'is-filled': filled }"
    :style="iconStyle"
    aria-hidden="true"
  >{{ name }}</span>
</template>

<script setup>
import { computed } from 'vue'

/**
 * OlaClick DS icon — Material Symbols Rounded.
 * Resting = FILL 0 (outlined), Active/selected = FILL 1 (filled).
 * Color inherits currentColor. Size 20–24px in UI.
 */
const props = defineProps({
  name: { type: String, required: true },
  filled: { type: Boolean, default: false },
  size: { type: [Number, String], default: 24 },
  weight: { type: [Number, String], default: 400 }
})

const iconStyle = computed(() => ({
  fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
  fontVariationSettings: `'FILL' ${props.filled ? 1 : 0}, 'wght' ${props.weight}, 'GRAD' 0, 'opsz' 24`
}))
</script>
