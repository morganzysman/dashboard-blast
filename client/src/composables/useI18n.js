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

  // Initialize locale based on current company
  const initializeLocale = async () => {
    try {
      // If user has a company, get company details to set language
      if (authStore.user?.company_id) {
        const companyRes = await api.get(`/api/admin/companies/${authStore.user.company_id}`)
        if (companyRes.success) {
          const companyLanguage = companyRes.data.language || 'pt'
          setLocale(companyLanguage)
          
          // Store company info for future reference
          authStore.currentCompany = companyRes.data
        }
      } else {
        // Fallback to Portuguese
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