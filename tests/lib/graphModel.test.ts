import { expect, it } from 'vitest'
import { toGraphology } from '@/lib/graphModel'

it('converts a summary into a graphology graph', () => {
  const g = toGraphology({ n: 4, edgeCount: 2, colorableCount: 3, edges: new Int32Array([0, 1, 1, 2]) })
  expect(g.order).toBe(4)
  expect(g.size).toBe(2)
  expect(g.hasEdge('0', '1')).toBe(true)
  expect(g.hasEdge('1', '2')).toBe(true)
  g.forEachNode((node, attributes) => {
    expect(attributes.label).toBe(node)
    expect(attributes.x).toBeGreaterThanOrEqual(0)
    expect(attributes.x).toBeLessThan(1)
    expect(attributes.y).toBeGreaterThanOrEqual(0)
    expect(attributes.y).toBeLessThan(1)
  })
})

it('places nodes reproducibly', () => {
  const summary = { n: 3, edgeCount: 0, colorableCount: 0, edges: new Int32Array() }
  expect(toGraphology(summary).export()).toEqual(toGraphology(summary).export())
})
