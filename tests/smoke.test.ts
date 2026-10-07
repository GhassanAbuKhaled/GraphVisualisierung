import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('bundles the three datasets', () => {
  for (const name of ['yeast', 'minnesota', 'DC']) {
    const text = readFileSync(new URL(`../public/data/${name}.txt`, import.meta.url), 'utf8')
    expect(text.startsWith('vertices, edges, edgesProbability')).toBe(true)
  }
})
