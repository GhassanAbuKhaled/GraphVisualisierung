import { greedyColoring, improve, naturalOrder, type ColoringResult } from '@/core/coloring'
import { distanceNeighborhoods, MAX_NEIGHBOR_ENTRIES, type Neighborhoods } from '@/core/distance'
import type { Graph } from '@/core/graph'
import { parseGraphFile } from '@/core/parser'
import { randomGraph } from '@/core/random'
import { STEP_LIMIT, type ColoringEngine, type DatasetId, type GraphSummary } from './types'

export interface EngineOptions {
  loadDataset: (id: DatasetId) => Promise<string>
  /** Maximum number of distance-d neighbor entries (tests use small values). */
  limit?: number
}

/** ColoringEngine running in the current thread; worker.ts exposes it to the UI. */
export function createEngine(options: EngineOptions): ColoringEngine {
  let graph: Graph | null = null
  let neighborhoods: Neighborhoods | null = null
  let last: ColoringResult | null = null
  let round = 0

  const requireGraph = (): Graph => {
    if (!graph) throw new Error('No graph loaded')
    return graph
  }
  const requireDistance = (): Neighborhoods => {
    if (!neighborhoods) throw new Error('Distance not set')
    return neighborhoods
  }

  return {
    async loadGraph(source) {
      const g =
        source.kind === 'random'
          ? randomGraph(source.n, source.p, source.seed)
          : parseGraphFile(await options.loadDataset(source.id))
      graph = g
      neighborhoods = null
      last = null
      round = 0
      return summarize(g)
    },

    async setDistance(d, onProgress) {
      const g = requireGraph()
      neighborhoods = null
      last = null
      round = 0
      neighborhoods = distanceNeighborhoods(g, d, {
        limit: options.limit ?? MAX_NEIGHBOR_ENTRIES,
        onProgress,
      })
      return { d, neighborEntries: neighborhoods.neighbors.length }
    },

    async colorFirst({ trace }) {
      const g = requireGraph()
      last = greedyColoring(g, requireDistance(), naturalOrder(g.n), { trace: trace && g.n <= STEP_LIMIT })
      round = 0
      return last
    },

    async improve(rounds, seed) {
      const g = requireGraph()
      const nb = requireDistance()
      if (!last) throw new Error('Color the graph first')
      const results = improve(g, nb, last, rounds, seed, round + 1)
      if (results.length > 0) {
        last = results[results.length - 1]
        round += results.length
      }
      return results
    },
  }
}

function summarize(g: Graph): GraphSummary {
  const edges = new Int32Array(g.edgeCount * 2)
  let k = 0
  let colorableCount = 0
  for (let u = 0; u < g.n; u++) {
    colorableCount += g.colorable[u]
    for (let i = g.offsets[u]; i < g.offsets[u + 1]; i++) {
      const v = g.neighbors[i]
      if (u < v) {
        edges[k++] = u
        edges[k++] = v
      }
    }
  }
  return { n: g.n, edgeCount: g.edgeCount, colorableCount, edges }
}
