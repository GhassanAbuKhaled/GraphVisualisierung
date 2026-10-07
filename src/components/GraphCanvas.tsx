import type Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import Sigma from 'sigma'
import { classColor, mixColors } from '@/lib/colors'
import { toGraphology } from '@/lib/graphModel'
import { appStore, useApp } from '@/store'
import { LABEL_LIMIT } from '@/store/appStore'

/** Page background per theme (shadcn neutral) — edges are blended onto it, see edgeReducer. */
const BACKGROUND = { dark: '#0a0a0a', light: '#ffffff' }
const EDGE = { dark: '#a1a1aa', light: '#52525b' }

/** Layout run time: longer for bigger graphs, capped so the page settles quickly. */
const layoutDuration = (order: number) => Math.min(6000, 1500 + 2 * order)

export function GraphCanvas() {
  const container = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const graph = useApp((s) => s.graph)
  const layoutVersion = useApp((s) => s.layoutVersion)
  const coloring = useApp((s) => s.coloring)
  const display = useApp((s) => s.display)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'

  // New graph → new Sigma instance
  useEffect(() => {
    if (!graph || !container.current) return
    const g = toGraphology(graph)
    const sigma = new Sigma(g, container.current, { renderLabels: false, labelSize: 11, zIndex: true })
    graphRef.current = g
    sigmaRef.current = sigma
    window.__sigma = sigma
    return () => {
      sigma.kill()
      sigmaRef.current = null
      graphRef.current = null
      window.__sigma = undefined
    }
  }, [graph])

  // Layout: on every new graph and on "Re-layout"
  useEffect(() => {
    const g = graphRef.current
    if (!g) return
    const layout = new FA2Layout(g, {
      settings: { ...forceAtlas2.inferSettings(g), barnesHutOptimize: g.order > 500 },
    })
    appStore.setState({ layoutRunning: true })
    layout.start()
    const timer = setTimeout(() => {
      layout.stop()
      appStore.setState({ layoutRunning: false })
    }, layoutDuration(g.order))
    return () => {
      clearTimeout(timer)
      layout.kill()
      appStore.setState({ layoutRunning: false })
    }
  }, [graph, layoutVersion])

  // Colors, sizes, labels and theme
  useEffect(() => {
    const sigma = sigmaRef.current
    if (!sigma || !graph) return
    const colorOf = coloring?.colorOf
    const neutral = dark ? '#a1a1aa' : '#52525b'
    // WebGL blends rgba edges with the page differently per theme; an opaque blend looks the same everywhere
    const theme = dark ? 'dark' : 'light'
    const edgeColor = mixColors(BACKGROUND[theme], EDGE[theme], display.edgeOpacity)
    sigma.setSetting('renderLabels', display.showLabels ?? graph.n <= LABEL_LIMIT)
    sigma.setSetting('labelColor', { color: dark ? '#e4e4e7' : '#27272a' })
    sigma.setSetting('nodeReducer', (node, data) => ({
      ...data,
      size: display.nodeSize,
      color: colorOf ? classColor(colorOf[Number(node)]) : neutral,
    }))
    sigma.setSetting('edgeReducer', (_edge, data) => ({
      ...data,
      color: edgeColor,
    }))
  }, [graph, coloring, display, dark])

  return <div ref={container} className="absolute inset-0" />
}
