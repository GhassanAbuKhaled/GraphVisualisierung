# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-JS page with a Vite + React + TypeScript project and implement the pure-TypeScript algorithm core (`src/core/`) so that it reproduces the C program's first-round color counts exactly.

**Architecture:** `src/core/` is framework-free TypeScript (no React, no DOM, no worker APIs) operating on a CSR graph representation that mirrors the C project. Tests live in `tests/` and run with Vitest in Node. The React app in this phase is only a placeholder proving that Tailwind and shadcn/ui work; the real UI comes in phase 2.

**Tech Stack:** Vite 8, React 19, TypeScript (template default, strict), Tailwind CSS 4, shadcn/ui (radix base, `nova` preset), Vitest 5, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-07-graph-coloring-redesign-design.md` (sections 3 and 5 are implemented here; section 6.1/6.2 are the tests).

## Global Constraints

- Work on branch `redesign` in `/Users/ghassanabukhaled/Developer/GraphVisualisierung`.
- `src/core/` must not import React, DOM APIs, `node:*` modules or worker APIs.
- TypeScript `strict: true` for app and tests. The template enables `erasableSyntaxOnly`: no `enum`, no `namespace`, no constructor parameter properties (`constructor(public x)`).
- A vertex is colorable iff it appears in at least one edge line, self-loops included (spec §5.2).
- `N_d(v)` = vertices `u ≠ v` with 1 ≤ dist(v, u) ≤ d (spec §5.3). Size limit `MAX_NEIGHBOR_ENTRIES = 20_000_000`.
- First round visits vertices in order 0..n-1; improvement rounds shuffle classes with Fisher–Yates `for i = k-1 … 1: j = rng.int(i + 1)` and use `createRng(seed + round)` (spec §5.4, §5.5).
- Parity numbers (first round): yeast 12/65/239, minnesota 4/7/12, DC 4/9/15 for d = 1/2/3 (spec §6.2).
- Every task ends with `npm test`, `npx tsc -b` and `npm run lint` passing (lint warnings allowed, errors not).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Graph files with Windows line endings (`\r\n`)** — must parse exactly like `\n` files. Pinned in Task 3.
2. **Edges listed twice / in both directions** (all bundled files do this) — neighbors must be deduplicated and `edgeCount` must count each undirected edge once. Pinned in Task 3.
3. **Edge referencing a vertex ≥ n, or a malformed `e` line** — `GraphParseError` naming the 1-based line number, never a crash or silent garbage. Pinned in Task 3.
4. **Graphs with no edges at all (n = 1, or p = 0)** — distance and coloring return empty results (0 colors, every vertex uncolored) without throwing. Pinned in Tasks 5 and 6.
5. **d larger than the diameter, disconnected graphs** — BFS stays inside each component and terminates; neighborhoods equal the component minus the vertex. Pinned in Task 5.

---

## File Structure

```
GraphVisualisierung/
├── index.html                 (replaced: Vite entry)
├── package.json               (new)
├── vite.config.ts             (new: react, tailwind, @ alias, vitest)
├── tsconfig.json              (new: references app, node, test)
├── tsconfig.app.json          (new: src, strict)
├── tsconfig.node.json         (new: vite.config.ts)
├── tsconfig.test.json         (new: tests + src/core, node types)
├── components.json            (new: shadcn)
├── .oxlintrc.json             (new: from template)
├── .gitignore                 (new: from template)
├── public/data/               (new: yeast.txt, minnesota.txt, DC.txt)
├── src/
│   ├── main.tsx, App.tsx, index.css     (placeholder app)
│   ├── components/ui/button.tsx, lib/utils.ts  (shadcn)
│   └── core/
│       ├── rng.ts             seeded PRNG
│       ├── graph.ts           Graph type + buildGraph
│       ├── parser.ts          C file format → Graph
│       ├── random.ts          G(n, p) generator
│       ├── distance.ts        distance-d neighborhoods
│       └── coloring.ts        greedy coloring, trace, improvement
└── tests/
    ├── helpers.ts             independent brute-force checks
    └── core/
        ├── rng.test.ts
        ├── graph.test.ts
        ├── parser.test.ts
        ├── random.test.ts
        ├── distance.test.ts
        ├── coloring.test.ts
        ├── improve.test.ts
        └── parity.test.ts
