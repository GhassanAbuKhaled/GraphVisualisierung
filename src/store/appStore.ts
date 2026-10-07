import { createStore, type StoreApi } from 'zustand/vanilla'
import type { EngineHandle } from '@/engine/client'
import {
  STEP_LIMIT,
  type ColoringEngine,
  type ColoringResult,
  type DatasetId,
  type GraphSource,
  type GraphSummary,
} from '@/engine/types'

export type SourceKind = 'random' | 'dataset'

export interface RandomParams {
  n: number
  p: number
  seed: number
}

export interface DisplaySettings {
  nodeSize: number
  /** null = automatic (labels only up to LABEL_LIMIT vertices) */
  showLabels: boolean | null
  edgeOpacity: number
}

export type AppError =
  | { key: 'errors.tooLarge'; d: number }
  | { key: 'errors.parse' | 'errors.generic'; message: string }
  | { key: 'errors.crash' }

export const DEFAULT_RANDOM: RandomParams = { n: 50, p: 0.1, seed: 42 }
export const MAX_RANDOM_NODES = 1000
export const MAX_DISTANCE = 10
export const MAX_IMPROVE_ROUNDS = 50
export const DEFAULT_DISPLAY: DisplaySettings = { nodeSize: 4, showLabels: null, edgeOpacity: 0.35 }
/** Labels are shown automatically up to this many vertices (spec §4.4). */
export const LABEL_LIMIT = 200

export interface AppState {
  sourceKind: SourceKind
  random: RandomParams
  datasetId: DatasetId
  d: number
  graph: GraphSummary | null
  /** Increments whenever a new graph is loaded (the canvas rebuilds). */
  graphVersion: number
  coloring: ColoringResult | null
  /** Number of colors per round; index 0 = first coloring. */
  rounds: number[]
  busy: boolean
  progress: number | null
  error: AppError | null
  display: DisplaySettings
  layoutVersion: number
  layoutRunning: boolean

  setSourceKind(kind: SourceKind): void
  setRandom(patch: Partial<RandomParams>): void
  setDataset(id: DatasetId): void
  setDisplay(patch: Partial<DisplaySettings>): void
  relayout(): void
  dismissError(): void
  generate(): Promise<void>
  setDistance(d: number): Promise<void>
  color(): Promise<void>
  improve(rounds: number): Promise<void>
  cancel(): Promise<void>
}

export type EngineFactory = (onCrash: () => void) => EngineHandle

const isValidN = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_RANDOM_NODES
const isValidP = (p: number) => Number.isFinite(p) && p >= 0.01 && p <= 1
const isValidSeed = (seed: number) => Number.isSafeInteger(seed) && seed >= 0
const isValidD = (d: number) => Number.isInteger(d) && d >= 1 && d <= MAX_DISTANCE

function toAppError(error: unknown, d: number): AppError {
  // Errors from the worker lose their class but keep their name
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'TooLargeError') return { key: 'errors.tooLarge', d }
  if (name === 'GraphParseError') return { key: 'errors.parse', message }
  return { key: 'errors.generic', message }
}

