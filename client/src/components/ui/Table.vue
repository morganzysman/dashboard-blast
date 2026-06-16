<template>
  <div class="overflow-x-auto">
    <table class="min-w-full w-full text-sm">
      <thead :class="stickyHeader ? 'sticky top-0 z-10' : ''" :style="stickyHeader ? 'background: var(--surface-1);' : ''">
        <tr class="text-left" style="color: var(--fg3);">
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


