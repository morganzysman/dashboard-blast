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
        class="absolute z-50 mt-2 w-[min(24rem,90vw)] rounded-lg border border-gray-200 bg-gray-900 text-white p-4 shadow-xl dark:bg-gray-800 dark:border-gray-700"
        :class="panelClass"
      >
        <div class="flex justify-between items-start gap-2 mb-2">
          <slot name="title" />
          <button class="text-gray-400 hover:text-white focus:ring-2 focus:ring-primary-500 rounded" @click="close" aria-label="Close">
            ✕
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
</style>


