import { describe, expect, it } from 'vitest'
import { greedyColoring, improve, improvementOrder, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { createRng } from '@/core/rng'
import { coloringProblems, randomPairs } from '../helpers'

function setup(n: number, pairs: number[], d: number) {
  const g = buildGraph(n, pairs)
  const nb = distanceNeighborhoods(g, d)
  return { g, nb, first: greedyColoring(g, nb, naturalOrder(n)) }
}

describe('improvementOrder', () => {
  it('lists the vertices class by class, then the uncolored ones', () => {
    const { g, first } = setup(5, [0, 1, 0, 2], 1) // classes [[0], [1, 2]], 3 and 4 uncolored
    const order = [...improvementOrder(g, first, createRng(1))]
    expect(order.slice(3)).toEqual([3, 4])
    const head = order.slice(0, 3)
    expect([[0, 1, 2], [1, 2, 0]]).toContainEqual(head)
  })
})

describe('improve', () => {
  it('never increases the number of colors and stays valid', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = 40
      const pairs = randomPairs(n, 0.1 + (seed % 4) * 0.05, seed)
      const d = 1 + (seed % 2)
      const { g, nb, first } = setup(n, pairs, d)
      const rounds = improve(g, nb, first, 20, seed)
      expect(rounds.length).toBe(20)
      let previous = first.numColors
      for (const result of rounds) {
        expect(result.numColors).toBeLessThanOrEqual(previous)
        expect(coloringProblems(n, pairs, d, result.colorOf)).toEqual([])
        previous = result.numColors
      }
    }
  })

  it('is reproducible for the same seed', () => {
    const { g, nb, first } = setup(40, randomPairs(40, 0.2, 5), 1)
    const a = improve(g, nb, first, 5, 99).map((r) => [...r.colorOf])
    const b = improve(g, nb, first, 5, 99).map((r) => [...r.colorOf])
    expect(a).toEqual(b)
  })

  it('continues the round numbering with firstRound', () => {
    const { g, nb, first } = setup(40, randomPairs(40, 0.2, 6), 1)
    const all = improve(g, nb, first, 4, 7)
    const firstTwo = improve(g, nb, first, 2, 7)
    const lastTwo = improve(g, nb, firstTwo[1], 2, 7, 3)
    expect(lastTwo.map((r) => [...r.colorOf])).toEqual(all.slice(2).map((r) => [...r.colorOf]))
  })

  it('rejects seeds that are not integers', () => {
    const { g, nb, first } = setup(10, randomPairs(10, 0.3, 1), 1)
    expect(() => improve(g, nb, first, 1, Number.NaN)).toThrow(RangeError)
    expect(() => improve(g, nb, first, 1, 1.5)).toThrow(RangeError)
    expect(() => improve(g, nb, first, -1, 1)).toThrow(RangeError)
  })

  it('returns an empty list for 0 rounds', () => {
    const { g, nb, first } = setup(3, [0, 1], 1)
    expect(improve(g, nb, first, 0, 1)).toEqual([])
  })
})