```

Deleted: `app.js`, `RandomGraph.js`, `ProduktGraph.js`, `GraphColoring.js`, `style.css`, old `index.html`. `README.md` stays untouched until phase 5.

---

### Task 1: Project scaffold

**Files:**
- Delete: `app.js`, `RandomGraph.js`, `ProduktGraph.js`, `GraphColoring.js`, `style.css`, `index.html`
- Create (from template): `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.oxlintrc.json`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `tsconfig.test.json`, `tests/smoke.test.ts`, `public/data/{yeast,minnesota,DC}.txt`
- Create (by shadcn): `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts`

**Interfaces:**
- Produces: `npm test` (Vitest over `tests/**/*.test.ts`), `npm run build`, `npm run lint`; import alias `@/` → `src/`.

- [ ] **Step 1: Remove the old plain-JS files**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git rm -q app.js RandomGraph.js ProduktGraph.js GraphColoring.js style.css index.html
```

- [ ] **Step 2: Scaffold the Vite template into a temporary folder and move it in**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npm create vite@latest .scaffold -- --template react-ts --no-interactive
rm .scaffold/README.md
rm -rf .scaffold/src/assets .scaffold/src/App.css .scaffold/public/*
cp -R .scaffold/. .
rm -rf .scaffold
npm pkg set name=graph-coloring-visualizer
npm install
```

Expected: `package.json` has scripts `dev`, `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview`.

- [ ] **Step 3: Install Tailwind and Vitest**

```bash
npm install tailwindcss @tailwindcss/vite
npm install -D vitest
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/GraphVisualisierung/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Configure TypeScript (strict, alias, test project)**

In `tsconfig.app.json`, add inside `compilerOptions` (keep all template options):

```json
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
```

Replace `tsconfig.json` with:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.test.json" }
  ],
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

(The root `paths` entry is required by `shadcn init` to validate the alias.)

Create `tsconfig.test.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["tests", "src/core"]
}
```

- [ ] **Step 6: Initialize Tailwind and shadcn/ui**

```bash
echo '@import "tailwindcss";' > src/index.css
npx shadcn@latest init -t vite -b radix -p nova -y --no-monorepo --no-rtl < /dev/null
```

Expected output ends with `Project initialization completed.` and creates `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts`; `src/index.css` now contains the theme variables and a `.dark` block. If the command waits for input, stop it and re-run with the flags exactly as shown (the `< /dev/null` matters).

- [ ] **Step 7: Placeholder app**

`src/App.tsx`:

```tsx
import { Button } from '@/components/ui/button'

export default function App() {
  return (
    <main className="dark flex min-h-svh items-center justify-center bg-background text-foreground">
      <Button>Graph Coloring — redesign in progress</Button>
    </main>
  )
}
```

`src/main.tsx` stays as generated by the template (it imports `./index.css` and renders `<App />`). In `index.html` set `<title>Graph Coloring Visualizer</title>` and delete the `<link rel="icon" … href="/vite.svg" />` line (that file was removed in Step 2; a real icon comes in phase 2).

- [ ] **Step 8: Bundle the datasets**

```bash
mkdir -p public/data
cp /Users/ghassanabukhaled/Developer/Abschlussprojekt/data/{yeast,minnesota,DC}.txt public/data/
```

- [ ] **Step 9: Smoke test**

`tests/smoke.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('bundles the three datasets', () => {
  for (const name of ['yeast', 'minnesota', 'DC']) {
    const text = readFileSync(new URL(`../public/data/${name}.txt`, import.meta.url), 'utf8')
    expect(text.startsWith('vertices, edges, edgesProbability')).toBe(true)
  }
})
```

- [ ] **Step 10: Verify everything**

```bash
npm test && npx tsc -b && npm run lint && npm run build
```

Expected: 1 test passed; no TypeScript errors; lint shows at most a warning in `button.tsx`; build prints `✓ built`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TypeScript project with Tailwind, shadcn/ui and Vitest

Removes the plain-JS page (still available on main) and bundles the
yeast, minnesota and DC datasets from Abschlussprojekt.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Seeded random number generator

**Files:**
- Create: `src/core/rng.ts`
- Test: `tests/core/rng.test.ts`

**Interfaces:**
- Produces: `interface Rng { next(): number; int(maxExclusive: number): number }`, `createRng(seed: number): Rng`

- [ ] **Step 1: Write the failing test**

`tests/core/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'

describe('createRng', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('returns different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean)
    expect(same.length).toBeLessThan(20)
  })

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int(m) is roughly uniform over 0..m-1', () => {
    const rng = createRng(123)
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 100_000; i++) counts[rng.int(10)]++
    for (const c of counts) {
      expect(c).toBeGreaterThan(9_000)
      expect(c).toBeLessThan(11_000)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/rng.test.ts`
Expected: FAIL — cannot resolve `@/core/rng`.

- [ ] **Step 3: Implement**

`src/core/rng.ts`:

```ts
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number
}

/** Seeded PRNG (mulberry32): same seed, same sequence. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, int: (maxExclusive) => Math.floor(next() * maxExclusive) }
}
```

- [ ] **Step 4: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts tests/core/rng.test.ts
git commit -m "Add seeded random number generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Graph type, builder and file parser

**Files:**
- Create: `src/core/graph.ts`, `src/core/parser.ts`
- Test: `tests/core/graph.test.ts`, `tests/core/parser.test.ts`

**Interfaces:**
- Produces:
  - `interface Graph { readonly n: number; readonly offsets: Int32Array; readonly neighbors: Int32Array; readonly colorable: Uint8Array; readonly edgeCount: number }`
  - `buildGraph(n: number, edgePairs: ArrayLike<number>): Graph` — `edgePairs` is flat `[u0, v0, u1, v1, …]`, each pair undirected
  - `neighborsOf(g: Graph, v: number): Int32Array`
  - `class GraphParseError extends Error { readonly line: number }`
  - `parseGraphFile(text: string): Graph`

- [ ] **Step 1: Write the failing graph tests**

`tests/core/graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildGraph, neighborsOf } from '@/core/graph'

describe('buildGraph', () => {
  it('builds sorted CSR neighbor lists', () => {
    const g = buildGraph(4, [0, 2, 0, 1, 2, 3])
    expect(g.n).toBe(4)
    expect([...neighborsOf(g, 0)]).toEqual([1, 2])
    expect([...neighborsOf(g, 2)]).toEqual([0, 3])
    expect(g.edgeCount).toBe(3)
  })

  it('deduplicates edges listed twice or in both directions', () => {
    const g = buildGraph(3, [0, 1, 1, 0, 0, 1, 1, 2, 2, 1])
    expect([...neighborsOf(g, 1)]).toEqual([0, 2])
    expect(g.edgeCount).toBe(2)
  })

  it('drops self-loops from neighbors but marks the vertex colorable', () => {
    const g = buildGraph(3, [0, 0, 1, 2])
    expect([...neighborsOf(g, 0)]).toEqual([])
    expect([...g.colorable]).toEqual([1, 1, 1])
    expect(g.edgeCount).toBe(1)
  })

  it('leaves vertices without edges uncolorable', () => {
    const g = buildGraph(4, [0, 1])
    expect([...g.colorable]).toEqual([1, 1, 0, 0])
  })

  it('accepts a graph without edges', () => {
    const g = buildGraph(1, [])
    expect(g.edgeCount).toBe(0)
    expect([...g.offsets]).toEqual([0, 0])
  })

  it('rejects vertices out of range', () => {
    expect(() => buildGraph(2, [0, 2])).toThrow(RangeError)
    expect(() => buildGraph(2, [-1, 0])).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/graph.test.ts`
Expected: FAIL — cannot resolve `@/core/graph`.

- [ ] **Step 3: Implement `src/core/graph.ts`**

```ts
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
```

- [ ] **Step 4: Run graph tests**

Run: `npx vitest run tests/core/graph.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing parser tests**

`tests/core/parser.test.ts`:

```ts
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
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: FAIL — cannot resolve `@/core/parser`.

- [ ] **Step 7: Implement `src/core/parser.ts`**

```ts
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
```

- [ ] **Step 8: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/graph.ts src/core/parser.ts tests/core/graph.test.ts tests/core/parser.test.ts
git commit -m "Add CSR graph builder and graph file parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Random graph generator and test helpers

**Files:**
- Create: `src/core/random.ts`, `tests/helpers.ts`
- Test: `tests/core/random.test.ts`

**Interfaces:**
- Consumes: `createRng` (Task 2), `buildGraph`, `Graph` (Task 3)
- Produces:
  - `randomGraph(n: number, p: number, seed: number): Graph`
  - test helpers (used by Tasks 5–7): `randomPairs(n: number, p: number, seed: number): number[]`, `allPairsDistances(n: number, pairs: ArrayLike<number>): number[][]` (`Infinity` if unreachable), `coloringProblems(n: number, pairs: ArrayLike<number>, d: number, colorOf: Int32Array): string[]`

- [ ] **Step 1: Write the helpers (independent of `src/core` graph code)**

`tests/helpers.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing random graph tests**

`tests/core/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { neighborsOf } from '@/core/graph'
import { randomGraph } from '@/core/random'

describe('randomGraph', () => {
  it('is reproducible for the same seed', () => {
    const a = randomGraph(50, 0.3, 9)
    const b = randomGraph(50, 0.3, 9)
    expect([...a.neighbors]).toEqual([...b.neighbors])
    expect([...a.offsets]).toEqual([...b.offsets])
  })

  it('differs for different seeds', () => {
    expect([...randomGraph(50, 0.3, 1).neighbors]).not.toEqual([...randomGraph(50, 0.3, 2).neighbors])
  })

  it('is symmetric and has no self-loops', () => {
    const g = randomGraph(40, 0.5, 3)
    for (let v = 0; v < g.n; v++) {
      for (const u of neighborsOf(g, v)) {
        expect(u).not.toBe(v)
        expect([...neighborsOf(g, u)]).toContain(v)
      }
    }
  })

  it('has about p * n(n-1)/2 edges', () => {
    const g = randomGraph(200, 0.1, 5)
    const expected = 0.1 * (200 * 199) / 2
    expect(g.edgeCount).toBeGreaterThan(expected * 0.85)
    expect(g.edgeCount).toBeLessThan(expected * 1.15)
  })

  it('handles p = 0 and p = 1', () => {
    expect(randomGraph(10, 0, 1).edgeCount).toBe(0)
    expect(randomGraph(10, 1, 1).edgeCount).toBe(45)
  })

  it('rejects invalid arguments', () => {
    expect(() => randomGraph(0, 0.5, 1)).toThrow(RangeError)
    expect(() => randomGraph(10, 1.5, 1)).toThrow(RangeError)
    expect(() => randomGraph(2.5, 0.5, 1)).toThrow(RangeError)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/core/random.test.ts`
Expected: FAIL — cannot resolve `@/core/random`.

- [ ] **Step 4: Implement `src/core/random.ts`**

```ts
import { buildGraph, type Graph } from './graph'
import { createRng } from './rng'

/** Erdős–Rényi G(n, p): every pair i < j is connected with probability p. */
export function randomGraph(n: number, p: number, seed: number): Graph {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`invalid vertex count ${n}`)
  if (!(p >= 0 && p <= 1)) throw new RangeError(`invalid edge probability ${p}`)

  const rng = createRng(seed)
  const pairs: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rng.next() < p) pairs.push(i, j)
    }
  }
  return buildGraph(n, pairs)
}
```

- [ ] **Step 5: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/random.ts tests/helpers.ts tests/core/random.test.ts
git commit -m "Add seeded random graph generator and brute-force test helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Distance-d neighborhoods

**Files:**
- Create: `src/core/distance.ts`
- Test: `tests/core/distance.test.ts`

**Interfaces:**
- Consumes: `Graph`, `buildGraph`, `neighborsOf` (Task 3); helpers `randomPairs`, `allPairsDistances` (Task 4)
- Produces:
  - `interface Neighborhoods { readonly d: number; readonly offsets: Int32Array; readonly neighbors: Int32Array }`
  - `const MAX_NEIGHBOR_ENTRIES = 20_000_000`
  - `class TooLargeError extends Error { readonly limit: number }`
  - `interface DistanceOptions { limit?: number; onProgress?: (fraction: number) => void }`
  - `distanceNeighborhoods(g: Graph, d: number, options?: DistanceOptions): Neighborhoods`

- [ ] **Step 1: Write the failing tests**

`tests/core/distance.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { distanceNeighborhoods, TooLargeError } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { allPairsDistances, randomPairs } from '../helpers'

