<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-body space-y-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ $t('achievements.title') }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ $t('achievements.subtitle') }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- View toggle: Company vs Per location -->
          <div class="inline-flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              type="button"
              class="px-4 py-1.5 text-sm transition-colors"
              :class="scope === 'company' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
              @click="scope = 'company'"
            >
              {{ $t('achievements.company') }}
            </button>
            <button
              type="button"
              class="px-4 py-1.5 text-sm border-l border-gray-200 dark:border-gray-600 transition-colors"
              :class="scope === 'account' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
              @click="scope = 'account'"
            >
              {{ $t('achievements.account') }}
            </button>
          </div>

          <!-- Account picker (per-location view) -->
          <select
            v-if="scope === 'account'"
            v-model="selectedToken"
            class="form-input min-w-[180px]"
          >
            <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
              {{ acc.account_name || acc.company_token }}
            </option>
          </select>

          <button class="btn-secondary btn-sm ml-auto" :disabled="loading" @click="loadData">
            {{ loading ? $t('common.loading') : $t('common.refresh') }}
          </button>
        </div>

        <!-- Progress summary -->
        <div v-if="!loading && badges.length" class="space-y-1.5">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 dark:text-gray-400">
              {{ $t('achievements.earnedOfTotal', { earned: earnedCount, total: badges.length }) }}
            </span>
            <span class="text-xs text-gray-400">{{ $t('achievements.updatedDaily') }}</span>
          </div>
          <div class="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div class="h-full rounded-full bg-green-500 transition-all" :style="{ width: overallPct + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card">
      <div class="card-body py-12 text-center text-gray-500">
        <span class="loading-spinner inline-block mr-2"></span>
        {{ $t('common.loading') }}
      </div>
    </div>

    <template v-else>
      <div v-if="!badges.length" class="card">
        <div class="card-body py-10 text-center text-gray-500">
          {{ $t('achievements.noGoals') }}
        </div>
      </div>

      <!-- Single mixed badge list: earned surfaced first, then upcoming -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="badge in sortedBadges"
          :key="badge.id"
          class="relative rounded-xl border p-4 flex gap-3 transition-colors"
          :class="badge.unlocked
            ? 'border-l-4 ' + tierBorder(badge.tier) + ' bg-white dark:bg-gray-800'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40'"
        >
          <div
            class="leading-none flex-shrink-0 select-none"
            :class="badge.unlocked ? tierIconColor(badge.tier) : 'text-gray-300 dark:text-gray-600 opacity-60'"
          >
            <span class="material-symbols-rounded" style="font-size: 32px;">{{ achievementSymbol(badge.icon) }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                {{ badgeValue(badge) }}
              </p>
              <span v-if="badge.unlocked" class="text-green-600 dark:text-green-400 text-sm flex-shrink-0">✓</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ badgeLabel(badge) }}</p>

            <!-- Earned -->
            <p v-if="badge.unlocked" class="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
              {{ $t('achievements.earnedOn', { date: formatDate(badge.unlockedAt) }) }}
              <span v-if="badge.timesEarned > 1" class="text-gray-400 dark:text-gray-500 font-normal">· ×{{ badge.timesEarned }}</span>
            </p>

            <!-- Upcoming with progress hint -->
            <div v-else class="mt-2">
              <template v-if="badge.target != null">
                <div class="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div class="h-full rounded-full bg-indigo-400" :style="{ width: (badge.progress || 0) + '%' }"></div>
                </div>
                <p class="text-[11px] text-gray-400 mt-1">{{ progressHint(badge) }}</p>
              </template>
              <p v-else class="text-[11px] text-gray-400">{{ $t('achievements.locked') }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api.js'
import { achievementSymbol } from '../utils/achievementIcons.js'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(false)
const scope = ref('company')
const selectedToken = ref('')
const accounts = ref([])
const badges = ref([])

const currencySymbol = computed(() => auth.user?.currencySymbol || 'S/')
const lang = computed(() => auth.user?.language || 'en')

const earnedCount = computed(() => badges.value.filter((b) => b.unlocked).length)
const overallPct = computed(() => (badges.value.length ? Math.round((earnedCount.value / badges.value.length) * 100) : 0))

// Earned first (most recent on top), then upcoming sorted by closeness.
const sortedBadges = computed(() => {
  const earned = badges.value
    .filter((b) => b.unlocked)
    .sort((a, b) => new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0))
  const upcoming = badges.value
    .filter((b) => !b.unlocked)
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
  return [...earned, ...upcoming]
})

