import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { greedyColoring, improve, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { randomGraph } from '@/core/random'
import { createEngine } from '@/engine/engine'
import type { DatasetId } from '@/engine/types'

const files: Record<DatasetId, string> = { yeast: 'yeast.txt', minnesota: 'minnesota.txt', DC: 'DC.txt' }
const loadDataset = async (id: DatasetId) =>
  readFileSync(new URL(`../../public/data/${files[id]}`, import.meta.url), 'utf8')

function newEngine(limit?: number) {
  return createEngine({ loadDataset, limit })
}

describe('createEngine', () => {
  it('loads a random graph and summarizes it', async () => {
    const engine = newEngine()
    const summary = await engine.loadGraph({ kind: 'random', n: 30, p: 0.2, seed: 4 })
    const g = randomGraph(30, 0.2, 4)
    expect(summary.n).toBe(30)
    expect(summary.edgeCount).toBe(g.edgeCount)
    expect(summary.edges.length).toBe(2 * g.edgeCount)
    for (let k = 0; k < summary.edges.length; k += 2) expect(summary.edges[k]).toBeLessThan(summary.edges[k + 1])
    expect(summary.colorableCount).toBe([...g.colorable].filter(Boolean).length)
  })

  it('loads a dataset and reproduces the C result', async () => {
    const engine = newEngine()
    const summary = await engine.loadGraph({ kind: 'dataset', id: 'yeast' })
    expect(summary.n).toBe(2361)
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: false })).numColors).toBe(12)
  })

  it('requires a graph, a distance and a first coloring in that order', async () => {
    const engine = newEngine()
    await expect(engine.setDistance(1)).rejects.toThrow('No graph loaded')
    await engine.loadGraph({ kind: 'random', n: 10, p: 0.3, seed: 1 })
    await expect(engine.colorFirst({ trace: false })).rejects.toThrow('Distance not set')
    await engine.setDistance(1)
    await expect(engine.improve(1, 1)).rejects.toThrow('Color the graph first')
  })

  it('records a trace only up to STEP_LIMIT vertices', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 300, p: 0.02, seed: 1 })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: true })).trace).toBeDefined()
    await engine.loadGraph({ kind: 'random', n: 301, p: 0.02, seed: 1 })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: true })).trace).toBeUndefined()
  })

  it('continues the round numbering across improve calls', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 60, p: 0.15, seed: 8 })
    await engine.setDistance(2)
    const first = await engine.colorFirst({ trace: false })
    const a = await engine.improve(2, 5)
    const b = await engine.improve(2, 5)

    const g = randomGraph(60, 0.15, 8)
    const nb = distanceNeighborhoods(g, 2)
    const expected = improve(g, nb, greedyColoring(g, nb, naturalOrder(60)), 4, 5)
    expect(first.numColors).toBe(greedyColoring(g, nb, naturalOrder(60)).numColors)
    expect([...a, ...b].map((r) => [...r.colorOf])).toEqual(expected.map((r) => [...r.colorOf]))
  })

  it('setDistance and loadGraph discard the previous coloring', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 20, p: 0.3, seed: 2 })
    await engine.setDistance(1)
    await engine.colorFirst({ trace: false })
    await engine.setDistance(2)
    await expect(engine.improve(1, 1)).rejects.toThrow('Color the graph first')
  })

  it('reports progress and the neighbor count', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 80, p: 0.05, seed: 3 })
    const seen: number[] = []
    const summary = await engine.setDistance(2, (f) => seen.push(f))
    expect(seen.at(-1)).toBe(1)
    expect(summary.neighborEntries).toBe(distanceNeighborhoods(randomGraph(80, 0.05, 3), 2).neighbors.length)
  })

  it('rejects a distance above the limit with a TooLargeError and stays usable', async () => {
    const reference = newEngine()
    await reference.loadGraph({ kind: 'random', n: 60, p: 0.1, seed: 7 })
    const d1 = await reference.setDistance(1)

    const engine = newEngine(d1.neighborEntries)
    await engine.loadGraph({ kind: 'random', n: 60, p: 0.1, seed: 7 })
    await expect(engine.setDistance(3)).rejects.toMatchObject({ name: 'TooLargeError' })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: false })).numColors).toBeGreaterThan(0)
  })

  it('reports parse errors by name', async () => {
    const engine = createEngine({ loadDataset: async () => 'not a graph' })
    await expect(engine.loadGraph({ kind: 'dataset', id: 'DC' })).rejects.toMatchObject({ name: 'GraphParseError' })
  })
})
