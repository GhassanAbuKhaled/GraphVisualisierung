import { describe, expect, it } from 'vitest'
import { distanceNeighborhoods, TooLargeError } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { allPairsDistances, randomPairs } from '../helpers'

function row(nb: { offsets: Int32Array; neighbors: Int32Array }, v: number): number[] {
  return [...nb.neighbors.subarray(nb.offsets[v], nb.offsets[v + 1])]
}

describe('distanceNeighborhoods', () => {
  it('matches brute-force distances on random graphs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const n = 10 + (seed % 40)
      const pairs = randomPairs(n, 0.08, seed)
      const g = buildGraph(n, pairs)
      const dist = allPairsDistances(n, pairs)
      for (let d = 1; d <= 4; d++) {
        const nb = distanceNeighborhoods(g, d)
        for (let v = 0; v < n; v++) {
          const expected = []
          for (let u = 0; u < n; u++) if (u !== v && dist[v][u] <= d) expected.push(u)
          expect(row(nb, v), `seed ${seed}, d ${d}, vertex ${v}`).toEqual(expected)
        }
      }
    }
  })

  it('stays inside components when d exceeds the diameter', () => {
    // path 0-1-2-3 and separate edge 4-5
    const g = buildGraph(6, [0, 1, 1, 2, 2, 3, 4, 5])
    const nb = distanceNeighborhoods(g, 10)
    expect(row(nb, 0)).toEqual([1, 2, 3])
    expect(row(nb, 4)).toEqual([5])
  })

  it('returns empty neighborhoods for a graph without edges', () => {
    const nb = distanceNeighborhoods(buildGraph(3, []), 2)
    expect([...nb.offsets]).toEqual([0, 0, 0, 0])
    expect(nb.neighbors.length).toBe(0)
  })

  it('ignores self-loops', () => {
    const nb = distanceNeighborhoods(buildGraph(3, [0, 0, 0, 1]), 2)
    expect(row(nb, 0)).toEqual([1])
  })

  it('reports progress up to 1', () => {
    const g = buildGraph(50, randomPairs(50, 0.1, 3))
    const seen: number[] = []
    distanceNeighborhoods(g, 2, { onProgress: (f) => seen.push(f) })
    expect(seen.at(-1)).toBe(1)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  })

  it('throws TooLargeError above the limit', () => {
    const complete: number[] = []
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) complete.push(i, j)
    const g = buildGraph(20, complete)
    expect(() => distanceNeighborhoods(g, 2, { limit: 100 })).toThrow(TooLargeError)
    expect(() => distanceNeighborhoods(g, 1, { limit: 100 })).toThrow(TooLargeError)
    expect(distanceNeighborhoods(g, 2, { limit: 380 }).neighbors.length).toBe(380)
  })

  it('rejects d < 1', () => {
    expect(() => distanceNeighborhoods(buildGraph(2, [0, 1]), 0)).toThrow(RangeError)
  })
})
