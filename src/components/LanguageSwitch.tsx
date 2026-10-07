import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LANGUAGES, saveLanguage, type Language } from '@/i18n'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      aria-label={t('language.label')}
      value={i18n.language}
      onValueChange={(value) => {
        if (!value) return
        saveLanguage(value as Language)
        void i18n.changeLanguage(value)
      }}
    >
      {LANGUAGES.map((language) => (
        <ToggleGroupItem key={language} value={language} aria-label={language.toUpperCase()}>
          {language.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
