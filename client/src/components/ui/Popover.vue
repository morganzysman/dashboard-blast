<template>
  <div class="relative" ref="container">
    <button
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="id"
      class="inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
      @click="toggle"
      @keydown.down.prevent="openPanel"
      @keydown.enter.prevent="toggle"
    >
      <slot name="button" />
    </button>
    <transition name="fade" appear>
      <div
        v-if="open"
        :id="id"
        role="dialog"
        class="popover-panel absolute z-50 mt-2 w-[min(24rem,90vw)] rounded-lg p-4"
        :class="panelClass"
      >
        <div class="flex justify-between items-start gap-2 mb-2">
          <slot name="title" />
          <button class="popover-close rounded inline-flex" @click="close" :aria-label="$t('common.close')">
            <MaterialIcon name="close" :size="18" />
          </button>
        </div>
        <div class="max-h-[60vh] overflow-auto">
          <slot />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MaterialIcon from './MaterialIcon.vue'

const props = defineProps({ id: { type: String, default: () => `popover-${Math.random().toString(36).slice(2)}` }, panelClass: { type: String, default: '' } })
const open = ref(false)
const container = ref(null)

const onClickOutside = (e) => {
  if (!container.value) return
  if (!container.value.contains(e.target)) open.value = false
}

const onEscape = (e) => {
  if (e.key === 'Escape') open.value = false
}

const toggle = () => (open.value = !open.value)
const close = () => (open.value = false)
const openPanel = () => (open.value = true)

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onEscape)
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Panel oscuro sobre Verde Tattoo — la voz baja del sistema. */
.popover-panel {
  background: var(--tattoo);
  color: var(--cream);
  border: 1px solid var(--tattoo-press);
  box-shadow: var(--shadow-pop);
}

[data-theme='dark'] .popover-panel {
  background: var(--surface-2);
  border-color: var(--border-strong);
  color: var(--fg2);
}

.popover-close {
  color: color-mix(in srgb, currentColor 62%, transparent);
  transition: color 0.15s ease;
}

.popover-close:hover {
  color: var(--accent);
}

.popover-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>


