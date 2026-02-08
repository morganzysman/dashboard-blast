<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{{ label }}</label>
    <input v-bind="$attrs" :type="type" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" class="block w-full px-3.5 py-2.5 rounded-xl transition-all duration-200 focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" style="background: rgba(255,255,255,0.60); border: 1px solid rgba(209,213,219,0.6); box-shadow: 0 1px 4px rgba(0,0,0,0.04);" onfocus="this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.15)'; this.style.background='rgba(255,255,255,0.80)'" onblur="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; this.style.background='rgba(255,255,255,0.60)'" />
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


