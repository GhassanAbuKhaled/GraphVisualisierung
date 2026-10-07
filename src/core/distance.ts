import type { Graph } from './graph'

/** For every vertex v: all u != v with 1 <= dist(v, u) <= d, as sorted CSR rows. */
export interface Neighborhoods {
  readonly d: number
  readonly offsets: Int32Array
  readonly neighbors: Int32Array
}

export const MAX_NEIGHBOR_ENTRIES = 20_000_000

export class TooLargeError extends Error {
  readonly limit: number

  constructor(limit: number) {
    super(`The distance-d graph has more than ${limit} neighbor entries`)
    this.name = 'TooLargeError'
    this.limit = limit
  }
}

export interface DistanceOptions {
  limit?: number
  onProgress?: (fraction: number) => void
}

/** Depth-limited BFS from every colorable vertex, as calculateDistance__d in bfs.c. */
export function distanceNeighborhoods(g: Graph, d: number, options: DistanceOptions = {}): Neighborhoods {
  if (!Number.isInteger(d) || d < 1) throw new RangeError(`d must be a positive integer, got ${d}`)
  const limit = options.limit ?? MAX_NEIGHBOR_ENTRIES

  if (d === 1) {
    if (g.neighbors.length > limit) throw new TooLargeError(limit)
    options.onProgress?.(1)
    return { d, offsets: g.offsets, neighbors: g.neighbors }
  }

  const { n, offsets: adjOffsets, neighbors: adj } = g
  const offsets = new Int32Array(n + 1)
  let out = new Int32Array(Math.min(limit, Math.max(16, adj.length * 2)))
  let size = 0

  const visitedFrom = new Int32Array(n).fill(-1) // visitedFrom[u] === s: u reached in the BFS from s
  const depth = new Int32Array(n)
  const queue = new Int32Array(n)
  const progressStep = Math.max(1, Math.floor(n / 100))

  for (let s = 0; s < n; s++) {
    offsets[s] = size
    if (g.colorable[s]) {
      let head = 0
      let tail = 0
      queue[tail++] = s
      visitedFrom[s] = s
      depth[s] = 0
      while (head < tail) {
        const x = queue[head++]
        if (depth[x] === d) continue
        for (let k = adjOffsets[x]; k < adjOffsets[x + 1]; k++) {
          const y = adj[k]
          if (visitedFrom[y] === s) continue
          visitedFrom[y] = s
          depth[y] = depth[x] + 1
          queue[tail++] = y
          if (size === limit) throw new TooLargeError(limit)
          if (size === out.length) {
            const grown = new Int32Array(Math.min(limit, out.length * 2))
            grown.set(out)
            out = grown
          }
          out[size++] = y
        }
      }
      out.subarray(offsets[s], size).sort()
    }
    if (options.onProgress && (s % progressStep === 0 || s === n - 1)) {
      options.onProgress((s + 1) / n)
    }
  }
  offsets[n] = size
  return { d, offsets, neighbors: out.slice(0, size) }
}