function formatMoney(n) {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toLocaleString('en-US')
  return v < 0 ? `-${currencySymbol.value} ${s}` : `${currencySymbol.value} ${s}`
}

function formatDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString(lang.value, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// Headline value shown big on the badge.
function badgeValue(badge) {
  if (badge.teamType) return t('achievements.teamValue')
  if (badge.streakType) return t('achievements.daysValue', { n: badge.streakLength })
  if (badge.category === 'orders') return t('achievements.ordersValue', { n: badge.target })
  if (badge.category === 'profit' && badge.target != null && badge.target <= 1) return t('achievements.profitable')
  return formatMoney(badge.target)
}

// Sub-label describing the kind of goal.
function badgeLabel(badge) {
  if (badge.teamType === 'all_profitable') return t('achievements.label.teamProfitable')
  if (badge.teamType === 'all_hit_objective_day') return t('achievements.label.teamObjective')
  if (badge.streakType === 'profitable_days') return t('achievements.label.streakProfit')
  if (badge.streakType === 'objective_days') return t('achievements.label.streakObjective')
  const key = `${badge.period}${badge.category.charAt(0).toUpperCase()}${badge.category.slice(1)}`
  return t(`achievements.label.${key}`)
}

function progressHint(badge) {
  if (badge.target == null) return ''
  if (badge.category === 'orders') {
    return `${Math.round(badge.current || 0)} / ${Math.round(badge.target)}`
  }
  return `${formatMoney(badge.current)} / ${formatMoney(badge.target)}`
}

function tierIconColor(tier) {
  const map = {
    bronze: 'text-amber-600 dark:text-amber-400',
    silver: 'text-slate-500 dark:text-slate-300',
    gold: 'text-yellow-500 dark:text-yellow-400',
    platinum: 'text-indigo-500 dark:text-indigo-400'
  }
  return map[tier] || 'text-green-600 dark:text-green-400'
}

function tierBorder(tier) {
  const map = {
    bronze: 'border-l-amber-500',
    silver: 'border-l-slate-400',
    gold: 'border-l-yellow-400',
    platinum: 'border-l-indigo-500'
  }
  return map[tier] || 'border-l-green-500'
}

async function loadAccounts() {
  const companyId = auth.user?.company_id
  if (!companyId) return
  try {
    const res = await api.listCompanyAccounts(companyId)
    accounts.value = res.accounts || res.data || res || []
    if (accounts.value.length && !selectedToken.value) {
      selectedToken.value = accounts.value[0].company_token
    }
  } catch (err) {
    console.error('Failed to load accounts:', err)
  }
}

async function loadData() {
  loading.value = true
  try {
    const token = scope.value === 'account' ? selectedToken.value : null
    if (scope.value === 'account' && !token) {
      badges.value = []
      return
    }
    const res = await api.getAchievements(scope.value, token)
    badges.value = res.data || []
  } catch (err) {
    console.error('Failed to load achievements:', err)
    badges.value = []
  } finally {
    loading.value = false
  }
}

watch(scope, () => { loadData() })
watch(selectedToken, (token, prev) => {
  if (scope.value === 'account' && token && token !== prev) loadData()
})

onMounted(async () => {
  await loadAccounts()
  await loadData()
})
</script>
