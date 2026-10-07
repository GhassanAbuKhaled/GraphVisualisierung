import { describe, expect, it } from 'vitest'
import { classColor, TABLEAU10, UNCOLORED } from '@/lib/colors'

describe('classColor', () => {
  it('uses the Tableau 10 palette for the first ten classes', () => {
    expect(Array.from({ length: 10 }, (_, i) => classColor(i))).toEqual([...TABLEAU10])
  })

  it('returns valid, distinct hex colors for many classes', () => {
    const colors = Array.from({ length: 400 }, (_, i) => classColor(i))
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(colors.slice(0, 100)).size).toBe(100)
  })

  it('returns gray for uncolored vertices', () => {
    expect(classColor(-1)).toBe(UNCOLORED)
    expect(TABLEAU10).not.toContain(UNCOLORED)
  })
})
