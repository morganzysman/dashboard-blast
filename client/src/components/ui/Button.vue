<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <span v-if="loading" class="loading-spinner !w-4 !h-4 spinner-on-fill"></span>
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Blast DS Button — Quicksand 700.
 * Variants: primary, secondary, outline, ghost, plain, danger, success, warning
 * Sizes: xs, sm, md, lg, xl
 */
const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const variantClass = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  plain: 'btn-plain',
  danger: 'btn-danger',
  success: 'btn-success',
  warning: 'btn-warning'
}

const sizeClass = {
  xs: 'h-6 px-2.5 text-[11px] rounded-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  xl: 'h-14 px-6 text-base'
}

const classes = computed(() => [
  'btn',
  variantClass[props.variant] || variantClass.primary,
  sizeClass[props.size] || '',
  props.loading ? 'opacity-65' : ''
])
</script>

<style scoped>
/* The spinner sits on a filled button, so it borrows the label colour. */
.spinner-on-fill {
  border-color: color-mix(in srgb, currentColor 35%, transparent);
  border-top-color: currentColor;
}
</style>
