import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BusyOverlay } from '@/components/BusyOverlay'
import { ControlPanel } from '@/components/ControlPanel'
import { GraphCanvas } from '@/components/GraphCanvas'
import { StatusBadge } from '@/components/StatusBadge'
import { TopBar } from '@/components/TopBar'
import { appStore, useApp } from '@/store'

export default function App() {
  const { t } = useTranslation()
  const error = useApp((s) => s.error)

  useEffect(() => {
    void appStore.getState().generate()
  }, [])

  useEffect(() => {
    if (!error) return
    toast.error(t(error.key, error))
    appStore.getState().dismissError()
  }, [error, t])

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ControlPanel />
        <div className="relative min-h-[60vh] flex-1 md:min-h-0">
          <GraphCanvas />
          <StatusBadge />
          <BusyOverlay />
        </div>
      </main>
    </div>
  )
}
