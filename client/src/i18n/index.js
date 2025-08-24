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

const i18n = createI18n({
  legacy: false,
  locale: 'pt', // default fallback
  fallbackLocale: 'pt',
  messages
})

export default i18n