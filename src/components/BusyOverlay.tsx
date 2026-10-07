import { LoaderCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { appStore, useApp } from '@/store'

export function BusyOverlay() {
  const { t } = useTranslation()
  const busy = useApp((s) => s.busy)
  const progress = useApp((s) => s.progress)
  if (!busy) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
      <div className="flex w-64 flex-col items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {t('status.computing')}
        </div>
        {progress !== null && <Progress value={Math.round(progress * 100)} className="w-full" />}
        <Button variant="outline" size="sm" onClick={() => void appStore.getState().cancel()}>
          {t('status.cancel')}
        </Button>
      </div>
    </div>
  )
}
