import { useTranslation } from 'react-i18next'
import { useApp } from '@/store'

export function StatusBadge() {
  const { t } = useTranslation()
  const graph = useApp((s) => s.graph)
  const d = useApp((s) => s.d)
  const coloring = useApp((s) => s.coloring)
  if (!graph) return null
  const parts = [
    t('status.nodes', { count: graph.n }),
    t('status.edges', { count: graph.edgeCount }),
    t('status.distance', { d }),
  ]
  if (coloring) parts.push(t('status.colors', { count: coloring.numColors }))
  return (
    <div
      data-testid="status"
      className="pointer-events-none absolute top-3 right-3 rounded-md border bg-background/80 px-3 py-1.5 text-sm font-medium backdrop-blur"
    >
      {parts.join(' · ')}
    </div>
  )
}
