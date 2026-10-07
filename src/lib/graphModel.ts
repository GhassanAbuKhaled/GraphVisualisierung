import Graph from 'graphology'
import { createRng } from '@/core/rng'
import type { GraphSummary } from '@/engine/types'

/** Builds the graphology graph Sigma draws; positions are random but reproducible. */
export function toGraphology(summary: GraphSummary): Graph {
  const graph = new Graph({ type: 'undirected', multi: false })
  const rng = createRng(summary.n)
  for (let v = 0; v < summary.n; v++) {
    graph.addNode(String(v), { x: rng.next(), y: rng.next(), size: 4, label: String(v) })
  }
  for (let k = 0; k < summary.edges.length; k += 2) {
    graph.addEdge(String(summary.edges[k]), String(summary.edges[k + 1]))
  }
  return graph
}
