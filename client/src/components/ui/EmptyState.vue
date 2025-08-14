<template>
  <div class="card">
    <div class="card-body text-center py-12">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        <slot name="icon">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </slot>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{{ title }}</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">{{ subtitle }}</p>
      <div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ title: { type: String, default: 'Nothing here yet' }, subtitle: { type: String, default: 'Try changing filters or come back later.' } })
</script>

<style scoped>
</style>


