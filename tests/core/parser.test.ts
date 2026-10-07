import { describe, expect, it } from 'vitest'
import { neighborsOf } from '@/core/graph'
import { GraphParseError, parseGraphFile } from '@/core/parser'

const SAMPLE = [
  'vertices, edges, edgesProbability 4, 4, 0.5',
  'e 0 0',
  'e 0 1',
  'e 1 0',
  'e 1 2',
  'e 2 1',
].join('\n')

function parseError(text: string): GraphParseError {
  try {
    parseGraphFile(text)
  } catch (error) {
    if (error instanceof GraphParseError) return error
    throw error
  }
  throw new Error('expected GraphParseError')
}

describe('parseGraphFile', () => {
  it('parses the header and the edges', () => {
    const g = parseGraphFile(SAMPLE)
    expect(g.n).toBe(4)
    expect(g.edgeCount).toBe(2)
    expect([...neighborsOf(g, 1)]).toEqual([0, 2])
    expect([...g.colorable]).toEqual([1, 1, 1, 0])
  })

  it('accepts spaces before the commas in the header (graph.txt style)', () => {
    const g = parseGraphFile('vertices, edges, edgesProbability 5000 , 1 , 0.010\ne 0 1\ne 1 0')
    expect(g.n).toBe(5000)
  })

  it('accepts Windows line endings and a trailing newline', () => {
    const g = parseGraphFile(SAMPLE.replaceAll('\n', '\r\n') + '\r\n')
    expect(g.edgeCount).toBe(2)
  })

  it('accepts a header without edges', () => {
    const g = parseGraphFile('vertices, edges, edgesProbability 3, 0, 0.000\n')
    expect(g.n).toBe(3)
    expect(g.edgeCount).toBe(0)
  })

  it('ignores lines that do not start with "e", like the C program', () => {
    const g = parseGraphFile(SAMPLE + '\n\n# comment\n')
    expect(g.edgeCount).toBe(2)
  })

  it('reports a bad header on line 1', () => {
    expect(parseError('hello\ne 0 1').line).toBe(1)
  })

  it('reports a malformed edge with its line number', () => {
    const error = parseError(SAMPLE + '\ne 3')
    expect(error.line).toBe(7)
    expect(error.message).toContain('Line 7')
  })

  it('reports a vertex out of range with its line number', () => {
    expect(parseError(SAMPLE + '\ne 1 4').line).toBe(7)
  })
})
