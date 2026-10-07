import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { DATASETS } from '@/data/datasets'
import { parseGraphFile } from '@/core/parser'

it('lists every bundled dataset with its real vertex count', () => {
  expect(DATASETS.map((d) => d.id)).toEqual(['yeast', 'minnesota', 'DC'])
  for (const dataset of DATASETS) {
    const text = readFileSync(new URL(`../../public/data/${dataset.file}`, import.meta.url), 'utf8')
    expect(parseGraphFile(text).n).toBe(dataset.vertices)
  }
})
