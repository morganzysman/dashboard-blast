<template>
  <div :class="skeletonClass" />
</template>

<script setup>
const props = defineProps({
  class: { type: String, default: '' }
})
const skeletonClass = `animate-pulse bg-surface-2 rounded ${props.class}`
</script>

<style scoped>
</style>


