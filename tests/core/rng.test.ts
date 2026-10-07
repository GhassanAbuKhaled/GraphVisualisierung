import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'

describe('createRng', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('returns different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean)
    expect(same.length).toBeLessThan(20)
  })

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int(m) is roughly uniform over 0..m-1', () => {
    const rng = createRng(123)
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 100_000; i++) counts[rng.int(10)]++
    for (const c of counts) {
      expect(c).toBeGreaterThan(9_000)
      expect(c).toBeLessThan(11_000)
    }
  })
})
