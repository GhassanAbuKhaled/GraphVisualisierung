import { describe, expect, it } from 'vitest'
import { neighborsOf } from '@/core/graph'
import { randomGraph } from '@/core/random'

describe('randomGraph', () => {
  it('is reproducible for the same seed', () => {
    const a = randomGraph(50, 0.3, 9)
    const b = randomGraph(50, 0.3, 9)
    expect([...a.neighbors]).toEqual([...b.neighbors])
    expect([...a.offsets]).toEqual([...b.offsets])
  })

  it('differs for different seeds', () => {
    expect([...randomGraph(50, 0.3, 1).neighbors]).not.toEqual([...randomGraph(50, 0.3, 2).neighbors])
  })

  it('is symmetric and has no self-loops', () => {
    const g = randomGraph(40, 0.5, 3)
    for (let v = 0; v < g.n; v++) {
      for (const u of neighborsOf(g, v)) {
        expect(u).not.toBe(v)
        expect([...neighborsOf(g, u)]).toContain(v)
      }
    }
  })

  it('has about p * n(n-1)/2 edges', () => {
    const g = randomGraph(200, 0.1, 5)
    const expected = 0.1 * (200 * 199) / 2
    expect(g.edgeCount).toBeGreaterThan(expected * 0.85)
    expect(g.edgeCount).toBeLessThan(expected * 1.15)
  })

  it('handles p = 0 and p = 1', () => {
    expect(randomGraph(10, 0, 1).edgeCount).toBe(0)
    expect(randomGraph(10, 1, 1).edgeCount).toBe(45)
  })

  it('rejects invalid arguments', () => {
    expect(() => randomGraph(0, 0.5, 1)).toThrow(RangeError)
    expect(() => randomGraph(10, 1.5, 1)).toThrow(RangeError)
    expect(() => randomGraph(2.5, 0.5, 1)).toThrow(RangeError)
  })
})
