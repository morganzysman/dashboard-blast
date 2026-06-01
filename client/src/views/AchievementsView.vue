<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-body space-y-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">🎉 {{ $t('achievements.title') }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ $t('achievements.subtitle') }}</p>
          <p v-if="period === 'daily'" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ $t('achievements.todayLabel', { date: todayLabel }) }}
          </p>
          <p v-if="scope === 'company' && accountCount" class="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {{ $t('achievements.locationCount', { count: accountCount }) }}
          </p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <!-- Period toggle -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('achievements.period') }}</label>
            <div class="inline-flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                type="button"
                class="px-3 py-1.5 text-sm transition-colors"
                :class="period === 'daily' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'"
                @click="period = 'daily'"
              >
                {{ $t('achievements.daily') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm border-l border-gray-200 dark:border-gray-600 transition-colors"
                :class="period === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'"
                @click="period = 'monthly'"
              >
                {{ $t('achievements.monthly') }}
              </button>
            </div>
          </div>

          <!-- Scope toggle -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('achievements.scope') }}</label>
            <div class="inline-flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                type="button"
                class="px-3 py-1.5 text-sm transition-colors"
                :class="scope === 'company' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'"
                @click="scope = 'company'"
              >
                {{ $t('achievements.company') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm border-l border-gray-200 dark:border-gray-600 transition-colors"
                :class="scope === 'account' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'"
                @click="scope = 'account'"
              >
                {{ $t('achievements.account') }}
              </button>
            </div>
          </div>

          <!-- Account picker (per-account scope) -->
          <div v-if="scope === 'account'">
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('rentability.account') }}</label>
            <select v-model="selectedToken" class="form-input min-w-[180px]" @change="loadData">
              <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
                {{ acc.account_name || acc.company_token }}
              </option>
            </select>
          </div>

          <!-- Month nav (monthly period) -->
          <div v-if="period === 'monthly'" class="flex items-center gap-2">
            <button class="btn-secondary btn-sm" @click="prevMonth">{{ $t('common.previous') }}</button>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-center">{{ monthLabel }}</span>
            <button class="btn-secondary btn-sm" @click="nextMonth">{{ $t('common.next') }}</button>
          </div>

          <button class="btn-secondary btn-sm ml-auto" :disabled="loading" @click="loadData">
            {{ loading ? $t('common.loading') : $t('common.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="card">
        <div class="card-body py-3">
          <p class="text-xs text-gray-500">{{ $t('achievements.unlockedCount') }}</p>
          <p class="text-2xl font-bold text-green-600">{{ unlockedCount }}<span class="text-sm text-gray-400 font-normal">/{{ visibleAchievements.length }}</span></p>
        </div>
      </div>
      <div class="card">
        <div class="card-body py-3">
          <p class="text-xs text-gray-500">{{ $t('achievements.currentSales') }}</p>
          <p class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ formatCurrency(metrics.gross_revenue) }}</p>
        </div>
      </div>
      <div class="card">
        <div class="card-body py-3">
          <p class="text-xs text-gray-500">{{ $t('achievements.currentProfit') }}</p>
          <p class="text-lg font-bold tabular-nums" :class="metrics.net_gain >= 0 ? 'text-green-600' : 'text-red-600'">{{ formatCurrency(metrics.net_gain) }}</p>
        </div>
      </div>
      <div class="card">
        <div class="card-body py-3">
          <p class="text-xs text-gray-500">{{ $t('achievements.currentOrders') }}</p>
          <p class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ metrics.orders_count }}</p>
        </div>
      </div>
    </div>

    <!-- Celebration banner when all visible goals unlocked -->
    <div
      v-if="!loading && visibleAchievements.length && unlockedCount === visibleAchievements.length"
      class="card border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
    >
      <div class="card-body text-center py-6">
        <div class="text-4xl mb-2">🎊</div>
        <h2 class="text-lg font-bold text-green-800 dark:text-green-300">{{ $t('achievements.allUnlockedTitle') }}</h2>
        <p class="text-sm text-green-700 dark:text-green-400 mt-1">{{ $t('achievements.allUnlockedSubtitle') }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card">
      <div class="card-body py-12 text-center text-gray-500">
        <span class="loading-spinner inline-block mr-2"></span>
        {{ $t('common.loading') }}
      </div>
    </div>

    <!-- Category sections -->
    <template v-else>
      <section v-for="cat in categoriesWithItems" :key="cat" class="card">
        <div class="card-body">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {{ categoryIcon(cat) }} {{ $t(`achievements.categories.${cat}`) }}
          </h2>
          <p class="text-xs text-gray-500 mb-4">{{ $t(`achievements.categoriesDesc.${cat}`) }}</p>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <AchievementBadge
              v-for="item in itemsByCategory[cat]"
              :key="item.id"
              :icon="item.icon"
              :title="$t(`achievements.goals.${item.id}.title`)"
              :description="$t(`achievements.goals.${item.id}.desc`)"
              :unlocked="item.unlocked"
              :tier-class="tierClass(item.tier)"
              :current="item.current"
              :target="item.target"
              :progress="item.progress"
              :progress-label="formatProgress(item)"
              :progress-tooltip="formatProgress(item)"
              :unlocked-label="item.unlocked ? $t('achievements.celebration') : ''"
            />
          </div>
        </div>
      </section>

      <div v-if="!visibleAchievements.length" class="card">
        <div class="card-body py-10 text-center text-gray-500">
          {{ $t('achievements.noGoals') }}
        </div>
      </div>
    </template>

    <!-- Goal catalog reference -->
    <div class="card">
      <div class="card-body">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">📋 {{ $t('achievements.catalogTitle') }}</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ $t('achievements.catalogSubtitle') }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-xs sm:text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <th class="text-left px-3 py-2">{{ $t('achievements.catalogScope') }}</th>
                <th class="text-left px-3 py-2">{{ $t('achievements.catalogPeriod') }}</th>
                <th class="text-left px-3 py-2">{{ $t('common.category') }}</th>
                <th class="text-left px-3 py-2">{{ $t('achievements.catalogGoal') }}</th>
                <th class="text-left px-3 py-2">{{ $t('achievements.catalogTarget') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="def in catalogRows"
                :key="def.id"
                class="border-t border-gray-100 dark:border-gray-700"
              >
                <td class="px-3 py-2">{{ $t(`achievements.scopes.${def.scope}`) }}</td>
                <td class="px-3 py-2">{{ $t(`achievements.periods.${def.period}`) }}</td>
                <td class="px-3 py-2">{{ $t(`achievements.categories.${def.category}`) }}</td>
                <td class="px-3 py-2">{{ def.icon }} {{ $t(`achievements.goals.${def.id}.title`) }}</td>
                <td class="px-3 py-2 tabular-nums">{{ catalogTargetLabel(def) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api.js'
import AchievementBadge from '../components/AchievementBadge.vue'
import {
  ACHIEVEMENT_DEFINITIONS,
  buildAchievementResults,
  filterRowsByDate,
  sumMetrics,
  countDaysWithData,
  tierClass,
  COMPANY_DAILY_GAIN_GOAL,
  COMPANY_DAILY_GAIN_STRETCH,
  scaledByLocationCount
} from '../composables/useAchievements'
import { DAILY_GAIN_OBJECTIVE } from '../composables/useProfitability'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(false)
const period = ref('daily')
const scope = ref('company')
const selectedToken = ref('')
const accounts = ref([])
const companyMonthRows = ref([])
const accountMonthRows = ref([])
const allAccountMonthRows = ref([])

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const monthKey = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`)

const todayStr = computed(() => {
  const tz = auth.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
})

const monthLabel = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value - 1, 1)
  const tz = auth.user?.timezone || 'America/Lima'
  return date.toLocaleDateString(auth.user?.language || 'en', { month: 'long', year: 'numeric', timeZone: tz })
})

const todayLabel = computed(() => {
  const tz = auth.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString(auth.user?.language || 'en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz
  })
})

const activeRows = computed(() => {
  if (period.value === 'daily') {
    const source = scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value
    return filterRowsByDate(source, todayStr.value)
  }
  return scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value
})

const metrics = computed(() => sumMetrics(activeRows.value))

const accountTokens = computed(() => accounts.value.map((acc) => acc.company_token).filter(Boolean))
const accountCount = computed(() => accountTokens.value.length)

const evaluationContext = computed(() => {
  const perAccountToday = filterRowsByDate(allAccountMonthRows.value, todayStr.value)
  const tokens = accountTokens.value
  const daysWithData = countDaysWithData(scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value)

  return {
    dailyRows: period.value === 'daily' ? activeRows.value : filterRowsByDate(scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value, todayStr.value),
    monthlyRows: scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value,
    accountCount: tokens.length,
    accountTokens: tokens,
    daysWithData,
    companyDaysWithData: countDaysWithData(companyMonthRows.value),
    perAccountToday,
    perAccountMonth: allAccountMonthRows.value,
    allProfitableToday:
      tokens.length > 0 &&
      tokens.every((token) => perAccountToday.some((r) => r.company_token === token)) &&
      perAccountToday.every((r) => parseFloat(r.net_gain) > 0)
  }
})

const visibleDefinitions = computed(() =>
  ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === scope.value && d.period === period.value)
)

const visibleAchievements = computed(() => buildAchievementResults(visibleDefinitions.value, evaluationContext.value))

const unlockedCount = computed(() => visibleAchievements.value.filter((a) => a.unlocked).length)

const itemsByCategory = computed(() => {
  const map = {}
  for (const item of visibleAchievements.value) {
    if (!map[item.category]) map[item.category] = []
    map[item.category].push(item)
  }
  return map
})

const categoriesWithItems = computed(() => Object.keys(itemsByCategory.value))

const catalogRows = computed(() => [...ACHIEVEMENT_DEFINITIONS])

function categoryIcon(cat) {
  const icons = { sales: '💵', profit: '📈', orders: '📦', streak: '🔗', team: '🤝' }
  return icons[cat] || '🏆'
}

function formatCurrency(n) {
  const symbol = auth.user?.currencySymbol || 'S/'
  const val = parseFloat(n)
  if (!Number.isFinite(val)) return `${symbol} 0.00`
  if (val < 0) return `-${symbol} ${Math.abs(val).toFixed(2)}`
  return `${symbol} ${val.toFixed(2)}`
}

function formatProgress(item) {
  if (item.metricLabel === 'streak') {
    return t('achievements.streakProgress', { current: item.current, target: item.target })
  }
  if (item.metricLabel === 'team') {
    return item.unlocked ? t('achievements.teamComplete') : t('achievements.teamPending')
  }
  if (item.metric === 'orders_count') {
    return `${item.current} / ${item.target} ${t('achievements.orders')}`
  }
  return `${formatCurrency(item.current)} / ${formatCurrency(item.target)}`
}

function catalogTargetLabel(def) {
  if (def.streakType) {
    return t('achievements.streakDays', { count: def.streakLength })
  }
  if (def.teamType === 'all_profitable') return t('achievements.teamAllProfitable')
  if (def.teamType === 'all_hit_objective_day') return t('achievements.teamAllGoalDay')
  if (def.targetKey === 'monthly_gain_objective') {
    return t('achievements.dynamicMonthlyObjective', { daily: formatCurrency(DAILY_GAIN_OBJECTIVE) })
  }
  if (def.targetKey === 'company_per_location') {
    return t('achievements.scaledPerLocation', {
      perLocation: formatCurrency(def.targetPerLocation),
      count: accountCount.value || 1,
      total: formatCurrency(scaledByLocationCount(def.targetPerLocation, accountCount.value))
    })
  }
  if (def.targetKey === 'company_monthly_gain_floor') return formatCurrency(15000)
  if (def.targetKey === 'company_monthly_gain_mid') return formatCurrency(30000)
  if (def.targetKey === 'company_monthly_gain_objective') {
    return t('achievements.dynamicCompanyMonthlyGain', { daily: formatCurrency(COMPANY_DAILY_GAIN_GOAL) })
  }
  if (def.id === 'co-d-profit-goal') return formatCurrency(COMPANY_DAILY_GAIN_GOAL)
  if (def.id === 'co-d-profit-stretch') return formatCurrency(COMPANY_DAILY_GAIN_STRETCH)
  if (def.metric === 'orders_count') return `${def.target} ${t('achievements.orders')}`
  return formatCurrency(def.target)
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadData()
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadData()
}

async function loadAccounts() {
  const companyId = auth.user?.company_id
  if (!companyId) return
  const res = await api.listCompanyAccounts(companyId)
  accounts.value = res.accounts || res.data || res || []
  if (accounts.value.length && !selectedToken.value) {
    selectedToken.value = accounts.value[0].company_token
  }
}

async function loadData() {
  loading.value = true
  try {
    const [companyRes, ...accountResults] = await Promise.all([
      api.getDailyGains(monthKey.value),
      ...accounts.value.map((acc) => api.getDailyGains(monthKey.value, acc.company_token))
    ])
    companyMonthRows.value = companyRes.data || []

    const tagged = []
    accountResults.forEach((res, i) => {
      const token = accounts.value[i]?.company_token
      for (const row of res.data || []) {
        tagged.push({ ...row, company_token: token })
      }
    })
    allAccountMonthRows.value = tagged

    if (selectedToken.value) {
      const idx = accounts.value.findIndex((a) => a.company_token === selectedToken.value)
      accountMonthRows.value = accountResults[idx]?.data || []
    }
  } catch (err) {
    console.error('Failed to load achievement data:', err)
    companyMonthRows.value = []
    accountMonthRows.value = []
    allAccountMonthRows.value = []
  } finally {
    loading.value = false
  }
}

watch(selectedToken, (token, prev) => {
  if (token && token !== prev) loadData()
})

onMounted(async () => {
  await loadAccounts()
  await loadData()
})
</script>
