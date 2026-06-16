<template>
  <!-- Desktop/tablet table -->
  <div class="hidden md:block">
    <div class="overflow-x-auto">
      <table class="min-w-full w-full text-sm">
        <thead :class="stickyHeader ? 'sticky top-0 z-10' : ''" style="background: var(--surface-1);">
          <tr class="text-left" style="color: var(--fg3);">
            <th v-for="col in columns" :key="col.key" class="py-3 px-2" :class="col.headerClass">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="n in skeletonCount" :key="`sk-${n}`" class="animate-pulse" style="border-top: 1px solid var(--border);">
              <td v-for="col in columns" :key="col.key" class="py-2">
                <div class="h-3 rounded" style="background: var(--surface-2);" :class="col.skeletonWidth || 'w-24'"></div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="item in items" :key="rowKey(item)" class="transition-colors duration-150 hover:bg-surface-2" style="border-top: 1px solid var(--border);">
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
      <div v-for="n in skeletonCount" :key="`skm-${n}`" class="p-3 animate-pulse" style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md);">
        <div class="h-4 rounded w-32 mb-2" style="background: var(--surface-2);"></div>
        <div class="space-y-2">
          <div v-for="m in 3" :key="m" class="h-3 rounded" style="background: var(--surface-2);"></div>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="item in items" :key="rowKey(item)" class="p-3" style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md);">
        <slot name="mobile-card" :item="item">
          <div class="font-medium mb-2" style="color: var(--fg1);">{{ mobileTitle(item) }}</div>
          <div class="space-y-1 text-xs">
            <div v-for="col in columns" :key="col.key" class="flex justify-between gap-2">
              <span style="color: var(--fg3);">{{ col.label }}</span>
              <span class="truncate" style="color: var(--fg1);">
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


