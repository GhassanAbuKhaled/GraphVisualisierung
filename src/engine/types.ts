import type { ColoringResult } from '@/core/coloring'

export type { ColoringResult, Step } from '@/core/coloring'

export type DatasetId = 'yeast' | 'minnesota' | 'DC'

export type GraphSource =
  | { kind: 'random'; n: number; p: number; seed: number }
  | { kind: 'dataset'; id: DatasetId }

export interface GraphSummary {
  n: number
  edgeCount: number
  colorableCount: number
  /** Flat undirected pairs [u0, v0, u1, v1, ...] with u < v, for drawing. */
  edges: Int32Array
}

export interface DistanceSummary {
  d: number
  neighborEntries: number
}

/** Graphs up to this size record a step trace (spec §4.2). */
export const STEP_LIMIT = 300

/** The boundary between UI and algorithm (spec §3.2). A WebAssembly engine implements it later. */
export interface ColoringEngine {
  loadGraph(source: GraphSource): Promise<GraphSummary>
  setDistance(d: number, onProgress?: (fraction: number) => void): Promise<DistanceSummary>
  colorFirst(options: { trace: boolean }): Promise<ColoringResult>
  improve(rounds: number, seed: number): Promise<ColoringResult[]>
}
