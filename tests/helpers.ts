import { createRng } from '@/core/rng'

/** Random undirected pairs for i < j, independent of randomGraph(). */
export function randomPairs(n: number, p: number, seed: number): number[] {
  const rng = createRng(seed * 7919 + 1)
  const pairs: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (rng.next() < p) pairs.push(i, j)
  }
  return pairs
}

/** Floyd–Warshall on an adjacency matrix. Only for small n. */
export function allPairsDistances(n: number, pairs: ArrayLike<number>): number[][] {
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
  )
  for (let k = 0; k < pairs.length; k += 2) {
    const u = pairs[k]
    const v = pairs[k + 1]
    if (u !== v) {
      dist[u][v] = 1
      dist[v][u] = 1
    }
  }
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) dist[i][j] = dist[i][k] + dist[k][j]
      }
    }
  }
  return dist
}

/** Lists every rule a distance-d coloring breaks; empty means valid. */
export function coloringProblems(
  n: number,
  pairs: ArrayLike<number>,
  d: number,
  colorOf: Int32Array,
): string[] {
  const problems: string[] = []
  const inEdge = new Array(n).fill(false)
  for (let k = 0; k < pairs.length; k++) inEdge[pairs[k]] = true
  for (let v = 0; v < n; v++) {
    if (inEdge[v] && colorOf[v] < 0) problems.push(`vertex ${v} has edges but no color`)
    if (!inEdge[v] && colorOf[v] >= 0) problems.push(`vertex ${v} has no edges but a color`)
  }
  const dist = allPairsDistances(n, pairs)
  for (let u = 0; u < n; u++) {
    for (let v = u + 1; v < n; v++) {
      if (colorOf[u] >= 0 && colorOf[u] === colorOf[v] && dist[u][v] <= d) {
        problems.push(`vertices ${u} and ${v} share color ${colorOf[u]} at distance ${dist[u][v]}`)
      }
    }
  }
  return problems
}
