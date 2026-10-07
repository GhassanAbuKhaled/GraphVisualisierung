import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { greedyColoring, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { parseGraphFile } from '@/core/parser'

// First-round color counts of the C program (Abschlussprojekt), recorded 2026-10-07.
const C_RESULTS: Record<string, [number, number, number]> = {
  yeast: [12, 65, 239],
  minnesota: [4, 7, 12],
  DC: [4, 9, 15],
}

describe('parity with the C program', () => {
  for (const [name, expected] of Object.entries(C_RESULTS)) {
    it(`${name}: first round matches for d = 1, 2, 3`, () => {
      const text = readFileSync(new URL(`../../public/data/${name}.txt`, import.meta.url), 'utf8')
      const g = parseGraphFile(text)
      const counts = [1, 2, 3].map(
        (d) => greedyColoring(g, distanceNeighborhoods(g, d), naturalOrder(g.n)).numColors,
      )
      expect(counts).toEqual(expected)
    })
  }
})
