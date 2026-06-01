<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-body space-y-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">🎯 {{ $t('achievements.title') }}</h1>
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

        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('achievements.todayLabel', { date: todayLabel }) }}
          <span v-if="scope === 'company' && accountCount" class="text-indigo-600 dark:text-indigo-400">
            · {{ $t('achievements.locationCount', { count: accountCount }) }}
          </span>
        </p>
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
      <!-- Today -->
      <section>
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
          {{ $t('achievements.todayGroup') }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MilestoneTrack
            v-for="track in dailyTracks"
            :key="track.id"
            :track="track"
            :title="trackTitle(track)"
            :symbol="currencySymbol"
          />
        </div>
      </section>

      <!-- This month -->
      <section>
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
          {{ $t('achievements.monthGroup') }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MilestoneTrack
            v-for="track in monthlyTracks"
            :key="track.id"
            :track="track"
            :title="trackTitle(track)"
            :symbol="currencySymbol"
          />
        </div>
      </section>

      <!-- Team milestones (company view only) -->
      <section v-if="scope === 'company' && teamResults.length">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
          {{ $t('achievements.teamTitle') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="item in teamResults"
            :key="item.id"
            class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            :class="item.unlocked
              ? 'border-green-300 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500'"
          >
            <span>{{ item.icon }}</span>
            <span class="font-medium">{{ $t(`achievements.goals.${item.id}.title`) }}</span>
            <span class="text-xs">{{ item.unlocked ? '✓' : $t('achievements.teamPending') }}</span>
          </div>
        </div>
      </section>

      <div v-if="scope === 'account' && !accounts.length" class="card">
        <div class="card-body py-10 text-center text-gray-500">
          {{ $t('achievements.noGoals') }}
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
import MilestoneTrack from '../components/MilestoneTrack.vue'
import {
  ACHIEVEMENT_DEFINITIONS,
  buildMilestoneTracks,
  buildAchievementResults,
  filterRowsByDate,
  countDaysWithData
} from '../composables/useAchievements'

const { t } = useI18n()
const auth = useAuthStore()

const TEAM_DEFS = ACHIEVEMENT_DEFINITIONS.filter((d) => d.teamType)

const loading = ref(false)
const scope = ref('company')
const selectedToken = ref('')
const accounts = ref([])
const companyMonthRows = ref([])
const accountMonthRows = ref([])
const allAccountMonthRows = ref([])

// Always the current month — no browsing past months.
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

const currencySymbol = computed(() => auth.user?.currencySymbol || 'S/')

const todayStr = computed(() => {
  const tz = auth.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
})

const todayLabel = computed(() => {
  const tz = auth.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString(auth.user?.language || 'en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  })
})

const accountTokens = computed(() => accounts.value.map((acc) => acc.company_token).filter(Boolean))
const accountCount = computed(() => accountTokens.value.length)

const monthRows = computed(() => (scope.value === 'company' ? companyMonthRows.value : accountMonthRows.value))
const todayRows = computed(() => filterRowsByDate(monthRows.value, todayStr.value))

const trackContext = computed(() => ({
  todayRows: todayRows.value,
  monthRows: monthRows.value,
  monthlyRows: monthRows.value,
  accountCount: accountCount.value,
  daysWithData: countDaysWithData(monthRows.value),
  companyDaysWithData: countDaysWithData(companyMonthRows.value)
}))

const tracks = computed(() => buildMilestoneTracks(scope.value, trackContext.value))
const dailyTracks = computed(() => tracks.value.filter((trk) => trk.period === 'daily'))
const monthlyTracks = computed(() => tracks.value.filter((trk) => trk.period === 'monthly'))

const teamResults = computed(() => {
  const perAccountToday = filterRowsByDate(allAccountMonthRows.value, todayStr.value)
  const context = {
    dailyRows: [],
    monthlyRows: [],
    perAccountToday,
    perAccountMonth: allAccountMonthRows.value,
    accountTokens: accountTokens.value
  }
  return buildAchievementResults(TEAM_DEFS, context)
})

function trackTitle(track) {
  return track.category === 'sales' ? t('achievements.currentSales') : t('achievements.currentProfit')
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
      api.getDailyGains(monthKey),
      ...accounts.value.map((acc) => api.getDailyGains(monthKey, acc.company_token))
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
  if (token && token !== prev) {
    const idx = accounts.value.findIndex((a) => a.company_token === token)
    accountMonthRows.value = allAccountMonthRows.value.filter((r) => r.company_token === token)
    // Fall back to a fresh fetch if we have no cached rows yet.
    if (idx >= 0 && !accountMonthRows.value.length) loadData()
  }
})

onMounted(async () => {
  await loadAccounts()
  await loadData()
})
</script>
