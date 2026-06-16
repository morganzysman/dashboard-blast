<template>
  <div>
    <label v-if="label" class="form-label">{{ label }}</label>
    <input
      v-bind="$attrs"
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      class="form-input"
    />
    <p v-if="hint" class="mt-1 text-xs" style="color: var(--fg3);">{{ hint }}</p>
    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
defineProps({ label: String, hint: String, error: String, modelValue: [String, Number], type: { type: String, default: 'text' }, placeholder: String })
defineEmits(['update:modelValue'])
</script>

<style scoped>
</style>
