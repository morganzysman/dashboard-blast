<template>
  <div class="space-y-2">
    <div class="relative rounded-lg border-2 border-dashed border-gray-300 bg-white" style="touch-action: none;">
      <canvas ref="canvasEl" class="w-full block rounded-lg" :style="{ height: height + 'px' }"></canvas>
      <span
        v-if="empty"
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300 select-none"
      >
        {{ placeholder || $t('contract.signHere') }}
      </span>
    </div>
    <div class="flex justify-end">
      <button type="button" class="btn-secondary btn-xs" @click="clear">{{ $t('contract.clearSignature') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SignaturePad from 'signature_pad'

const props = defineProps({
  height: { type: Number, default: 180 },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['change'])

const canvasEl = ref(null)
const empty = ref(true)
let pad = null
let resizeObserver = null

// signature_pad draws in CSS pixels but the canvas backing store must match the
// device pixel ratio or strokes look blurry / offset. Resizing clears the pad,
// so we only resize on mount and on real size changes.
function resizeCanvas() {
  const canvas = canvasEl.value
  if (!canvas || !pad) return
  const ratio = Math.max(window.devicePixelRatio || 1, 1)
  const wasEmpty = pad.isEmpty()
  const data = wasEmpty ? null : pad.toData()
  canvas.width = canvas.offsetWidth * ratio
  canvas.height = canvas.offsetHeight * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  pad.clear()
  if (data) pad.fromData(data)
  empty.value = pad.isEmpty()
}

function onEnd() {
  empty.value = pad ? pad.isEmpty() : true
  emit('change', !empty.value)
}

function clear() {
  if (pad) pad.clear()
  empty.value = true
  emit('change', false)
}

function isEmpty() {
  return pad ? pad.isEmpty() : true
}

// Trimmed PNG data URL, or null when nothing was drawn.
function toDataURL() {
  if (!pad || pad.isEmpty()) return null
  return pad.toDataURL('image/png')
}

defineExpose({ clear, isEmpty, toDataURL })

onMounted(async () => {
  await nextTick()
  pad = new SignaturePad(canvasEl.value, { penColor: '#111827', backgroundColor: 'rgba(255,255,255,0)' })
  pad.addEventListener('endStroke', onEnd)
  resizeCanvas()
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasEl.value)
  } else {
    window.addEventListener('resize', resizeCanvas)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', resizeCanvas)
  if (pad) pad.removeEventListener('endStroke', onEnd)
})
</script>

<style scoped>
.btn-xs { @apply px-2.5 py-1 text-xs font-medium; }
</style>
