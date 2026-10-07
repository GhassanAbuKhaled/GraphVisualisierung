/**
 * Undirected graph in CSR form, like the C project's CSRMatrix.
 * Neighbors of v are neighbors[offsets[v] .. offsets[v + 1]), sorted, without self-loops.
 */
export interface Graph {
  readonly n: number
  readonly offsets: Int32Array
  readonly neighbors: Int32Array
  /** 1 if the vertex appears in at least one edge (self-loops count), as in the C program. */
  readonly colorable: Uint8Array
  /** Number of undirected edges, self-loops excluded. */
  readonly edgeCount: number
}

function checkVertex(v: number, n: number): void {
  if (!Number.isInteger(v) || v < 0 || v >= n) {
    throw new RangeError(`vertex ${v} out of range (n = ${n})`)
  }
}

/** Builds a graph from flat undirected pairs [u0, v0, u1, v1, ...]. Duplicates are merged. */
export function buildGraph(n: number, edgePairs: ArrayLike<number>): Graph {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid vertex count ${n}`)
  if (edgePairs.length % 2 !== 0) throw new RangeError('edgePairs must contain pairs')

  const colorable = new Uint8Array(n)
  const degree = new Int32Array(n)
  for (let i = 0; i < edgePairs.length; i += 2) {
    const u = edgePairs[i]
    const v = edgePairs[i + 1]
    checkVertex(u, n)
    checkVertex(v, n)
    colorable[u] = 1
    colorable[v] = 1
    if (u !== v) {
      degree[u]++
      degree[v]++
    }
  }

  // Fill both directions, still with duplicates
  const rawOffsets = new Int32Array(n + 1)
  for (let v = 0; v < n; v++) rawOffsets[v + 1] = rawOffsets[v] + degree[v]
  const raw = new Int32Array(rawOffsets[n])
  const cursor = rawOffsets.slice(0, n)
  for (let i = 0; i < edgePairs.length; i += 2) {
    const u = edgePairs[i]
    const v = edgePairs[i + 1]
    if (u === v) continue
    raw[cursor[u]++] = v
    raw[cursor[v]++] = u
  }

  // Sort and deduplicate every row
  const offsets = new Int32Array(n + 1)
  const neighbors = new Int32Array(raw.length)
  let size = 0
  for (let v = 0; v < n; v++) {
    offsets[v] = size
    const row = raw.subarray(rawOffsets[v], rawOffsets[v + 1]).sort()
    for (let i = 0; i < row.length; i++) {
      if (i === 0 || row[i] !== row[i - 1]) neighbors[size++] = row[i]
    }
  }
  offsets[n] = size

  return { n, offsets, neighbors: neighbors.slice(0, size), colorable, edgeCount: size / 2 }
}

export function neighborsOf(g: Graph, v: number): Int32Array {
  return g.neighbors.subarray(g.offsets[v], g.offsets[v + 1])
}
