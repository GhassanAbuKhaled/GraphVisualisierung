import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  return (
    <Button variant="ghost" size="icon" aria-label={t('theme.toggle')} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
