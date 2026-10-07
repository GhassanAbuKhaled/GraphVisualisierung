import { buildGraph, type Graph } from './graph'
import { createRng } from './rng'

/** Erdős–Rényi G(n, p): every pair i < j is connected with probability p. */
export function randomGraph(n: number, p: number, seed: number): Graph {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`invalid vertex count ${n}`)
  if (!(p >= 0 && p <= 1)) throw new RangeError(`invalid edge probability ${p}`)

  const rng = createRng(seed)
  const pairs: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rng.next() < p) pairs.push(i, j)
    }
  }
  return buildGraph(n, pairs)
}