function row(nb: { offsets: Int32Array; neighbors: Int32Array }, v: number): number[] {
  return [...nb.neighbors.subarray(nb.offsets[v], nb.offsets[v + 1])]
}

describe('distanceNeighborhoods', () => {
  it('matches brute-force distances on random graphs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const n = 10 + (seed % 40)
      const pairs = randomPairs(n, 0.08, seed)
      const g = buildGraph(n, pairs)
      const dist = allPairsDistances(n, pairs)
      for (let d = 1; d <= 4; d++) {
        const nb = distanceNeighborhoods(g, d)
        for (let v = 0; v < n; v++) {
          const expected = []
          for (let u = 0; u < n; u++) if (u !== v && dist[v][u] <= d) expected.push(u)
          expect(row(nb, v), `seed ${seed}, d ${d}, vertex ${v}`).toEqual(expected)
        }
      }
    }
  })

  it('stays inside components when d exceeds the diameter', () => {
    // path 0-1-2-3 and separate edge 4-5
    const g = buildGraph(6, [0, 1, 1, 2, 2, 3, 4, 5])
    const nb = distanceNeighborhoods(g, 10)
    expect(row(nb, 0)).toEqual([1, 2, 3])
    expect(row(nb, 4)).toEqual([5])
  })

  it('returns empty neighborhoods for a graph without edges', () => {
    const nb = distanceNeighborhoods(buildGraph(3, []), 2)
    expect([...nb.offsets]).toEqual([0, 0, 0, 0])
    expect(nb.neighbors.length).toBe(0)
  })

  it('ignores self-loops', () => {
    const nb = distanceNeighborhoods(buildGraph(3, [0, 0, 0, 1]), 2)
    expect(row(nb, 0)).toEqual([1])
  })

  it('reports progress up to 1', () => {
    const g = buildGraph(50, randomPairs(50, 0.1, 3))
    const seen: number[] = []
    distanceNeighborhoods(g, 2, { onProgress: (f) => seen.push(f) })
    expect(seen.at(-1)).toBe(1)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  })

  it('throws TooLargeError above the limit', () => {
    const complete: number[] = []
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) complete.push(i, j)
    const g = buildGraph(20, complete)
    expect(() => distanceNeighborhoods(g, 2, { limit: 100 })).toThrow(TooLargeError)
    expect(() => distanceNeighborhoods(g, 1, { limit: 100 })).toThrow(TooLargeError)
    expect(distanceNeighborhoods(g, 2, { limit: 380 }).neighbors.length).toBe(380)
  })

  it('rejects d < 1', () => {
    expect(() => distanceNeighborhoods(buildGraph(2, [0, 1]), 0)).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/distance.test.ts`
Expected: FAIL — cannot resolve `@/core/distance`.

- [ ] **Step 3: Implement `src/core/distance.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass. (For an empty graph with n = 0, `onProgress` is never called — acceptable; n ≥ 1 for every source.)

- [ ] **Step 5: Commit**

```bash
git add src/core/distance.ts tests/core/distance.test.ts
git commit -m "Add distance-d neighborhoods via depth-limited BFS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Greedy coloring with step trace

**Files:**
- Create: `src/core/coloring.ts`
- Test: `tests/core/coloring.test.ts`

**Interfaces:**
- Consumes: `Graph`, `buildGraph` (Task 3), `Neighborhoods`, `distanceNeighborhoods` (Task 5), helpers `randomPairs`, `coloringProblems` (Task 4)
- Produces:
  - `interface Step { vertex: number; rejected: { classIndex: number; witness: number }[]; placedIn: number; createdNewClass: boolean }`
  - `interface ColoringResult { colorOf: Int32Array; classes: number[][]; numColors: number; trace?: Step[] }`
  - `naturalOrder(n: number): Int32Array`
  - `greedyColoring(g: Graph, nb: Neighborhoods, order: ArrayLike<number>, options?: { trace?: boolean }): ColoringResult`

- [ ] **Step 1: Write the failing tests**

`tests/core/coloring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { greedyColoring, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { coloringProblems, randomPairs } from '../helpers'

function firstRound(n: number, pairs: number[], d: number, trace = false) {
  const g = buildGraph(n, pairs)
  return greedyColoring(g, distanceNeighborhoods(g, d), naturalOrder(n), { trace })
}

describe('greedyColoring', () => {
  it('colors a path with 2 colors at d = 1 and 3 colors at d = 2', () => {
    const path = [0, 1, 1, 2, 2, 3, 3, 4]
    expect([...firstRound(5, path, 1).colorOf]).toEqual([0, 1, 0, 1, 0])
    expect([...firstRound(5, path, 2).colorOf]).toEqual([0, 1, 2, 0, 1])
  })

  it('puts each vertex into the first class without conflict', () => {
    // 0-1, 0-2: vertex 3 is isolated, so it stays uncolored
    const result = firstRound(4, [0, 1, 0, 2], 1)
    expect(result.classes).toEqual([[0], [1, 2]])
    expect([...result.colorOf]).toEqual([0, 1, 1, -1])
    expect(result.numColors).toBe(2)
  })

  it('colors a vertex that only has a self-loop', () => {
    expect([...firstRound(2, [0, 0], 1).colorOf]).toEqual([0, -1])
  })

  it('returns 0 colors for a graph without edges', () => {
    const result = firstRound(3, [], 2)
    expect(result.numColors).toBe(0)
    expect([...result.colorOf]).toEqual([-1, -1, -1])
  })

  it('produces valid colorings on 500 random graphs', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const n = 5 + (seed % 36)
      const pairs = randomPairs(n, 0.05 + (seed % 7) * 0.05, seed)
      const d = 1 + (seed % 3)
      const result = firstRound(n, pairs, d)
      expect(coloringProblems(n, pairs, d, result.colorOf), `seed ${seed}`).toEqual([])
      expect(result.classes.flat().length).toBe([...result.colorOf].filter((c) => c >= 0).length)
    }
  })

  it('records a trace that explains every placement', () => {
    const pairs = [0, 1, 1, 2, 0, 2, 2, 3]
    const result = firstRound(4, pairs, 1, true)
    expect(result.trace).toEqual([
      { vertex: 0, rejected: [], placedIn: 0, createdNewClass: true },
      { vertex: 1, rejected: [{ classIndex: 0, witness: 0 }], placedIn: 1, createdNewClass: true },
      {
        vertex: 2,
        rejected: [
          { classIndex: 0, witness: 0 },
          { classIndex: 1, witness: 1 },
        ],
        placedIn: 2,
        createdNewClass: true,
      },
      // vertex 3's only neighbor is 2 (class 2), so class 0 is free
      { vertex: 3, rejected: [], placedIn: 0, createdNewClass: false },
    ])
  })

  it('replaying the trace reproduces colorOf', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const n = 30
      const result = firstRound(n, randomPairs(n, 0.15, seed), 2, true)
      const replay = new Int32Array(n).fill(-1)
      for (const step of result.trace ?? []) {
        for (const { classIndex, witness } of step.rejected) {
          expect(replay[witness]).toBe(classIndex)
        }
        replay[step.vertex] = step.placedIn
      }
      expect([...replay]).toEqual([...result.colorOf])
    }
  })

  it('omits the trace unless requested', () => {
    expect(firstRound(3, [0, 1], 1).trace).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/coloring.test.ts`
Expected: FAIL — cannot resolve `@/core/coloring`.

- [ ] **Step 3: Implement `src/core/coloring.ts`**

```ts
import type { Neighborhoods } from './distance'
import type { Graph } from './graph'

export interface Step {
  vertex: number
  /** Classes tried before placing the vertex, each with one conflicting member. */
  rejected: { classIndex: number; witness: number }[]
  placedIn: number
  createdNewClass: boolean
}

export interface ColoringResult {
  /** Class index per vertex; -1 = not colored (vertex without edges). */
  colorOf: Int32Array
  /** Members of every class in insertion order. */
  classes: number[][]
  numColors: number
  trace?: Step[]
}

export function naturalOrder(n: number): Int32Array {
  const order = new Int32Array(n)
  for (let v = 0; v < n; v++) order[v] = v
  return order
}

/**
 * Greedy coloring as greedyColoring in coloring.c: every vertex goes into the first
 * class that has no member within distance d (given by nb), else into a new class.
 */
export function greedyColoring(
  g: Graph,
  nb: Neighborhoods,
  order: ArrayLike<number>,
  options: { trace?: boolean } = {},
): ColoringResult {
  const colorOf = new Int32Array(g.n).fill(-1)
  const classes: number[][] = []
  const blockedAt: number[] = [] // blockedAt[c] === stamp: class c conflicts with the current vertex
  const witness: number[] = []
  const trace: Step[] | undefined = options.trace ? [] : undefined

  for (let i = 0; i < order.length; i++) {
    const v = order[i]
    if (!g.colorable[v] || colorOf[v] !== -1) continue
    const stamp = i + 1

    for (let k = nb.offsets[v]; k < nb.offsets[v + 1]; k++) {
      const u = nb.neighbors[k]
      const c = colorOf[u]
      if (c >= 0 && blockedAt[c] !== stamp) {
        blockedAt[c] = stamp
        witness[c] = u
      }
    }

    let c = 0
    while (c < classes.length && blockedAt[c] === stamp) c++
    const createdNewClass = c === classes.length
    if (createdNewClass) classes.push([])
    classes[c].push(v)
    colorOf[v] = c

    if (trace) {
      const rejected: Step['rejected'] = []
      for (let r = 0; r < c; r++) rejected.push({ classIndex: r, witness: witness[r] })
      trace.push({ vertex: v, rejected, placedIn: c, createdNewClass })
    }
  }

  return trace
    ? { colorOf, classes, numColors: classes.length, trace }
    : { colorOf, classes, numColors: classes.length }
}
```

- [ ] **Step 4: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/coloring.ts tests/core/coloring.test.ts
git commit -m "Add greedy distance-d coloring with step trace

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Improvement rounds

**Files:**
- Modify: `src/core/coloring.ts` (append)
- Test: `tests/core/improve.test.ts`

**Interfaces:**
- Consumes: `greedyColoring`, `naturalOrder`, `ColoringResult` (Task 6), `createRng`, `Rng` (Task 2)
- Produces:
  - `improvementOrder(g: Graph, previous: ColoringResult, rng: Rng): Int32Array`
  - `improve(g: Graph, nb: Neighborhoods, previous: ColoringResult, rounds: number, seed: number, firstRound?: number): ColoringResult[]` — round `r` (starting at `firstRound`, default 1) uses `createRng(seed + r)`; returns one result per round

- [ ] **Step 1: Write the failing tests**

`tests/core/improve.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { greedyColoring, improve, improvementOrder, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { buildGraph } from '@/core/graph'
import { createRng } from '@/core/rng'
import { coloringProblems, randomPairs } from '../helpers'

function setup(n: number, pairs: number[], d: number) {
  const g = buildGraph(n, pairs)
  const nb = distanceNeighborhoods(g, d)
  return { g, nb, first: greedyColoring(g, nb, naturalOrder(n)) }
}

describe('improvementOrder', () => {
  it('lists the vertices class by class, then the uncolored ones', () => {
    const { g, first } = setup(5, [0, 1, 0, 2], 1) // classes [[0], [1, 2]], 3 and 4 uncolored
    const order = [...improvementOrder(g, first, createRng(1))]
    expect(order.slice(3)).toEqual([3, 4])
    const head = order.slice(0, 3)
    expect([[0, 1, 2], [1, 2, 0]]).toContainEqual(head)
  })
})

describe('improve', () => {
  it('never increases the number of colors and stays valid', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = 40
      const pairs = randomPairs(n, 0.1 + (seed % 4) * 0.05, seed)
      const d = 1 + (seed % 2)
      const { g, nb, first } = setup(n, pairs, d)
      const rounds = improve(g, nb, first, 20, seed)
      expect(rounds.length).toBe(20)
      let previous = first.numColors
      for (const result of rounds) {
        expect(result.numColors).toBeLessThanOrEqual(previous)
        expect(coloringProblems(n, pairs, d, result.colorOf)).toEqual([])
        previous = result.numColors
      }
    }
  })

  it('is reproducible for the same seed', () => {
    const { g, nb, first } = setup(40, randomPairs(40, 0.2, 5), 1)
    const a = improve(g, nb, first, 5, 99).map((r) => [...r.colorOf])
    const b = improve(g, nb, first, 5, 99).map((r) => [...r.colorOf])
    expect(a).toEqual(b)
  })

  it('continues the round numbering with firstRound', () => {
    const { g, nb, first } = setup(40, randomPairs(40, 0.2, 6), 1)
    const all = improve(g, nb, first, 4, 7)
    const firstTwo = improve(g, nb, first, 2, 7)
    const lastTwo = improve(g, nb, firstTwo[1], 2, 7, 3)
    expect(lastTwo.map((r) => [...r.colorOf])).toEqual(all.slice(2).map((r) => [...r.colorOf]))
  })

  it('returns an empty list for 0 rounds', () => {
    const { g, nb, first } = setup(3, [0, 1], 1)
    expect(improve(g, nb, first, 0, 1)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/improve.test.ts`
Expected: FAIL — `improve` / `improvementOrder` are not exported.

- [ ] **Step 3: Implement (append to `src/core/coloring.ts`)**

Add to the imports at the top of the file:

```ts
import { createRng, type Rng } from './rng'
```

Append:

```ts
/**
 * Vertex order for the next round, as randomShuffleSets in set.c: shuffle the classes
 * (Fisher–Yates), list their members class by class, then the uncolored vertices.
 */
export function improvementOrder(g: Graph, previous: ColoringResult, rng: Rng): Int32Array {
  const classes = previous.classes.slice()
  for (let i = classes.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[classes[i], classes[j]] = [classes[j], classes[i]]
  }
  const order = new Int32Array(g.n)
  let k = 0
  for (const members of classes) for (const v of members) order[k++] = v
  for (let v = 0; v < g.n; v++) if (!g.colorable[v]) order[k++] = v
  return order
}

/** Runs improvement rounds; round r uses createRng(seed + r). Colors never increase. */
export function improve(
  g: Graph,
  nb: Neighborhoods,
  previous: ColoringResult,
  rounds: number,
  seed: number,
  firstRound = 1,
): ColoringResult[] {
  const results: ColoringResult[] = []
  let current = previous
  for (let r = firstRound; r < firstRound + rounds; r++) {
    current = greedyColoring(g, nb, improvementOrder(g, current, createRng(seed + r)))
    results.push(current)
  }
  return results
}
```

- [ ] **Step 4: Run tests and checks**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/coloring.ts tests/core/improve.test.ts
git commit -m "Add improvement rounds that reshuffle color classes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Parity with the C program

**Files:**
- Test: `tests/core/parity.test.ts`

**Interfaces:**
- Consumes: `parseGraphFile` (Task 3), `distanceNeighborhoods` (Task 5), `greedyColoring`, `naturalOrder` (Task 6)

- [ ] **Step 1: Write the test**

`tests/core/parity.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/core/parity.test.ts`
Expected: PASS (3 tests). If a count differs, do **not** change the expected numbers: compare against the C code (`Abschlussprojekt/src/coloring.c`, `set.c`, `bfs.c`, `readGraphData.c`) and fix `src/core`. The most likely causes are the colorable rule (self-loops, spec §5.2) or BFS depth (spec §5.3).

- [ ] **Step 3: Full verification**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: all tests pass, build prints `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add tests/core/parity.test.ts
git commit -m "Test parity of first-round color counts with the C program

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
