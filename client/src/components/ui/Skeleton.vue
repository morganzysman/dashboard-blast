<template>
  <div :class="skeletonClass" />
</template>

<script setup>
const props = defineProps({
  class: { type: String, default: '' }
})
const skeletonClass = `animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${props.class}`
</script>

<style scoped>
</style>


