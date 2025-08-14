<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{{ label }}</label>
    <input v-bind="$attrs" :type="type" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" />
    <p v-if="hint" class="mt-1 text-xs text-gray-500">{{ hint }}</p>
    <p v-if="error" class="mt-1 text-xs text-error-600">{{ error }}</p>
  </div>
  
</template>

<script setup>
defineProps({ label: String, hint: String, error: String, modelValue: [String, Number], type: { type: String, default: 'text' }, placeholder: String })
defineEmits(['update:modelValue'])
</script>

<style scoped>
</style>


