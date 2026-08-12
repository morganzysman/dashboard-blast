<template>
  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-fg-strong">{{ $t('training.manage.title') }}</h1>
      <p class="text-fg-muted mt-1">{{ $t('training.manage.subtitle') }}</p>
    </div>

    <!-- Tabs. The Spanish labels are far too wide for a phone, so the bar scrolls
         sideways instead of wrapping each label into a three-line stack. -->
    <div class="flex gap-2 mb-6 border-b overflow-x-auto tab-bar" style="border-color: var(--border);">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
        :class="activeTab === tab.key
          ? 'border-brand-600 text-fg-strong'
          : 'border-transparent text-fg-muted hover:text-fg'"
        @click="activeTab = tab.key"
      >
        {{ $t(tab.label) }}
        <span v-if="tab.key === 'review' && pendingCount" class="ml-1 badge bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
          {{ pendingCount }}
        </span>
      </button>
    </div>

    <!-- ================= REVIEW QUEUE ================= -->
    <div v-if="activeTab === 'review'">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <label class="flex items-center gap-2 text-sm text-fg min-w-0">
          <input type="checkbox" class="flex-shrink-0" v-model="onlyPending" @change="loadSubmissions" />
          {{ $t('training.manage.onlyPending') }}
        </label>
        <button class="btn-secondary btn-sm flex-shrink-0" :disabled="loadingSubmissions" @click="loadSubmissions">
          {{ $t('common.refresh') }}
        </button>
      </div>

      <div v-if="loadingSubmissions" class="space-y-4">
        <div v-for="n in 3" :key="n" class="h-32 rounded-lg animate-pulse" style="background: var(--surface-2);"></div>
      </div>

      <div v-else-if="submissions.length === 0" class="card">
        <div class="card-body text-center py-10">
          <MaterialIcon name="inbox" :size="40" class="text-fg-muted" />
          <h3 class="text-lg font-medium text-fg-strong mt-3">{{ $t('training.manage.noSubmissions') }}</h3>
          <p class="text-fg-muted text-sm mt-1">{{ $t('training.manage.noSubmissionsBody') }}</p>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div v-for="s in submissions" :key="s.id" class="card">
          <div class="card-body">
            <!-- Badge under the title on a phone: side by side it leaves the title
                 about 80px of column. -->
            <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
              <div class="min-w-0">
                <h3 class="font-semibold text-fg-strong break-words">{{ s.template_title }}</h3>
                <p class="text-sm text-fg-muted break-words">
                  {{ s.user_name }}
                  <span v-if="s.job_type"> · {{ $t(`admin.jobType${s.job_type === 'kitchen' ? 'Kitchen' : 'Waiter'}`) }}</span>
                  <span v-if="s.account_name"> · {{ s.account_name }}</span>
                </p>
                <p class="text-xs text-fg-muted mt-0.5">{{ formatDate(s.created_at) }}</p>
              </div>
              <span class="badge self-start flex-shrink-0" :class="statusClass(s)">{{ statusLabel(s) }}</span>
            </div>

            <div v-if="s.photos?.length" class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              <TrainingPhoto
                v-for="p in s.photos"
                :key="p.id"
                :photo-id="p.id"
                :alt="s.template_title"
                wrapper-class="h-28"
                @open="lightbox = $event"
              />
            </div>

            <!-- Self-check answers: unchecked items are the coaching openings -->
            <ul v-if="s.checkpoint_results?.length" class="space-y-1 mb-3">
              <li v-for="(c, index) in s.checkpoint_results" :key="index" class="text-sm">
                <div class="flex items-start gap-2">
                  <MaterialIcon
                    :name="c.checked ? 'check_circle' : 'cancel'"
                    :size="16"
                    :class="c.checked ? 'text-green-600 dark:text-green-400 mt-0.5' : 'text-yellow-600 dark:text-yellow-400 mt-0.5'"
                  />
                  <span class="text-fg">{{ c.label }}</span>
                </div>
                <p v-if="c.hint" class="text-xs text-fg-muted ml-6">{{ c.hint }}</p>
              </li>
            </ul>

            <div v-if="s.note" class="rounded-md p-3 mb-3 text-sm" style="background: var(--surface-2);">
              <span class="text-fg-muted">{{ $t('training.manage.employeeNote') }}:</span>
              <span class="text-fg ml-1">{{ s.note }}</span>
            </div>

            <!-- Existing feedback -->
            <div
              v-if="s.status === 'reviewed'"
              class="rounded-md p-3 border"
              :class="s.review_rating === 'good'
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'"
            >
              <div class="text-sm font-semibold text-fg-strong mb-1">
                {{ s.review_rating === 'good' ? $t('training.rating.good') : $t('training.rating.needsImprovement') }}
              </div>
              <p v-if="s.review_comment" class="text-sm text-fg">{{ s.review_comment }}</p>
              <p class="text-xs text-fg-muted mt-2">{{ s.reviewer_name }} · {{ formatDate(s.reviewed_at) }}</p>
            </div>

            <!-- Review form -->
            <div v-else class="border-t pt-3" style="border-color: var(--border);">
              <label class="form-label">{{ $t('training.manage.yourFeedback') }}</label>
              <textarea
                v-model="drafts[s.id]"
                rows="2"
                class="form-input mb-2"
                :placeholder="$t('training.manage.feedbackPlaceholder')"
              ></textarea>
              <div class="flex flex-wrap gap-2">
                <button
                  class="btn-primary btn-sm"
                  :disabled="reviewing === s.id"
                  @click="review(s, 'good')"
                >
                  <MaterialIcon name="thumb_up" :size="16" class="mr-1" />
                  {{ $t('training.manage.markGood') }}
                </button>
                <button
                  class="btn-secondary btn-sm"
                  :disabled="reviewing === s.id"
                  @click="review(s, 'needs_improvement')"
                >
                  <MaterialIcon name="lightbulb" :size="16" class="mr-1" />
                  {{ $t('training.manage.markNeedsImprovement') }}
                </button>
              </div>
              <p class="text-xs text-fg-muted mt-2">{{ $t('training.manage.commentRequiredHint') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= CATALOGUE ================= -->
    <div v-else-if="activeTab === 'catalogue'" class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-fg-muted">{{ $t('training.manage.catalogueHint') }}</p>
        <button class="btn-primary btn-sm w-full sm:w-auto flex-shrink-0 whitespace-nowrap" @click="startCreate">
          <MaterialIcon name="add" :size="16" class="mr-1" />
          {{ $t('training.manage.newEvidence') }}
        </button>
      </div>

      <!-- Editor -->
      <div v-if="editing" class="card">
        <div class="card-header">
          <h2 class="text-lg font-semibold text-fg-strong">
            {{ editing.id ? $t('training.manage.editEvidence') : $t('training.manage.newEvidence') }}
          </h2>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label class="form-label">{{ $t('training.manage.fieldTitle') }}</label>
            <input v-model="editing.title" class="form-input" :placeholder="$t('training.manage.titlePlaceholder')" />
          </div>
          <div>
            <label class="form-label">{{ $t('training.manage.fieldDescription') }}</label>
            <textarea
              v-model="editing.description"
              rows="2"
              class="form-input"
              :placeholder="$t('training.manage.descriptionPlaceholder')"
            ></textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="form-label">{{ $t('training.manage.fieldTargetRole') }}</label>
              <select v-model="editing.target_job_type" class="form-input">
                <option value="">{{ $t('training.manage.anyRole') }}</option>
                <option value="kitchen">{{ $t('admin.jobTypeKitchen') }}</option>
                <option value="waiter">{{ $t('admin.jobTypeWaiter') }}</option>
              </select>
            </div>
            <div>
              <label class="form-label">{{ $t('training.manage.fieldMinPhotos') }}</label>
              <select v-model.number="editing.min_photos" class="form-input">
                <option :value="0">{{ $t('training.manage.noPhoto') }}</option>
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="3">3</option>
              </select>
            </div>
            <div>
              <label class="form-label">
                {{ $t('training.manage.fieldWeight') }}
                <span class="text-xs text-fg-muted font-normal">({{ $t('training.manage.weightHint') }})</span>
              </label>
              <input v-model.number="editing.weight" type="number" min="1" max="10" class="form-input" />
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" v-model="editing.is_active" />
            {{ $t('training.manage.fieldActive') }}
          </label>

          <!-- Checkpoints -->
          <div>
            <label class="form-label">{{ $t('training.manage.checkpoints') }}</label>
            <p class="text-xs text-fg-muted mb-2">{{ $t('training.manage.checkpointsHint') }}</p>
            <div class="space-y-3">
              <div
                v-for="(c, index) in editing.checkpoints"
                :key="index"
                class="p-3 rounded-md space-y-2"
                style="background: var(--surface-2);"
              >
                <div class="flex items-start gap-2">
                  <input
                    v-model="c.label"
                    class="form-input flex-1"
                    :placeholder="$t('training.manage.checkpointLabelPlaceholder')"
                  />
                  <button
                    class="btn-secondary btn-sm flex-shrink-0"
                    :aria-label="$t('common.delete')"
                    @click="editing.checkpoints.splice(index, 1)"
                  >
                    <MaterialIcon name="delete" :size="16" />
                  </button>
                </div>
                <input
                  v-model="c.hint"
                  class="form-input"
                  :placeholder="$t('training.manage.checkpointHintPlaceholder')"
                />
              </div>
            </div>
            <button class="btn-secondary btn-sm mt-2" @click="editing.checkpoints.push({ label: '', hint: '' })">
              <MaterialIcon name="add" :size="16" class="mr-1" />
              {{ $t('training.manage.addCheckpoint') }}
            </button>
          </div>

          <div class="flex gap-2 pt-2">
            <button class="btn-primary" :disabled="savingTemplate || !editing.title" @click="saveTemplate">
              {{ savingTemplate ? $t('common.saving') : $t('common.save') }}
            </button>
            <button class="btn-secondary" :disabled="savingTemplate" @click="editing = null">
              {{ $t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Template list -->
      <div v-if="loadingTemplates" class="space-y-3">
        <div v-for="n in 3" :key="n" class="h-20 rounded-lg animate-pulse" style="background: var(--surface-2);"></div>
      </div>
      <div v-else-if="templates.length === 0" class="card">
        <div class="card-body text-center py-10">
          <MaterialIcon name="checklist" :size="40" class="text-fg-muted" />
          <h3 class="text-lg font-medium text-fg-strong mt-3">{{ $t('training.manage.noTemplates') }}</h3>
          <p class="text-fg-muted text-sm mt-1">{{ $t('training.manage.noTemplatesBody') }}</p>
        </div>
      </div>
      <div v-else class="space-y-3">
        <div v-for="tpl in templates" :key="tpl.id" class="card">
          <div class="card-body">
            <!-- Actions drop below the content on a phone so the checklist gets the
                 full width instead of wrapping around a button column. -->
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-semibold text-fg-strong break-words">{{ tpl.title }}</h3>
                  <span v-if="!tpl.is_active" class="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {{ $t('training.manage.inactive') }}
                  </span>
                  <span class="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {{ tpl.target_job_type
                      ? $t(`admin.jobType${tpl.target_job_type === 'kitchen' ? 'Kitchen' : 'Waiter'}`)
                      : $t('training.manage.anyRole') }}
                  </span>
                </div>
                <p v-if="tpl.description" class="text-sm text-fg-muted mt-1">{{ tpl.description }}</p>
                <ul v-if="tpl.checkpoints?.length" class="mt-2 space-y-0.5">
                  <li v-for="c in tpl.checkpoints" :key="c.id" class="text-sm text-fg flex items-start gap-2">
                    <span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style="background: var(--fg-muted);"></span>
                    <span>
                      {{ c.label }}
                      <span v-if="c.hint" class="text-fg-muted">— {{ c.hint }}</span>
                    </span>
                  </li>
                </ul>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button class="btn-secondary btn-sm" @click="startEdit(tpl)">
                  <MaterialIcon name="edit" :size="16" />
                </button>
                <button class="btn-danger btn-sm" @click="removeTemplate(tpl)">
                  <MaterialIcon name="delete" :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= SETTINGS ================= -->
    <div v-else-if="activeTab === 'settings'" class="card max-w-xl">
      <div class="card-body space-y-5">
        <div>
          <label class="form-label">
            {{ $t('training.manage.promptFrequency') }}
            <span class="data ml-1">{{ Math.round(settings.prompt_probability * 100) }}%</span>
          </label>
          <input
            v-model.number="probabilityPercent"
            type="range"
            min="0"
            max="100"
            step="5"
            class="w-full"
          />
          <p class="text-xs text-fg-muted mt-1">{{ $t('training.manage.promptFrequencyHint') }}</p>
        </div>

        <div>
          <label class="form-label">{{ $t('training.manage.cooldownDays') }}</label>
          <input v-model.number="settings.cooldown_days" type="number" min="0" max="90" class="form-input" />
          <p class="text-xs text-fg-muted mt-1">{{ $t('training.manage.cooldownHint') }}</p>
        </div>

        <button class="btn-primary" :disabled="savingSettings" @click="saveSettings">
          {{ savingSettings ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>

    <!-- Photo lightbox -->
    <div
      v-if="lightbox"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: var(--scrim);"
      @click="lightbox = ''"
    >
      <img :src="lightbox" class="max-h-full max-w-full rounded-lg" alt="" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../utils/api'
import TrainingPhoto from '../components/TrainingPhoto.vue'
import MaterialIcon from '../components/ui/MaterialIcon.vue'

const route = useRoute()
const { t } = useI18n()

const tabs = [
  { key: 'review', label: 'training.manage.tabReview' },
  { key: 'catalogue', label: 'training.manage.tabCatalogue' },
  { key: 'settings', label: 'training.manage.tabSettings' }
]

// The review-notification deep link lands on /training/review; the catalogue
// entry in the sidebar lands on /training/manage.
const activeTab = ref(route.path.endsWith('/review') ? 'review' : 'catalogue')

const submissions = ref([])
const loadingSubmissions = ref(false)
const onlyPending = ref(true)
const drafts = ref({})
const reviewing = ref(null)
const lightbox = ref('')

const templates = ref([])
const loadingTemplates = ref(false)
const editing = ref(null)
const savingTemplate = ref(false)

const settings = ref({ prompt_probability: 0.5, cooldown_days: 7 })
const savingSettings = ref(false)

const pendingCount = computed(() => submissions.value.filter(s => s.status === 'pending_review').length)

const probabilityPercent = computed({
  get: () => Math.round(settings.value.prompt_probability * 100),
  set: (value) => { settings.value.prompt_probability = Number(value) / 100 }
})

const notifyError = (e, fallbackKey) => {
  window.showNotification?.({
    type: 'error',
    title: t('common.error'),
    message: e?.data?.error || e?.message || t(fallbackKey)
  })
}

const loadSubmissions = async () => {
  loadingSubmissions.value = true
  try {
    const res = await api.getTrainingSubmissions({ status: onlyPending.value ? 'pending_review' : undefined })
    submissions.value = res?.data || []
  } catch (e) {
    notifyError(e, 'training.manage.failedToLoad')
  } finally {
    loadingSubmissions.value = false
  }
}

const loadTemplates = async () => {
  loadingTemplates.value = true
  try {
    const res = await api.getTrainingTemplates()
    templates.value = res?.data || []
  } catch (e) {
    notifyError(e, 'training.manage.failedToLoad')
  } finally {
    loadingTemplates.value = false
  }
}

const loadSettings = async () => {
  try {
    const res = await api.getTrainingSettings()
    if (res?.data) settings.value = { ...res.data }
  } catch (e) {
    notifyError(e, 'training.manage.failedToLoad')
  }
}

const review = async (submission, rating) => {
  const comment = (drafts.value[submission.id] || '').trim()
  if (rating === 'needs_improvement' && !comment) {
    window.showNotification?.({
      type: 'warning',
      title: t('training.manage.commentRequiredTitle'),
      message: t('training.manage.commentRequiredHint')
    })
    return
  }
  reviewing.value = submission.id
  try {
    await api.reviewTrainingSubmission(submission.id, rating, comment)
    delete drafts.value[submission.id]
    window.showNotification?.({
      type: 'success',
      title: t('training.manage.feedbackSentTitle'),
      message: t('training.manage.feedbackSentMessage', { name: submission.user_name })
    })
    await loadSubmissions()
  } catch (e) {
    notifyError(e, 'training.manage.failedToReview')
  } finally {
    reviewing.value = null
  }
}

const blankTemplate = () => ({
  id: null,
  title: '',
  description: '',
  target_job_type: '',
  min_photos: 1,
  weight: 1,
  is_active: true,
  checkpoints: [{ label: '', hint: '' }]
})

const startCreate = () => { editing.value = blankTemplate() }

const startEdit = (tpl) => {
  editing.value = {
    id: tpl.id,
    title: tpl.title,
    description: tpl.description || '',
    target_job_type: tpl.target_job_type || '',
    min_photos: Number(tpl.min_photos ?? 1),
    weight: Number(tpl.weight ?? 1),
    is_active: tpl.is_active !== false,
    checkpoints: (tpl.checkpoints || []).map(c => ({ label: c.label, hint: c.hint || '' }))
  }
}

const saveTemplate = async () => {
  const draft = editing.value
  savingTemplate.value = true
  try {
    const payload = {
      title: draft.title,
      description: draft.description || null,
      target_job_type: draft.target_job_type || null,
      // min_photos of 0 is how the catalogue expresses "checklist only".
      requires_photo: Number(draft.min_photos) > 0,
      min_photos: Number(draft.min_photos),
      weight: Number(draft.weight) || 1,
      is_active: draft.is_active,
      checkpoints: draft.checkpoints
        .map((c, index) => ({ label: c.label, hint: c.hint || null, sort_order: index }))
        .filter(c => c.label.trim())
    }
    if (draft.id) {
      await api.updateTrainingTemplate(draft.id, payload)
    } else {
      await api.createTrainingTemplate(payload)
    }
    editing.value = null
    await loadTemplates()
    window.showNotification?.({ type: 'success', title: t('common.success'), message: t('training.manage.saved') })
  } catch (e) {
    notifyError(e, 'training.manage.failedToSave')
  } finally {
    savingTemplate.value = false
  }
}

const removeTemplate = async (tpl) => {
  if (!window.confirm(t('training.manage.confirmDelete', { title: tpl.title }))) return
  try {
    await api.deleteTrainingTemplate(tpl.id)
    await loadTemplates()
  } catch (e) {
    notifyError(e, 'training.manage.failedToSave')
  }
}

const saveSettings = async () => {
  savingSettings.value = true
  try {
    const res = await api.updateTrainingSettings({
      prompt_probability: settings.value.prompt_probability,
      cooldown_days: settings.value.cooldown_days
    })
    if (res?.data) settings.value = { ...res.data }
    window.showNotification?.({ type: 'success', title: t('common.success'), message: t('training.manage.saved') })
  } catch (e) {
    notifyError(e, 'training.manage.failedToSave')
  } finally {
    savingSettings.value = false
  }
}

const statusLabel = (s) =>
  s.status !== 'reviewed'
    ? t('training.status.pendingReview')
    : (s.review_rating === 'good' ? t('training.rating.good') : t('training.rating.needsImprovement'))

const statusClass = (s) => {
  if (s.status !== 'reviewed') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300'
  return s.review_rating === 'good'
    ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
    : 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
}

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

onMounted(async () => {
  await Promise.all([loadSubmissions(), loadTemplates(), loadSettings()])
})
</script>

<style scoped>
.badge {
  @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium;
}

.btn-sm {
  @apply px-3 py-1 text-sm;
}

/* The tab strip scrolls on narrow screens; the scrollbar itself just adds noise. */
.tab-bar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tab-bar::-webkit-scrollbar {
  display: none;
}
</style>
