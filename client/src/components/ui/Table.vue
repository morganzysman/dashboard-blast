<template>
  <div class="overflow-x-auto">
    <table class="min-w-full w-full text-sm">
      <thead :class="stickyHeader ? 'sticky top-0 bg-white z-10 dark:bg-gray-800' : ''">
        <tr class="text-left text-gray-600 dark:text-gray-300">
          <slot name="head" />
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<script setup>
const props = defineProps({ stickyHeader: { type: Boolean, default: false } })
</script>

<style scoped>
</style>


