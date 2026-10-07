import { describe, expect, it } from 'vitest'
import { buildGraph, neighborsOf } from '@/core/graph'

describe('buildGraph', () => {
  it('builds sorted CSR neighbor lists', () => {
    const g = buildGraph(4, [0, 2, 0, 1, 2, 3])
    expect(g.n).toBe(4)
    expect([...neighborsOf(g, 0)]).toEqual([1, 2])
    expect([...neighborsOf(g, 2)]).toEqual([0, 3])
    expect(g.edgeCount).toBe(3)
  })

  it('deduplicates edges listed twice or in both directions', () => {
    const g = buildGraph(3, [0, 1, 1, 0, 0, 1, 1, 2, 2, 1])
    expect([...neighborsOf(g, 1)]).toEqual([0, 2])
    expect(g.edgeCount).toBe(2)
  })

  it('drops self-loops from neighbors but marks the vertex colorable', () => {
    const g = buildGraph(3, [0, 0, 1, 2])
    expect([...neighborsOf(g, 0)]).toEqual([])
    expect([...g.colorable]).toEqual([1, 1, 1])
    expect(g.edgeCount).toBe(1)
  })

  it('leaves vertices without edges uncolorable', () => {
    const g = buildGraph(4, [0, 1])
    expect([...g.colorable]).toEqual([1, 1, 0, 0])
  })

  it('accepts a graph without edges', () => {
    const g = buildGraph(1, [])
    expect(g.edgeCount).toBe(0)
    expect([...g.offsets]).toEqual([0, 0])
  })

  it('rejects vertices out of range', () => {
    expect(() => buildGraph(2, [0, 2])).toThrow(RangeError)
    expect(() => buildGraph(2, [-1, 0])).toThrow(RangeError)
  })
})
