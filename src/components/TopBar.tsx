import { ExternalLinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeToggle } from './ThemeToggle'

const REPOSITORY = 'https://github.com/GhassanAbuKhaled/GraphVisualisierung'

export function TopBar() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{t('app.title')}</h1>
        <p className="truncate text-xs text-muted-foreground">{t('app.subtitle')}</p>
      </div>
      <LanguageSwitch />
      <ThemeToggle />
      <Button variant="ghost" size="sm" asChild>
        <a href={REPOSITORY} target="_blank" rel="noreferrer">
          {t('app.github')}
          <ExternalLinkIcon />
        </a>
      </Button>
    </header>
  )
}
