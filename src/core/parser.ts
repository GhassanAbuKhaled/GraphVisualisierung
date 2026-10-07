import { buildGraph, type Graph } from './graph'

export class GraphParseError extends Error {
  readonly line: number

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`)
    this.name = 'GraphParseError'
    this.line = line
  }
}

const HEADER = /^vertices,\s*edges,\s*edgesProbability\s+(\d+)\s*,\s*(\d+)/
const EDGE = /^e\s+(\d+)\s+(\d+)$/

/** Parses the C project's format: a header line, then one "e <u> <v>" line per edge. */
export function parseGraphFile(text: string): Graph {
  const lines = text.split(/\r?\n/)
  const header = HEADER.exec(lines[0].trim())
  if (!header) {
    throw new GraphParseError(1, 'expected "vertices, edges, edgesProbability <n>, <m>, <p>"')
  }
  const n = Number(header[1])

  const pairs: number[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('e')) continue
    const edge = EDGE.exec(line)
    if (!edge) throw new GraphParseError(i + 1, `invalid edge "${line}"`)
    const u = Number(edge[1])
    const v = Number(edge[2])
    if (u >= n || v >= n) throw new GraphParseError(i + 1, `vertex out of range (n = ${n})`)
    pairs.push(u, v)
  }
  return buildGraph(n, pairs)
}
