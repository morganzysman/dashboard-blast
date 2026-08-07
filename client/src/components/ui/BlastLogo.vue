<template>
  <span class="blast-logo" :style="{ height: `${height}px` }" v-html="markup" />
</template>

<script setup>
import { computed } from 'vue'
import wordmark from '../../assets/brand/blast-wordmark.svg?raw'
import blast from '../../assets/brand/blast-blast.svg?raw'
import icon from '../../assets/brand/blast-b.svg?raw'

/**
 * Official Blast isologo, taken from the vector artwork in the brand manual.
 * The marks are single-colour and inherit `currentColor`, so the same file
 * serves Verde Tattoo on cream and Verde Menta on Verde Tattoo.
 *
 * Brand rules enforced here: never redraw the logotype with live text, never
 * rotate/skew it, and keep clear space equal to the height of the "B".
 */
const props = defineProps({
  variant: {
    type: String,
    default: 'isologo',
    validator: (v) => ['isologo', 'wordmark', 'icon'].includes(v),
  },
  height: {
    type: Number,
    default: 32,
  },
})

const markup = computed(() => ({
  isologo: wordmark,
  wordmark: blast,
  icon,
}[props.variant]))
</script>

<style scoped>
.blast-logo {
  display: inline-flex;
  align-items: center;
  /* Monocromo por defecto; los callers que viven sobre un fondo propio
     (sidebar, topbar) sobrescriben con su color inline. */
  color: var(--logo-ink);
}

.blast-logo :deep(svg) {
  height: 100%;
  width: auto;
  display: block;
}
</style>
