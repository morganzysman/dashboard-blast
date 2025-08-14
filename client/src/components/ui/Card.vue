<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
    <div v-if="$slots.header" class="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700">
      <slot name="header" />
    </div>
    <div class="p-3 sm:p-4 md:p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
</style>


