import { createI18n } from 'vue-i18n'

// Import language files
import en from './locales/en.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import fr from './locales/fr.json'

const messages = {
  en,
  es,
  pt,
  fr
}

// Restore saved language from localStorage, otherwise default to Portuguese
let savedLocale = 'pt'
try {
  const stored = localStorage.getItem('user_language')
  if (stored && ['pt', 'es', 'en', 'fr'].includes(stored)) {
    savedLocale = stored
  }
} catch {}

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages
})

export default i18n