export function createAppStore(createEngineHandle: EngineFactory): StoreApi<AppState> {
  return createStore<AppState>()((set, get) => {
    let handle: EngineHandle = createEngineHandle(onCrash)
    /** Incremented by every operation and by cancel/crash: older results are dropped. */
    let operation = 0
    /** Settles once a restarted engine holds the last graph and d again. */
    let ready: Promise<void> = Promise.resolve()
    /** What the engine currently holds, to restore it after a restart. */
    let loadedSource: GraphSource | null = null
    let appliedD = 1

    type Current = () => boolean

    async function run(task: (engine: ColoringEngine, current: Current) => Promise<void>) {
      const token = ++operation
      const current = () => token === operation
      set({ busy: true, progress: null, error: null })
      try {
        await ready
        if (current()) await task(handle.engine, current)
      } catch (error) {
        if (current()) set({ error: toAppError(error, get().d) })
      } finally {
        if (current()) set({ busy: false, progress: null })
      }
    }

    /** Sets d in the engine. If d is too large, falls back to the last working d and reports it. */
    async function applyDistance(engine: ColoringEngine, current: Current, d: number) {
      try {
        await engine.setDistance(d, (fraction) => {
          if (current()) set({ progress: fraction })
        })
        if (!current()) return
        appliedD = d
        set({ d, coloring: null, rounds: [] })
      } catch (error) {
        if (!current()) return
        if (!(error instanceof Error && error.name === 'TooLargeError')) throw error
        const fallback = d === appliedD ? 1 : appliedD
        await engine.setDistance(fallback)
        appliedD = fallback
        set({ d: fallback, coloring: null, rounds: [], error: toAppError(error, d) })
      }
    }

    function restartEngine(): Promise<void> {
      operation++
      handle.terminate()
      handle = createEngineHandle(onCrash)
      set({ busy: false, progress: null, coloring: null, rounds: [], d: appliedD })
      const engine = handle.engine
      const source = loadedSource
      const d = appliedD
      ready = source
        ? engine.loadGraph(source).then(
            () => engine.setDistance(d).then(() => undefined),
            () => undefined,
          )
        : Promise.resolve()
      return ready
    }

    function onCrash() {
      void restartEngine()
      set({ error: { key: 'errors.crash' } })
    }

    return {
      sourceKind: 'random',
      random: DEFAULT_RANDOM,
      datasetId: 'yeast',
      d: 1,
      graph: null,
      graphVersion: 0,
      coloring: null,
      rounds: [],
      busy: false,
      progress: null,
      error: null,
      display: DEFAULT_DISPLAY,
      layoutVersion: 0,
      layoutRunning: false,

      setSourceKind: (sourceKind) => set({ sourceKind }),
      setDataset: (datasetId) => set({ datasetId }),
      setRandom(patch) {
        const next = { ...get().random }
        if (patch.n !== undefined && isValidN(patch.n)) next.n = patch.n
        if (patch.p !== undefined && isValidP(patch.p)) next.p = patch.p
        if (patch.seed !== undefined && isValidSeed(patch.seed)) next.seed = patch.seed
        set({ random: next })
      },
      setDisplay: (patch) => set({ display: { ...get().display, ...patch } }),
      relayout: () => set({ layoutVersion: get().layoutVersion + 1 }),
      dismissError: () => set({ error: null }),

      generate() {
        const { sourceKind, random, datasetId } = get()
        const source: GraphSource =
          sourceKind === 'random' ? { kind: 'random', ...random } : { kind: 'dataset', id: datasetId }
        return run(async (engine, current) => {
          const graph = await engine.loadGraph(source)
          if (!current()) return
          loadedSource = source
          set({ graph, graphVersion: get().graphVersion + 1, coloring: null, rounds: [] })
          await applyDistance(engine, current, get().d)
        })
      },

      setDistance(d) {
        if (!isValidD(d)) return Promise.resolve()
        set({ d })
        if (!get().graph) return Promise.resolve()
        return run((engine, current) => applyDistance(engine, current, d))
      },

      color() {
        const graph = get().graph
        if (!graph) return Promise.resolve()
        return run(async (engine, current) => {
          const result = await engine.colorFirst({ trace: graph.n <= STEP_LIMIT })
          if (current()) set({ coloring: result, rounds: [result.numColors] })
        })
      },

      improve(rounds) {
        if (!get().coloring || !Number.isInteger(rounds) || rounds < 1 || rounds > MAX_IMPROVE_ROUNDS) {
          return Promise.resolve()
        }
        const seed = get().random.seed
        return run(async (engine, current) => {
          const results = await engine.improve(rounds, seed)
          if (!current() || results.length === 0) return
          set({
            coloring: results[results.length - 1],
            rounds: [...get().rounds, ...results.map((r) => r.numColors)],
          })
        })
      },

      cancel: () => restartEngine(),
    }
  })
}
