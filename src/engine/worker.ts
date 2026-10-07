import * as Comlink from 'comlink'
import { DATASETS } from '@/data/datasets'
import { createEngine } from './engine'
import type { ColoringEngine, DatasetId } from './types'

async function loadDataset(id: DatasetId): Promise<string> {
  const dataset = DATASETS.find((d) => d.id === id)
  if (!dataset) throw new Error(`Unknown dataset ${id}`)
  const response = await fetch(`${import.meta.env.BASE_URL}data/${dataset.file}`)
  if (!response.ok) throw new Error(`Could not load ${dataset.file} (HTTP ${response.status})`)
  return response.text()
}

const engine = createEngine({ loadDataset })

// Results are copied (structured clone). Only the freshly built edge list is transferred:
// the engine keeps its own graph, neighborhoods and last coloring.
const api: ColoringEngine = {
  async loadGraph(source) {
    const summary = await engine.loadGraph(source)
    return Comlink.transfer(summary, [summary.edges.buffer])
  },
  setDistance: (d, onProgress) => engine.setDistance(d, onProgress),
  colorFirst: (options) => engine.colorFirst(options),
  improve: (rounds, seed) => engine.improve(rounds, seed),
}

Comlink.expose(api)
