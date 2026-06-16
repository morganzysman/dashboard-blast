<template>
  <div class="card">
    <div class="card-body text-center py-12">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--surface-2); color: var(--fg3);">
        <slot name="icon">
          <MaterialIcon name="inbox" :size="32" />
        </slot>
      </div>
      <h3 class="text-lg font-medium mb-2" style="color: var(--fg1);">{{ title }}</h3>
      <p class="mb-4" style="color: var(--fg3);">{{ subtitle }}</p>
      <div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import MaterialIcon from './MaterialIcon.vue'

const { t } = useI18n()
defineProps({ 
  title: { type: String, default: () => t('common.emptyState.title') }, 
  subtitle: { type: String, default: () => t('common.emptyState.subtitle') } 
})
</script>

<style scoped>
</style>


