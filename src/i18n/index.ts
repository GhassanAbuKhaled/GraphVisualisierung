import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'language'

/** Saved choice, else browser language, else English (spec §4.5). */
export function detectLanguage(saved: string | null, browser: string | undefined): Language {
  if (saved === 'en' || saved === 'de') return saved
  return browser?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage unavailable (private mode): the choice only lasts for this visit
  }
}

export function initI18n() {
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language
  })
  return i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, de: { translation: de } },
    lng: detectLanguage(readSaved(), navigator.language),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
}

export default i18n
