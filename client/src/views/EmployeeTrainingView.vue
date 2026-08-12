<template>
  <div class="container mx-auto px-4 py-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-fg-strong">{{ $t('training.employee.title') }}</h1>
        <p class="text-fg-muted mt-1">{{ $t('training.employee.subtitle') }}</p>
      </div>
      <button class="btn-secondary" :disabled="loading" @click="load">
        {{ $t('common.refresh') }}
      </button>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card">
        <div class="card-body">
          <p class="text-sm text-fg-muted">{{ $t('training.employee.totalSubmitted') }}</p>
          <p class="text-2xl font-bold text-fg-strong">{{ submissions.length }}</p>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <p class="text-sm text-fg-muted">{{ $t('training.employee.awaitingFeedback') }}</p>
          <p class="text-2xl font-bold text-fg-strong">{{ pendingCount }}</p>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <p class="text-sm text-fg-muted">{{ $t('training.employee.markedGood') }}</p>
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ goodCount }}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="text-lg font-semibold text-fg-strong">{{ $t('training.employee.myEvidences') }}</h2>
      </div>
      <div class="card-body">
        <div v-if="loading" class="space-y-4">
          <div v-for="n in 3" :key="n" class="h-24 rounded-lg animate-pulse" style="background: var(--surface-2);"></div>
        </div>

        <div v-else-if="submissions.length === 0" class="text-center py-10">
          <MaterialIcon name="school" :size="40" class="text-fg-muted" />
          <h3 class="text-lg font-medium text-fg-strong mt-3">{{ $t('training.employee.emptyTitle') }}</h3>
          <p class="text-fg-muted text-sm mt-1">{{ $t('training.employee.emptyBody') }}</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="s in submissions"
            :key="s.id"
            class="border rounded-lg p-4"
            style="border-color: var(--border);"
          >
            <div class="flex justify-between items-start gap-3 mb-3">
              <div class="min-w-0">
                <h3 class="font-semibold text-fg-strong">{{ s.template_title }}</h3>
                <p class="text-xs text-fg-muted mt-0.5">{{ formatDate(s.created_at) }}</p>
              </div>
              <span class="badge flex-shrink-0" :class="statusClass(s)">{{ statusLabel(s) }}</span>
            </div>

            <div v-if="s.photos?.length" class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              <TrainingPhoto
                v-for="p in s.photos"
                :key="p.id"
                :photo-id="p.id"
                :alt="s.template_title"
                @open="lightbox = $event"
              />
            </div>

            <ul v-if="s.checkpoint_results?.length" class="space-y-1 mb-3">
              <li
                v-for="(c, index) in s.checkpoint_results"
                :key="index"
                class="flex items-start gap-2 text-sm"
              >
                <MaterialIcon
                  :name="c.checked ? 'check_circle' : 'radio_button_unchecked'"
                  :size="16"
                  :class="c.checked ? 'text-green-600 dark:text-green-400 mt-0.5' : 'text-fg-muted mt-0.5'"
                />
                <span class="text-fg">{{ c.label }}</span>
              </li>
            </ul>

            <div v-if="s.note" class="rounded-md p-3 mb-3 text-sm" style="background: var(--surface-2);">
              <span class="text-fg-muted">{{ $t('training.employee.yourNote') }}:</span>
              <span class="text-fg ml-1">{{ s.note }}</span>
            </div>

            <!-- Manager feedback: the reason the module exists -->
            <div
              v-if="s.status === 'reviewed'"
              class="rounded-md p-3 border"
              :class="s.review_rating === 'good'
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'"
            >
              <div class="flex items-center gap-2 mb-1">
                <MaterialIcon :name="s.review_rating === 'good' ? 'thumb_up' : 'lightbulb'" :size="16" />
                <span class="text-sm font-semibold text-fg-strong">
                  {{ s.review_rating === 'good' ? $t('training.rating.good') : $t('training.rating.needsImprovement') }}
                </span>
              </div>
              <p v-if="s.review_comment" class="text-sm text-fg">{{ s.review_comment }}</p>
              <p class="text-xs text-fg-muted mt-2">
                {{ s.reviewer_name || $t('training.employee.yourManager') }} · {{ formatDate(s.reviewed_at) }}
              </p>
            </div>
            <p v-else class="text-sm text-fg-muted">{{ $t('training.employee.awaitingReview') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo lightbox -->
    <div
      v-if="lightbox"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: var(--scrim);"
      @click="lightbox = ''"
    >
      <img :src="lightbox" class="max-h-full max-w-full rounded-lg" :alt="$t('training.employee.myEvidences')" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import TrainingPhoto from '../components/TrainingPhoto.vue'
import MaterialIcon from '../components/ui/MaterialIcon.vue'

const { t } = useI18n()

const submissions = ref([])
const loading = ref(false)
const lightbox = ref('')

const pendingCount = computed(() => submissions.value.filter(s => s.status !== 'reviewed').length)
const goodCount = computed(() => submissions.value.filter(s => s.review_rating === 'good').length)

const load = async () => {
  loading.value = true
  try {
    const res = await api.getMyTrainingSubmissions()
    submissions.value = res?.data || []
  } catch (e) {
    window.showNotification?.({
      type: 'error',
      title: t('common.error'),
      message: e.data?.error || t('training.employee.failedToLoad')
    })
  } finally {
    loading.value = false
  }
}

const statusLabel = (s) => {
  if (s.status !== 'reviewed') return t('training.status.pendingReview')
  return s.review_rating === 'good' ? t('training.rating.good') : t('training.rating.needsImprovement')
}

const statusClass = (s) => {
  if (s.status !== 'reviewed') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return s.review_rating === 'good'
    ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300'
}

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

onMounted(load)
</script>

<style scoped>
.badge {
  @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
}
</style>
