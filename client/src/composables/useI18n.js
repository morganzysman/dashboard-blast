import { computed } from 'vue'
import { useI18n as useVueI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

export function useI18n() {
  const { locale, t } = useVueI18n()
  const authStore = useAuthStore()

  // Get current company language from auth store or fallback to 'pt'
  const currentLanguage = computed(() => {
    return authStore.user?.company?.language || authStore.currentCompany?.language || 'pt'
  })

  // Set locale when company language changes
  const setLocale = (lang) => {
    if (['pt', 'es', 'en', 'fr'].includes(lang)) {
      locale.value = lang
    }
  }

  // Initialize locale based on user override or company default
  const initializeLocale = async () => {
    try {
      // Check for user language override in localStorage first
      const savedLang = localStorage.getItem('user_language')
      if (savedLang && ['pt', 'es', 'en', 'fr'].includes(savedLang)) {
        setLocale(savedLang)
        // Still fetch company info for reference, but don't override locale
        if (authStore.user?.company_id) {
          const companyRes = await api.get(`/api/admin/companies/${authStore.user.company_id}`)
          if (companyRes.success) {
            authStore.currentCompany = companyRes.data
          }
        }
        return
      }

      // No override — use company language
      if (authStore.user?.company_id) {
        const companyRes = await api.get(`/api/admin/companies/${authStore.user.company_id}`)
        if (companyRes.success) {
          const companyLanguage = companyRes.data.language || 'pt'
          setLocale(companyLanguage)
          authStore.currentCompany = companyRes.data
        }
      } else {
        setLocale('pt')
      }
    } catch (error) {
      console.warn('Failed to initialize locale:', error)
      setLocale('pt')
    }
  }

  return {
    t,
    locale,
    currentLanguage,
    setLocale,
    initializeLocale
  }
}