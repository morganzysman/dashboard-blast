<template>
  <!-- Desktop/tablet table -->
  <div class="hidden md:block">
    <div class="overflow-x-auto">
      <table class="min-w-full w-full text-sm">
        <thead :class="stickyHeader ? 'sticky top-0 bg-white z-10 dark:bg-gray-800' : ''">
          <tr class="text-left text-gray-600 dark:text-gray-300">
            <th v-for="col in columns" :key="col.key" class="py-2" :class="col.headerClass">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="n in skeletonCount" :key="`sk-${n}`" class="border-t animate-pulse">
              <td v-for="col in columns" :key="col.key" class="py-2">
                <div class="h-3 bg-gray-200 rounded" :class="col.skeletonWidth || 'w-24'"></div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="item in items" :key="rowKey(item)" class="border-t hover:bg-gray-50 odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800 dark:hover:bg-gray-700">
              <td v-for="col in columns" :key="col.key" class="py-2" :class="col.cellClass">
                <slot :name="`cell-${col.key}`" :item="item">{{ formatDefaultCell(item, col.key) }}</slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Mobile card list -->
  <div class="md:hidden space-y-2">
    <template v-if="loading">
      <div v-for="n in skeletonCount" :key="`skm-${n}`" class="border rounded p-3 bg-white dark:bg-gray-900 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-32 mb-2"></div>
        <div class="space-y-2">
          <div v-for="m in 3" :key="m" class="h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="item in items" :key="rowKey(item)" class="border rounded p-3 bg-white dark:bg-gray-900">
        <slot name="mobile-card" :item="item">
          <div class="font-medium text-gray-900 dark:text-gray-100 mb-2">{{ mobileTitle(item) }}</div>
          <div class="space-y-1 text-xs">
            <div v-for="col in columns" :key="col.key" class="flex justify-between gap-2">
              <span class="text-gray-500">{{ col.label }}</span>
              <span class="text-gray-900 dark:text-gray-100 truncate">
                <slot :name="`cell-${col.key}`" :item="item">{{ formatDefaultCell(item, col.key) }}</slot>
              </span>
            </div>
          </div>
        </slot>
      </div>
    </template>
  </div>
</template>

<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] }, // [{ key, label, headerClass?, cellClass?, skeletonWidth? }]
  stickyHeader: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  skeletonCount: { type: Number, default: 6 },
  rowKeyField: { type: String, default: '' },
  mobileTitleField: { type: String, default: '' }
})

const rowKey = (item) => {
  if (props.rowKeyField && item && item[props.rowKeyField] != null) return item[props.rowKeyField]
  return JSON.stringify(item)
}

const mobileTitle = (item) => {
  if (props.mobileTitleField && item && item[props.mobileTitleField] != null) return item[props.mobileTitleField]
  return ''
}

const formatDefaultCell = (item, key) => {
  const val = item?.[key]
  return val == null ? '—' : val
}
</script>

<style scoped>
</style>


