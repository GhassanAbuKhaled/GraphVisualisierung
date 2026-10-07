import * as Comlink from 'comlink'
import type { ColoringEngine } from './types'

export interface EngineHandle {
  engine: ColoringEngine
  terminate(): void
}

/** Starts the engine worker. onCrash fires if the worker dies; pending calls never settle then. */
export function createWorkerEngine(onCrash: () => void): EngineHandle {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('error', onCrash)
  const remote = Comlink.wrap<ColoringEngine>(worker)

  const engine: ColoringEngine = {
    loadGraph: (source) => remote.loadGraph(source),
    setDistance: (d, onProgress) => remote.setDistance(d, onProgress ? Comlink.proxy(onProgress) : undefined),
    colorFirst: (options) => remote.colorFirst(options),
    improve: (rounds, seed) => remote.improve(rounds, seed),
  }

  return {
    engine,
    terminate() {
      worker.removeEventListener('error', onCrash)
      remote[Comlink.releaseProxy]()
      worker.terminate()
    },
  }
}
