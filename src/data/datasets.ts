import type { DatasetId } from '@/engine/types'

export interface Dataset {
  id: DatasetId
  file: string
  vertices: number
}

/** Graphs from the Abschlussprojekt C project, served from public/data. */
export const DATASETS: readonly Dataset[] = [
  { id: 'yeast', file: 'yeast.txt', vertices: 2361 },
  { id: 'minnesota', file: 'minnesota.txt', vertices: 2642 },
  { id: 'DC', file: 'DC.txt', vertices: 9522 },
]
