<template>
  <div class="relative rounded overflow-hidden" :class="wrapperClass" style="background: var(--surface-2);">
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="w-full h-full object-cover cursor-zoom-in"
      @click="$emit('open', src)"
    />
    <div v-else-if="failed" class="w-full h-full flex items-center justify-center text-fg-muted">
      <MaterialIcon name="broken_image" :size="20" />
    </div>
    <div v-else class="w-full h-full animate-pulse"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import api from '../utils/api'
import MaterialIcon from './ui/MaterialIcon.vue'

const props = defineProps({
  photoId: { type: String, required: true },
  alt: { type: String, default: '' },
  wrapperClass: { type: String, default: 'h-24' }
})

defineEmits(['open'])

const src = ref('')
const failed = ref(false)

onMounted(async () => {
  try {
    src.value = await api.getTrainingPhotoObjectUrl(props.photoId)
  } catch {
    failed.value = true
  }
})

// Object URLs leak the whole blob until revoked, and a review queue can hold
// dozens of photos.
onBeforeUnmount(() => {
  if (src.value) URL.revokeObjectURL(src.value)
})
</script>
