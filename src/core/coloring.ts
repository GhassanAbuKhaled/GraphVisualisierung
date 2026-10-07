import type { Neighborhoods } from './distance'
import type { Graph } from './graph'
import { createRng, type Rng } from './rng'

export interface Step {
  vertex: number
  /** Classes tried before placing the vertex, each with one conflicting member. */
  rejected: { classIndex: number; witness: number }[]
  placedIn: number
  createdNewClass: boolean
}

export interface ColoringResult {
  /** Class index per vertex; -1 = not colored (vertex without edges). */
  colorOf: Int32Array
  /** Members of every class in insertion order. */
  classes: number[][]
  numColors: number
  trace?: Step[]
}

export function naturalOrder(n: number): Int32Array {
  const order = new Int32Array(n)
  for (let v = 0; v < n; v++) order[v] = v
  return order
}

/**
 * Greedy coloring as greedyColoring in coloring.c: every vertex goes into the first
 * class that has no member within distance d (given by nb), else into a new class.
 */
export function greedyColoring(
  g: Graph,
  nb: Neighborhoods,
  order: ArrayLike<number>,
  options: { trace?: boolean } = {},
): ColoringResult {
  const colorOf = new Int32Array(g.n).fill(-1)
  const classes: number[][] = []
  const blockedAt: number[] = [] // blockedAt[c] === stamp: class c conflicts with the current vertex
  const witness: number[] = []
  const trace: Step[] | undefined = options.trace ? [] : undefined

  for (let i = 0; i < order.length; i++) {
    const v = order[i]
    if (!g.colorable[v] || colorOf[v] !== -1) continue
    const stamp = i + 1

    for (let k = nb.offsets[v]; k < nb.offsets[v + 1]; k++) {
      const u = nb.neighbors[k]
      const c = colorOf[u]
      if (c >= 0 && blockedAt[c] !== stamp) {
        blockedAt[c] = stamp
        witness[c] = u
      }
    }

    let c = 0
    while (c < classes.length && blockedAt[c] === stamp) c++
    const createdNewClass = c === classes.length
    if (createdNewClass) classes.push([])
    classes[c].push(v)
    colorOf[v] = c

    if (trace) {
      const rejected: Step['rejected'] = []
      for (let r = 0; r < c; r++) rejected.push({ classIndex: r, witness: witness[r] })
      trace.push({ vertex: v, rejected, placedIn: c, createdNewClass })
    }
  }

  return trace
    ? { colorOf, classes, numColors: classes.length, trace }
    : { colorOf, classes, numColors: classes.length }
}

/**
 * Vertex order for the next round, as randomShuffleSets in set.c: shuffle the classes
 * (Fisher–Yates), list their members class by class, then the uncolored vertices.
 */
export function improvementOrder(g: Graph, previous: ColoringResult, rng: Rng): Int32Array {
  const classes = previous.classes.slice()
  for (let i = classes.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[classes[i], classes[j]] = [classes[j], classes[i]]
  }
  const order = new Int32Array(g.n)
  let k = 0
  for (const members of classes) for (const v of members) order[k++] = v
  for (let v = 0; v < g.n; v++) if (!g.colorable[v]) order[k++] = v
  return order
}

/** Runs improvement rounds; round r uses createRng(seed + r). Colors never increase. */
export function improve(
  g: Graph,
  nb: Neighborhoods,
  previous: ColoringResult,
  rounds: number,
  seed: number,
  firstRound = 1,
): ColoringResult[] {
  const results: ColoringResult[] = []
  let current = previous
  for (let r = firstRound; r < firstRound + rounds; r++) {
    current = greedyColoring(g, nb, improvementOrder(g, current, createRng(seed + r)))
    results.push(current)
  }
  return results
}
