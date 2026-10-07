import { describe, expect, it } from 'vitest'
import { greedyColoring, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { coloringProblems, randomPairs } from '../helpers'

function firstRound(n: number, pairs: number[], d: number, trace = false) {
  const g = buildGraph(n, pairs)
  return greedyColoring(g, distanceNeighborhoods(g, d), naturalOrder(n), { trace })
}

describe('greedyColoring', () => {
  it('colors a path with 2 colors at d = 1 and 3 colors at d = 2', () => {
    const path = [0, 1, 1, 2, 2, 3, 3, 4]
    expect([...firstRound(5, path, 1).colorOf]).toEqual([0, 1, 0, 1, 0])
    expect([...firstRound(5, path, 2).colorOf]).toEqual([0, 1, 2, 0, 1])
  })

  it('puts each vertex into the first class without conflict', () => {
    // 0-1, 0-2: vertex 3 is isolated, so it stays uncolored
    const result = firstRound(4, [0, 1, 0, 2], 1)
    expect(result.classes).toEqual([[0], [1, 2]])
    expect([...result.colorOf]).toEqual([0, 1, 1, -1])
    expect(result.numColors).toBe(2)
  })

  it('colors a vertex that only has a self-loop', () => {
    expect([...firstRound(2, [0, 0], 1).colorOf]).toEqual([0, -1])
  })

  it('returns 0 colors for a graph without edges', () => {
    const result = firstRound(3, [], 2)
    expect(result.numColors).toBe(0)
    expect([...result.colorOf]).toEqual([-1, -1, -1])
  })

  it('produces valid colorings on 500 random graphs', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const n = 5 + (seed % 36)
      const pairs = randomPairs(n, 0.05 + (seed % 7) * 0.05, seed)
      const d = 1 + (seed % 3)
      const result = firstRound(n, pairs, d)
      expect(coloringProblems(n, pairs, d, result.colorOf), `seed ${seed}`).toEqual([])
      expect(result.classes.flat().length).toBe([...result.colorOf].filter((c) => c >= 0).length)
    }
  })

  it('records a trace that explains every placement', () => {
    const pairs = [0, 1, 1, 2, 0, 2, 2, 3]
    const result = firstRound(4, pairs, 1, true)
    expect(result.trace).toEqual([
      { vertex: 0, rejected: [], placedIn: 0, createdNewClass: true },
      { vertex: 1, rejected: [{ classIndex: 0, witness: 0 }], placedIn: 1, createdNewClass: true },
      {
        vertex: 2,
        rejected: [
          { classIndex: 0, witness: 0 },
          { classIndex: 1, witness: 1 },
        ],
        placedIn: 2,
        createdNewClass: true,
      },
      // vertex 3's only neighbor is 2 (class 2), so class 0 is free
      { vertex: 3, rejected: [], placedIn: 0, createdNewClass: false },
    ])
  })

  it('replaying the trace reproduces colorOf', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const n = 30
      const result = firstRound(n, randomPairs(n, 0.15, seed), 2, true)
      const replay = new Int32Array(n).fill(-1)
      for (const step of result.trace ?? []) {
        for (const { classIndex, witness } of step.rejected) {
          expect(replay[witness]).toBe(classIndex)
        }
        replay[step.vertex] = step.placedIn
      }
      expect([...replay]).toEqual([...result.colorOf])
    }
  })

  it('omits the trace unless requested', () => {
    expect(firstRound(3, [0, 1], 1).trace).toBeUndefined()
  })
})
