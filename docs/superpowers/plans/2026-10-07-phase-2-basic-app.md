# Phase 2 — Basic App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the phase 1 core into a usable page: engine in a Web Worker, Zustand store, Sigma canvas with ForceAtlas2 layout, control panel for random graphs and the bundled datasets, color + improve, status badge, English/German, dark/light theme, and a GitHub Pages deploy workflow.

**Architecture:** `src/engine/engine.ts` implements the spec's `ColoringEngine` on top of `src/core` and is unit-tested in Node. `src/engine/worker.ts` exposes it through Comlink; `src/engine/client.ts` wraps the worker for the main thread. `src/store/appStore.ts` is a framework-free Zustand store that takes an engine factory, so it is tested in Node with the in-process engine. React components only read the store and render; the canvas maps store state to Sigma reducers. UI behaviour is verified with Playwright (Chromium + WebKit) against the production build.

**Tech Stack:** phase 1 stack + sigma 3, graphology 0.26, graphology-layout-forceatlas2 0.10 (worker supervisor), comlink 4, zustand 5, i18next 26 + react-i18next 17, next-themes (comes with shadcn `sonner`), shadcn/ui components, @playwright/test **1.60.0** (pinned: it uses the Chromium/WebKit builds already installed on this machine).

**Spec:** `docs/superpowers/specs/2026-10-07-graph-coloring-redesign-design.md` — §3 (architecture, engine interface), §4.1, §4.4, §4.5 (UI, visual rules, i18n), §7 (errors), §8 phase 2.

## Global Constraints

- Branch `redesign`, repo `/Users/ghassanabukhaled/Developer/GraphVisualisierung`. Run every command from the repo root (`cd` first); never rely on the shell's previous directory.
- `src/core/` stays free of React, DOM, `node:*` and worker APIs.
- `erasableSyntaxOnly`: no `enum`, `namespace` or constructor parameter properties.
- Engine interface exactly as below (spec §3.2, with `DatasetId`):
  `loadGraph(source) → GraphSummary`, `setDistance(d, onProgress?) → DistanceSummary`, `colorFirst({ trace }) → ColoringResult`, `improve(rounds, seed) → ColoringResult[]`.
- `STEP_LIMIT = 300` (trace only for n ≤ 300), labels hidden automatically above 200 vertices, random graphs 1–1000 nodes, density 0.01–1, d 1–10, improve rounds 1–50 (spec §4.1, §4.2, §4.4).
- Colors: classes 0–9 use Tableau 10 `#4e79a7 #f28e2c #e15759 #76b7b2 #59a14f #edc949 #af7aa1 #ff9da7 #9c755f #bab0ab`; class i ≥ 10 uses hue `i × 137.508° mod 360`; uncolored vertices gray (spec §4.4).
- Errors that cross the worker boundary lose their class; match on `error.name` (`'TooLargeError'`, `'GraphParseError'`), never `instanceof`.
- Dataset URLs use `import.meta.env.BASE_URL` (Vite `base` is `/GraphVisualisierung/`).
- Language and theme persistence wrapped in try/catch; the app works without `localStorage`.
- Each task ends with `npm test`, `npx tsc -b` and `npm run lint` passing (lint warnings allowed); UI tasks additionally `npm run test:e2e`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Cancel or crash in the middle of an operation** — no stale result may land in the store afterwards; the engine is restarted and holds the last good graph and d again, so Color/Improve keep working. Pinned in Task 6 (store tests "cancel …", "crash …").
2. **d too large for the browser (TooLargeError)** — message shown, d falls back to the last working value, and the engine is usable again (not left without neighborhoods). Pinned in Task 6.
3. **Invalid numbers typed into inputs** (empty, negative, 0, > max, fractional nodes, NaN seed) — ignored, previous valid value stays, nothing crashes. Pinned in Task 1 (core seed), Task 6 (store), Task 7 (e2e).
4. **Dense random graph at the limits (1000 nodes, density 1)** — distance build must not take seconds (was 3.3 s for d ≥ 2); labels auto-hidden. Pinned in Task 1 (perf test) and Task 8 (e2e labels).
5. **Safari/WebKit** — WebGL canvas, module worker and native number inputs must work; the whole e2e suite runs in WebKit too. Pinned in Tasks 7–8 (`webkit` project).

---

## File Structure

```
src/
├── core/distance.ts, coloring.ts     (modified: dense-graph early exit, seed validation)
├── engine/
│   ├── types.ts        ColoringEngine + data types, STEP_LIMIT
│   ├── engine.ts       createEngine(): in-process implementation over src/core
│   ├── worker.ts       Comlink.expose(engine) with fetch-based dataset loader
│   └── client.ts       createWorkerEngine(onCrash): main-thread handle
├── data/datasets.ts    bundled dataset list
├── lib/
│   ├── colors.ts       classColor(), UNCOLORED
│   └── graphModel.ts   GraphSummary → graphology Graph
├── i18n/ index.ts, en.json, de.json
├── store/
│   ├── appStore.ts     createAppStore(engineFactory) — testable, no browser APIs
│   └── index.ts        appStore singleton + useApp hook (browser)
├── debug.ts            window.__app / window.__sigma for e2e
├── components/
│   ├── TopBar.tsx, LanguageSwitch.tsx, ThemeToggle.tsx
│   ├── ControlPanel.tsx, StatusBadge.tsx, BusyOverlay.tsx
│   └── GraphCanvas.tsx
├── App.tsx, main.tsx, index.css
tests/
├── core/distance.test.ts, improve.test.ts   (extended)
├── engine/engine.test.ts
├── lib/colors.test.ts, graphModel.test.ts, datasets.test.ts
├── i18n/i18n.test.ts
└── store/appStore.test.ts
e2e/
├── helpers.ts, shell.spec.ts, canvas.spec.ts
playwright.config.ts
.github/workflows/deploy.yml
```

---

### Task 1: Core follow-ups from the phase 1 review

**Files:**
- Modify: `src/core/distance.ts`, `src/core/coloring.ts`
- Test: `tests/core/distance.test.ts`, `tests/core/improve.test.ts`

**Interfaces:**
- Produces: unchanged signatures; `improve()` now throws `RangeError` for a non-integer seed or rounds < 0.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('distanceNeighborhoods', …)` in `tests/core/distance.test.ts`:

```ts
  it('builds dense graphs quickly (stops each BFS once its component is complete)', () => {
    const n = 1000
    const complete: number[] = []
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) complete.push(i, j)
    const g = buildGraph(n, complete)
    const start = performance.now()
    const nb = distanceNeighborhoods(g, 3)
    const elapsed = performance.now() - start
    expect(nb.neighbors.length).toBe(n * (n - 1))
    expect(elapsed).toBeLessThan(1000)
  })
```

Append inside `describe('improve', …)` in `tests/core/improve.test.ts`:

```ts
  it('rejects seeds that are not integers', () => {
    const { g, nb, first } = setup(10, randomPairs(10, 0.3, 1), 1)
    expect(() => improve(g, nb, first, 1, Number.NaN)).toThrow(RangeError)
    expect(() => improve(g, nb, first, 1, 1.5)).toThrow(RangeError)
    expect(() => improve(g, nb, first, -1, 1)).toThrow(RangeError)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx vitest run tests/core/distance.test.ts tests/core/improve.test.ts`
Expected: FAIL — the dense test takes > 1000 ms; the seed test does not throw.

- [ ] **Step 3: Implement the early exit in `src/core/distance.ts`**

Add this helper above `distanceNeighborhoods`:

```ts
/** Size of the connected component of every vertex. */
function componentSizes(g: Graph): Int32Array {
  const { n, offsets, neighbors } = g
  const component = new Int32Array(n).fill(-1)
  const sizes: number[] = []
  const queue = new Int32Array(n)
  for (let s = 0; s < n; s++) {
    if (component[s] !== -1) continue
    const id = sizes.length
    let head = 0
    let tail = 0
    queue[tail++] = s
    component[s] = id
    while (head < tail) {
      const x = queue[head++]
      for (let k = offsets[x]; k < offsets[x + 1]; k++) {
        const y = neighbors[k]
        if (component[y] === -1) {
          component[y] = id
          queue[tail++] = y
        }
      }
    }
    sizes.push(tail)
  }
  const result = new Int32Array(n)
  for (let v = 0; v < n; v++) result[v] = sizes[component[v]]
  return result
}
```

In `distanceNeighborhoods`, after `const progressStep = …` add:

```ts
  const componentSize = componentSizes(g)
```

and change the BFS loop header from `while (head < tail) {` to:

```ts
      while (head < tail && tail < componentSize[s]) {
```

(Once every vertex of the component is queued, no further vertex can be found.)

- [ ] **Step 4: Validate the seed in `src/core/coloring.ts`**

At the start of `improve()` add:

```ts
  if (!Number.isSafeInteger(seed)) throw new RangeError(`seed must be an integer, got ${seed}`)
  if (!Number.isInteger(rounds) || rounds < 0) throw new RangeError(`invalid number of rounds ${rounds}`)
```

- [ ] **Step 5: Run tests and checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass (the brute-force distance test and the parity test still pass — the early exit must not change any result).

- [ ] **Step 6: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add src/core/distance.ts src/core/coloring.ts tests/core/distance.test.ts tests/core/improve.test.ts
git commit -m "Speed up distance-d on dense graphs and validate improvement seeds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: In-process coloring engine

**Files:**
- Create: `src/engine/types.ts`, `src/engine/engine.ts`
- Test: `tests/engine/engine.test.ts`

**Interfaces:**
- Consumes: `randomGraph`, `parseGraphFile`, `distanceNeighborhoods`, `MAX_NEIGHBOR_ENTRIES`, `greedyColoring`, `naturalOrder`, `improve`, `ColoringResult`, `Step` (phase 1 core)
- Produces:
  - `type DatasetId = 'yeast' | 'minnesota' | 'DC'`
  - `type GraphSource = { kind: 'random'; n: number; p: number; seed: number } | { kind: 'dataset'; id: DatasetId }`
  - `interface GraphSummary { n: number; edgeCount: number; colorableCount: number; edges: Int32Array }` (`edges` = flat pairs with u < v)
  - `interface DistanceSummary { d: number; neighborEntries: number }`
  - `const STEP_LIMIT = 300`
  - `interface ColoringEngine { loadGraph(source: GraphSource): Promise<GraphSummary>; setDistance(d: number, onProgress?: (fraction: number) => void): Promise<DistanceSummary>; colorFirst(options: { trace: boolean }): Promise<ColoringResult>; improve(rounds: number, seed: number): Promise<ColoringResult[]> }`
  - re-exports `ColoringResult`, `Step`
  - `interface EngineOptions { loadDataset: (id: DatasetId) => Promise<string>; limit?: number }`
  - `createEngine(options: EngineOptions): ColoringEngine`

- [ ] **Step 1: Write the types**

`src/engine/types.ts`:

```ts
import type { ColoringResult } from '@/core/coloring'

export type { ColoringResult, Step } from '@/core/coloring'

export type DatasetId = 'yeast' | 'minnesota' | 'DC'

export type GraphSource =
  | { kind: 'random'; n: number; p: number; seed: number }
  | { kind: 'dataset'; id: DatasetId }

export interface GraphSummary {
  n: number
  edgeCount: number
  colorableCount: number
  /** Flat undirected pairs [u0, v0, u1, v1, ...] with u < v, for drawing. */
  edges: Int32Array
}

export interface DistanceSummary {
  d: number
  neighborEntries: number
}

/** Graphs up to this size record a step trace (spec §4.2). */
export const STEP_LIMIT = 300

/** The boundary between UI and algorithm (spec §3.2). A WebAssembly engine implements it later. */
export interface ColoringEngine {
  loadGraph(source: GraphSource): Promise<GraphSummary>
  setDistance(d: number, onProgress?: (fraction: number) => void): Promise<DistanceSummary>
  colorFirst(options: { trace: boolean }): Promise<ColoringResult>
  improve(rounds: number, seed: number): Promise<ColoringResult[]>
}
```

- [ ] **Step 2: Write the failing tests**

`tests/engine/engine.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { greedyColoring, improve, naturalOrder } from '@/core/coloring'
import { distanceNeighborhoods } from '@/core/distance'
import { randomGraph } from '@/core/random'
import { createEngine } from '@/engine/engine'
import type { DatasetId } from '@/engine/types'

const files: Record<DatasetId, string> = { yeast: 'yeast.txt', minnesota: 'minnesota.txt', DC: 'DC.txt' }
const loadDataset = async (id: DatasetId) =>
  readFileSync(new URL(`../../public/data/${files[id]}`, import.meta.url), 'utf8')

function newEngine(limit?: number) {
  return createEngine({ loadDataset, limit })
}

describe('createEngine', () => {
  it('loads a random graph and summarizes it', async () => {
    const engine = newEngine()
    const summary = await engine.loadGraph({ kind: 'random', n: 30, p: 0.2, seed: 4 })
    const g = randomGraph(30, 0.2, 4)
    expect(summary.n).toBe(30)
    expect(summary.edgeCount).toBe(g.edgeCount)
    expect(summary.edges.length).toBe(2 * g.edgeCount)
    for (let k = 0; k < summary.edges.length; k += 2) expect(summary.edges[k]).toBeLessThan(summary.edges[k + 1])
    expect(summary.colorableCount).toBe([...g.colorable].filter(Boolean).length)
  })

  it('loads a dataset and reproduces the C result', async () => {
    const engine = newEngine()
    const summary = await engine.loadGraph({ kind: 'dataset', id: 'yeast' })
    expect(summary.n).toBe(2361)
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: false })).numColors).toBe(12)
  })

  it('requires a graph, a distance and a first coloring in that order', async () => {
    const engine = newEngine()
    await expect(engine.setDistance(1)).rejects.toThrow('No graph loaded')
    await engine.loadGraph({ kind: 'random', n: 10, p: 0.3, seed: 1 })
    await expect(engine.colorFirst({ trace: false })).rejects.toThrow('Distance not set')
    await engine.setDistance(1)
    await expect(engine.improve(1, 1)).rejects.toThrow('Color the graph first')
  })

  it('records a trace only up to STEP_LIMIT vertices', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 300, p: 0.02, seed: 1 })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: true })).trace).toBeDefined()
    await engine.loadGraph({ kind: 'random', n: 301, p: 0.02, seed: 1 })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: true })).trace).toBeUndefined()
  })

  it('continues the round numbering across improve calls', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 60, p: 0.15, seed: 8 })
    await engine.setDistance(2)
    const first = await engine.colorFirst({ trace: false })
    const a = await engine.improve(2, 5)
    const b = await engine.improve(2, 5)

    const g = randomGraph(60, 0.15, 8)
    const nb = distanceNeighborhoods(g, 2)
    const expected = improve(g, nb, greedyColoring(g, nb, naturalOrder(60)), 4, 5)
    expect(first.numColors).toBe(greedyColoring(g, nb, naturalOrder(60)).numColors)
    expect([...a, ...b].map((r) => [...r.colorOf])).toEqual(expected.map((r) => [...r.colorOf]))
  })

  it('setDistance and loadGraph discard the previous coloring', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 20, p: 0.3, seed: 2 })
    await engine.setDistance(1)
    await engine.colorFirst({ trace: false })
    await engine.setDistance(2)
    await expect(engine.improve(1, 1)).rejects.toThrow('Color the graph first')
  })

  it('reports progress and the neighbor count', async () => {
    const engine = newEngine()
    await engine.loadGraph({ kind: 'random', n: 80, p: 0.05, seed: 3 })
    const seen: number[] = []
    const summary = await engine.setDistance(2, (f) => seen.push(f))
    expect(seen.at(-1)).toBe(1)
    expect(summary.neighborEntries).toBe(distanceNeighborhoods(randomGraph(80, 0.05, 3), 2).neighbors.length)
  })

  it('rejects a distance above the limit with a TooLargeError and stays usable', async () => {
    const reference = newEngine()
    await reference.loadGraph({ kind: 'random', n: 60, p: 0.1, seed: 7 })
    const d1 = await reference.setDistance(1)

    const engine = newEngine(d1.neighborEntries)
    await engine.loadGraph({ kind: 'random', n: 60, p: 0.1, seed: 7 })
    await expect(engine.setDistance(3)).rejects.toMatchObject({ name: 'TooLargeError' })
    await engine.setDistance(1)
    expect((await engine.colorFirst({ trace: false })).numColors).toBeGreaterThan(0)
  })

  it('reports parse errors by name', async () => {
    const engine = createEngine({ loadDataset: async () => 'not a graph' })
    await expect(engine.loadGraph({ kind: 'dataset', id: 'DC' })).rejects.toMatchObject({ name: 'GraphParseError' })
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx vitest run tests/engine/engine.test.ts`
Expected: FAIL — cannot resolve `@/engine/engine`.

- [ ] **Step 4: Implement `src/engine/engine.ts`**

```ts
import { greedyColoring, improve, naturalOrder, type ColoringResult } from '@/core/coloring'
import { distanceNeighborhoods, MAX_NEIGHBOR_ENTRIES, type Neighborhoods } from '@/core/distance'
import type { Graph } from '@/core/graph'
import { parseGraphFile } from '@/core/parser'
import { randomGraph } from '@/core/random'
import { STEP_LIMIT, type ColoringEngine, type DatasetId, type GraphSummary } from './types'

export interface EngineOptions {
  loadDataset: (id: DatasetId) => Promise<string>
  /** Maximum number of distance-d neighbor entries (tests use small values). */
  limit?: number
}

/** ColoringEngine running in the current thread; worker.ts exposes it to the UI. */
export function createEngine(options: EngineOptions): ColoringEngine {
  let graph: Graph | null = null
  let neighborhoods: Neighborhoods | null = null
  let last: ColoringResult | null = null
  let round = 0

  const requireGraph = (): Graph => {
    if (!graph) throw new Error('No graph loaded')
    return graph
  }
  const requireDistance = (): Neighborhoods => {
    if (!neighborhoods) throw new Error('Distance not set')
    return neighborhoods
  }

  return {
    async loadGraph(source) {
      const g =
        source.kind === 'random'
          ? randomGraph(source.n, source.p, source.seed)
          : parseGraphFile(await options.loadDataset(source.id))
      graph = g
      neighborhoods = null
      last = null
      round = 0
      return summarize(g)
    },

    async setDistance(d, onProgress) {
      const g = requireGraph()
      neighborhoods = null
      last = null
      round = 0
      neighborhoods = distanceNeighborhoods(g, d, {
        limit: options.limit ?? MAX_NEIGHBOR_ENTRIES,
        onProgress,
      })
      return { d, neighborEntries: neighborhoods.neighbors.length }
    },

    async colorFirst({ trace }) {
      const g = requireGraph()
      last = greedyColoring(g, requireDistance(), naturalOrder(g.n), { trace: trace && g.n <= STEP_LIMIT })
      round = 0
      return last
    },

    async improve(rounds, seed) {
      const g = requireGraph()
      const nb = requireDistance()
      if (!last) throw new Error('Color the graph first')
      const results = improve(g, nb, last, rounds, seed, round + 1)
      if (results.length > 0) {
        last = results[results.length - 1]
        round += results.length
      }
      return results
    },
  }
}

function summarize(g: Graph): GraphSummary {
  const edges = new Int32Array(g.edgeCount * 2)
  let k = 0
  let colorableCount = 0
  for (let u = 0; u < g.n; u++) {
    colorableCount += g.colorable[u]
    for (let i = g.offsets[u]; i < g.offsets[u + 1]; i++) {
      const v = g.neighbors[i]
      if (u < v) {
        edges[k++] = u
        edges[k++] = v
      }
    }
  }
  return { n: g.n, edgeCount: g.edgeCount, colorableCount, edges }
}
```

- [ ] **Step 5: Run tests and checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add src/engine/types.ts src/engine/engine.ts tests/engine/engine.test.ts
git commit -m "Add ColoringEngine interface and in-process implementation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Datasets, colors and graphology model

**Files:**
- Create: `src/data/datasets.ts`, `src/lib/colors.ts`, `src/lib/graphModel.ts`
- Test: `tests/lib/datasets.test.ts`, `tests/lib/colors.test.ts`, `tests/lib/graphModel.test.ts`

**Interfaces:**
- Consumes: `DatasetId`, `GraphSummary` (Task 2), `createRng` (phase 1)
- Produces:
  - `interface Dataset { id: DatasetId; file: string; vertices: number }`, `DATASETS: readonly Dataset[]`
  - `TABLEAU10: readonly string[]`, `UNCOLORED: string`, `classColor(i: number): string` (hex `#rrggbb`)
  - `toGraphology(summary: GraphSummary): Graph` (graphology; node keys `'0'..'n-1'`, attributes `x`, `y` in [0, 1), `size: 4`, `label`)

- [ ] **Step 1: Install graphology**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npm install graphology
npm install -D graphology-types
```

- [ ] **Step 2: Write the failing tests**

`tests/lib/datasets.test.ts`:

```ts
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
```

`tests/lib/colors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classColor, TABLEAU10, UNCOLORED } from '@/lib/colors'

describe('classColor', () => {
  it('uses the Tableau 10 palette for the first ten classes', () => {
    expect(Array.from({ length: 10 }, (_, i) => classColor(i))).toEqual([...TABLEAU10])
  })

  it('returns valid, distinct hex colors for many classes', () => {
    const colors = Array.from({ length: 400 }, (_, i) => classColor(i))
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(colors.slice(0, 100)).size).toBe(100)
  })

  it('returns gray for uncolored vertices', () => {
    expect(classColor(-1)).toBe(UNCOLORED)
    expect(TABLEAU10).not.toContain(UNCOLORED)
  })
})
```

`tests/lib/graphModel.test.ts`:

```ts
import { expect, it } from 'vitest'
import { toGraphology } from '@/lib/graphModel'

it('converts a summary into a graphology graph', () => {
  const g = toGraphology({ n: 4, edgeCount: 2, colorableCount: 3, edges: new Int32Array([0, 1, 1, 2]) })
  expect(g.order).toBe(4)
  expect(g.size).toBe(2)
  expect(g.hasEdge('0', '1')).toBe(true)
  expect(g.hasEdge('1', '2')).toBe(true)
  g.forEachNode((node, attributes) => {
    expect(attributes.label).toBe(node)
    expect(attributes.x).toBeGreaterThanOrEqual(0)
    expect(attributes.x).toBeLessThan(1)
    expect(attributes.y).toBeGreaterThanOrEqual(0)
    expect(attributes.y).toBeLessThan(1)
  })
})

it('places nodes reproducibly', () => {
  const summary = { n: 3, edgeCount: 0, colorableCount: 0, edges: new Int32Array() }
  expect(toGraphology(summary).export()).toEqual(toGraphology(summary).export())
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx vitest run tests/lib`
Expected: FAIL — modules cannot be resolved.

- [ ] **Step 4: Implement**

`src/data/datasets.ts`:

```ts
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
```

`src/lib/colors.ts`:

```ts
/** d3.schemeTableau10 */
export const TABLEAU10: readonly string[] = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
]

/** Vertices without edges (never colored, as in the C program). */
export const UNCOLORED = '#52525b'

const GOLDEN_ANGLE = 137.508

/** Color of class i: Tableau 10 first, then golden-angle hues so neighbors differ clearly. */
export function classColor(i: number): string {
  if (i < 0) return UNCOLORED
  if (i < TABLEAU10.length) return TABLEAU10[i]
  return hslToHex((i * GOLDEN_ANGLE) % 360, 0.65, 0.55)
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const channel = (k: number) => {
    const t = (k + h / 30) % 12
    const value = l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}
```

`src/lib/graphModel.ts`:

```ts
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
```

- [ ] **Step 5: Run tests and checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add package.json package-lock.json src/data src/lib/colors.ts src/lib/graphModel.ts tests/lib
git commit -m "Add dataset list, class colors and graphology conversion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Worker and main-thread client

**Files:**
- Create: `src/engine/worker.ts`, `src/engine/client.ts`

**Interfaces:**
- Consumes: `createEngine` (Task 2), `DATASETS` (Task 3), `ColoringEngine` (Task 2)
- Produces: `interface EngineHandle { engine: ColoringEngine; terminate(): void }`, `createWorkerEngine(onCrash: () => void): EngineHandle`

No unit test: Node has no Web Worker. This task is verified by the build (worker bundle emitted) and end-to-end by Tasks 7–8, which load datasets and color through the worker in Chromium and WebKit.

- [ ] **Step 1: Install Comlink**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npm install comlink
```

- [ ] **Step 2: Write `src/engine/worker.ts`**

```ts
import * as Comlink from 'comlink'
import { DATASETS } from '@/data/datasets'
import { createEngine } from './engine'
import type { ColoringEngine, DatasetId } from './types'

async function loadDataset(id: DatasetId): Promise<string> {
  const dataset = DATASETS.find((d) => d.id === id)
  if (!dataset) throw new Error(`Unknown dataset ${id}`)
  const response = await fetch(`${import.meta.env.BASE_URL}data/${dataset.file}`)
  if (!response.ok) throw new Error(`Could not load ${dataset.file} (HTTP ${response.status})`)
  return response.text()
}

const engine = createEngine({ loadDataset })

// Results are copied (structured clone). Only the freshly built edge list is transferred:
// the engine keeps its own graph, neighborhoods and last coloring.
const api: ColoringEngine = {
  async loadGraph(source) {
    const summary = await engine.loadGraph(source)
    return Comlink.transfer(summary, [summary.edges.buffer])
  },
  setDistance: (d, onProgress) => engine.setDistance(d, onProgress),
  colorFirst: (options) => engine.colorFirst(options),
  improve: (rounds, seed) => engine.improve(rounds, seed),
}

Comlink.expose(api)
```

- [ ] **Step 3: Write `src/engine/client.ts`**

```ts
import * as Comlink from 'comlink'
import type { ColoringEngine } from './types'

export interface EngineHandle {
  engine: ColoringEngine
  terminate(): void
}

/** Starts the engine worker. onCrash fires if the worker dies; pending calls never settle then. */
export function createWorkerEngine(onCrash: () => void): EngineHandle {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('error', onCrash)
  const remote = Comlink.wrap<ColoringEngine>(worker)

  const engine: ColoringEngine = {
    loadGraph: (source) => remote.loadGraph(source),
    setDistance: (d, onProgress) => remote.setDistance(d, onProgress ? Comlink.proxy(onProgress) : undefined),
    colorFirst: (options) => remote.colorFirst(options),
    improve: (rounds, seed) => remote.improve(rounds, seed),
  }

  return {
    engine,
    terminate() {
      worker.removeEventListener('error', onCrash)
      remote[Comlink.releaseProxy]()
      worker.terminate()
    },
  }
}
```

- [ ] **Step 4: Verify the build emits the worker**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx tsc -b && npm run lint && npm run build`
Expected: no errors. (Nothing imports `client.ts` yet, so the worker is not bundled until Task 7; Task 7 Step 9 checks that.)

- [ ] **Step 5: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add package.json package-lock.json src/engine/worker.ts src/engine/client.ts
git commit -m "Run the coloring engine in a Web Worker via Comlink

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Internationalization (English, German)

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/de.json`
- Modify: `tsconfig.app.json`, `tsconfig.test.json` (add `"resolveJsonModule": true`)
- Test: `tests/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `LANGUAGES = ['en', 'de'] as const`, `type Language`, `detectLanguage(saved: string | null, browser: string | undefined): Language`, `saveLanguage(language: Language): void`, `initI18n(): Promise<unknown>`, default export `i18n`; translation keys listed in `en.json`.

- [ ] **Step 1: Install and configure**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npm install i18next react-i18next
```

Add `"resolveJsonModule": true,` to `compilerOptions` in both `tsconfig.app.json` and `tsconfig.test.json`.

- [ ] **Step 2: Write the translations**

`src/i18n/en.json`:

```json
{
  "app": {
    "title": "Graph Coloring",
    "subtitle": "Greedy distance-d coloring",
    "github": "GitHub"
  },
  "language": { "label": "Language" },
  "theme": { "toggle": "Toggle dark mode" },
  "graph": {
    "heading": "Graph",
    "random": "Random",
    "dataset": "Dataset",
    "nodes": "Nodes",
    "density": "Edge density",
    "seed": "Seed",
    "generate": "Generate",
    "load": "Load",
    "datasetOption": "{{name}} · {{count, number}} nodes"
  },
  "coloring": {
    "heading": "Coloring",
    "distance": "Distance d",
    "color": "Color",
    "improve": "Improve ×{{count}}",
    "rounds": "Rounds"
  },
  "display": {
    "heading": "Display",
    "nodeSize": "Node size",
    "labels": "Show labels",
    "edgeOpacity": "Edge opacity",
    "relayout": "Re-layout"
  },
  "status": {
    "nodes_one": "{{count, number}} node",
    "nodes_other": "{{count, number}} nodes",
    "edges_one": "{{count, number}} edge",
    "edges_other": "{{count, number}} edges",
    "distance": "d = {{d}}",
    "colors_one": "{{count, number}} color",
    "colors_other": "{{count, number}} colors",
    "computing": "Computing…",
    "cancel": "Cancel"
  },
  "errors": {
    "tooLarge": "Distance {{d}} creates too many neighbor pairs for the browser. Try a smaller d.",
    "parse": "The graph file could not be read: {{message}}",
    "crash": "The computation stopped unexpectedly. Please try again.",
    "generic": "Something went wrong: {{message}}"
  }
}
```

`src/i18n/de.json`:

```json
{
  "app": {
    "title": "Graphfärbung",
    "subtitle": "Greedy-Färbung mit Distanz d",
    "github": "GitHub"
  },
  "language": { "label": "Sprache" },
  "theme": { "toggle": "Dunkelmodus umschalten" },
  "graph": {
    "heading": "Graph",
    "random": "Zufällig",
    "dataset": "Datensatz",
    "nodes": "Knoten",
    "density": "Kantendichte",
    "seed": "Seed",
    "generate": "Erzeugen",
    "load": "Laden",
    "datasetOption": "{{name}} · {{count, number}} Knoten"
  },
  "coloring": {
    "heading": "Färbung",
    "distance": "Distanz d",
    "color": "Färben",
    "improve": "Verbessern ×{{count}}",
    "rounds": "Runden"
  },
  "display": {
    "heading": "Darstellung",
    "nodeSize": "Knotengröße",
    "labels": "Beschriftungen",
    "edgeOpacity": "Kantendeckkraft",
    "relayout": "Neu anordnen"
  },
  "status": {
    "nodes_one": "{{count, number}} Knoten",
    "nodes_other": "{{count, number}} Knoten",
    "edges_one": "{{count, number}} Kante",
    "edges_other": "{{count, number}} Kanten",
    "distance": "d = {{d}}",
    "colors_one": "{{count, number}} Farbe",
    "colors_other": "{{count, number}} Farben",
    "computing": "Berechne …",
    "cancel": "Abbrechen"
  },
  "errors": {
    "tooLarge": "Distanz {{d}} erzeugt zu viele Nachbarpaare für den Browser. Bitte ein kleineres d wählen.",
    "parse": "Die Graphdatei konnte nicht gelesen werden: {{message}}",
    "crash": "Die Berechnung wurde unerwartet beendet. Bitte erneut versuchen.",
    "generic": "Etwas ist schiefgelaufen: {{message}}"
  }
}
```

- [ ] **Step 3: Write the failing test**

`tests/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import de from '@/i18n/de.json'
import en from '@/i18n/en.json'
import { detectLanguage } from '@/i18n'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

function values(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Object.values(value as object).flatMap(values)
}

describe('translations', () => {
  it('have the same keys in English and German', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort())
  })

  it('have no empty strings', () => {
    for (const text of [...values(en), ...values(de)]) expect(text.trim()).not.toBe('')
  })
})

describe('detectLanguage', () => {
  it('prefers a saved choice', () => {
    expect(detectLanguage('de', 'en-US')).toBe('de')
    expect(detectLanguage('en', 'de-DE')).toBe('en')
  })

  it('falls back to the browser language, then English', () => {
    expect(detectLanguage(null, 'de-AT')).toBe('de')
    expect(detectLanguage(null, 'fr-FR')).toBe('en')
    expect(detectLanguage('xx', undefined)).toBe('en')
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx vitest run tests/i18n`
Expected: FAIL — cannot resolve `@/i18n`.

- [ ] **Step 5: Implement `src/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'language'

/** Saved choice, else browser language, else English (spec §4.5). */
export function detectLanguage(saved: string | null, browser: string | undefined): Language {
  if (saved === 'en' || saved === 'de') return saved
  return browser?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage unavailable (private mode): the choice only lasts for this visit
  }
}

export function initI18n() {
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language
  })
  return i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, de: { translation: de } },
    lng: detectLanguage(readSaved(), navigator.language),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
}

export default i18n
```

- [ ] **Step 6: Run tests and checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add package.json package-lock.json tsconfig.app.json tsconfig.test.json src/i18n tests/i18n
git commit -m "Add English and German translations with language detection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Application store

**Files:**
- Create: `src/store/appStore.ts`, `src/store/index.ts`
- Test: `tests/store/appStore.test.ts`

**Interfaces:**
- Consumes: `ColoringEngine`, `GraphSource`, `GraphSummary`, `ColoringResult`, `DatasetId`, `STEP_LIMIT` (Task 2), `createEngine` (tests only), `EngineHandle`, `createWorkerEngine` (Task 4)
- Produces:
  - `type SourceKind = 'random' | 'dataset'`; `interface RandomParams { n; p; seed }`; `interface DisplaySettings { nodeSize: number; showLabels: boolean | null; edgeOpacity: number }` (`null` = automatic)
  - `type AppError = { key: 'errors.tooLarge'; d: number } | { key: 'errors.parse' | 'errors.generic'; message: string } | { key: 'errors.crash' }`
  - `DEFAULT_RANDOM = { n: 50, p: 0.1, seed: 42 }`, `LABEL_LIMIT = 200`, `MAX_RANDOM_NODES = 1000`, `MAX_DISTANCE = 10`, `MAX_IMPROVE_ROUNDS = 50`, `DEFAULT_DISPLAY = { nodeSize: 4, showLabels: null, edgeOpacity: 0.35 }`
  - `interface AppState` with fields `sourceKind, random, datasetId, d, graph, graphVersion, coloring, rounds, busy, progress, error, display, layoutVersion, layoutRunning` and actions `setSourceKind, setRandom, setDataset, setDisplay, relayout, dismissError, generate, setDistance, color, improve, cancel`
  - `type EngineFactory = (onCrash: () => void) => EngineHandle`; `createAppStore(createEngineHandle: EngineFactory): StoreApi<AppState>`
  - `src/store/index.ts`: `appStore` (worker-backed singleton), `useApp<T>(selector: (s: AppState) => T): T`

- [ ] **Step 1: Install Zustand**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npm install zustand
```

- [ ] **Step 2: Write the failing tests**

`tests/store/appStore.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEngine } from '@/engine/engine'
import type { EngineHandle } from '@/engine/client'
import type { DatasetId } from '@/engine/types'
import { createAppStore, DEFAULT_RANDOM } from '@/store/appStore'

const files: Record<DatasetId, string> = { yeast: 'yeast.txt', minnesota: 'minnesota.txt', DC: 'DC.txt' }
const loadDataset = async (id: DatasetId) =>
  readFileSync(new URL(`../../public/data/${files[id]}`, import.meta.url), 'utf8')

function setup(options: { limit?: number; loader?: (id: DatasetId) => Promise<string> } = {}) {
  const handles: { terminated: boolean }[] = []
  let crash: () => void = () => {}
  const factory = (onCrash: () => void): EngineHandle => {
    crash = onCrash
    const record = { terminated: false }
    handles.push(record)
    return {
      engine: createEngine({ loadDataset: options.loader ?? loadDataset, limit: options.limit }),
      terminate: () => {
        record.terminated = true
      },
    }
  }
  const store = createAppStore(factory)
  return { store, handles, crash: () => crash() }
}

describe('appStore', () => {
  it('generates the default random graph', async () => {
    const { store } = setup()
    await store.getState().generate()
    const state = store.getState()
    expect(state.graph?.n).toBe(DEFAULT_RANDOM.n)
    expect(state.graphVersion).toBe(1)
    expect(state.busy).toBe(false)
    expect(state.error).toBeNull()
  })

  it('colors and improves, keeping the history of color counts', async () => {
    const { store } = setup()
    await store.getState().generate()
    await store.getState().color()
    const first = store.getState().coloring
    expect(first?.numColors).toBeGreaterThan(0)
    expect(first?.trace).toBeDefined()
    await store.getState().improve(5)
    const { rounds, coloring } = store.getState()
    expect(rounds.length).toBe(6)
    for (let i = 1; i < rounds.length; i++) expect(rounds[i]).toBeLessThanOrEqual(rounds[i - 1])
    expect(coloring?.numColors).toBe(rounds[5])
  })

  it('changing d clears the coloring', async () => {
    const { store } = setup()
    await store.getState().generate()
    await store.getState().color()
    await store.getState().setDistance(2)
    expect(store.getState().d).toBe(2)
    expect(store.getState().coloring).toBeNull()
    expect(store.getState().rounds).toEqual([])
    await store.getState().color()
    expect(store.getState().coloring).not.toBeNull()
  })

  it('loads a dataset and matches the C program', async () => {
    const { store } = setup()
    store.getState().setSourceKind('dataset')
    store.getState().setDataset('yeast')
    await store.getState().generate()
    await store.getState().color()
    expect(store.getState().graph?.n).toBe(2361)
    expect(store.getState().coloring?.numColors).toBe(12)
  })

  it('falls back to the last working d when the distance graph is too large', async () => {
    const { store } = setup({ limit: 600 })
    store.getState().setRandom({ n: 60, p: 0.1, seed: 7 })
    await store.getState().generate()
    await store.getState().setDistance(4)
    const state = store.getState()
    expect(state.error).toEqual({ key: 'errors.tooLarge', d: 4 })
    expect(state.d).toBe(1)
    await store.getState().color()
    expect(store.getState().coloring?.numColors).toBeGreaterThan(0)
  })

  it('ignores invalid random parameters', () => {
    const { store } = setup()
    for (const patch of [{ n: 0 }, { n: 1001 }, { n: 2.5 }, { p: 0 }, { p: 1.5 }, { seed: Number.NaN }, { seed: -1 }, { seed: 1.5 }]) {
      store.getState().setRandom(patch)
    }
    expect(store.getState().random).toEqual(DEFAULT_RANDOM)
    store.getState().setRandom({ n: 1000, p: 1, seed: 0 })
    expect(store.getState().random).toEqual({ n: 1000, p: 1, seed: 0 })
  })

  it('ignores d outside 1..10', async () => {
    const { store } = setup()
    for (const d of [0, 11, 1.5, Number.NaN]) await store.getState().setDistance(d)
    expect(store.getState().d).toBe(1)
  })

  it('cancel discards the running result and restores the engine', async () => {
    const { store, handles } = setup()
    await store.getState().generate()
    const running = store.getState().setDistance(3)
    await store.getState().cancel()
    await running
    const state = store.getState()
    expect(handles.length).toBe(2)
    expect(handles[0].terminated).toBe(true)
    expect(state.d).toBe(1)
    expect(state.busy).toBe(false)
    await store.getState().color()
    expect(store.getState().coloring?.numColors).toBeGreaterThan(0)
  })

  it('a worker crash shows an error and restarts the engine', async () => {
    const { store, handles, crash } = setup()
    await store.getState().generate()
    crash()
    await Promise.resolve()
    expect(store.getState().error).toEqual({ key: 'errors.crash' })
    expect(handles.length).toBe(2)
    await store.getState().color()
    expect(store.getState().coloring?.numColors).toBeGreaterThan(0)
  })

  it('reports parse errors and keeps the previous graph', async () => {
    const { store } = setup({ loader: async () => 'garbage' })
    await store.getState().generate()
    store.getState().setSourceKind('dataset')
    await store.getState().generate()
    const state = store.getState()
    expect(state.error).toMatchObject({ key: 'errors.parse' })
    expect(state.graph?.n).toBe(DEFAULT_RANDOM.n)
  })

  it('updates display settings', () => {
    const { store } = setup()
    store.getState().setDisplay({ nodeSize: 8, showLabels: false })
    expect(store.getState().display).toMatchObject({ nodeSize: 8, showLabels: false })
    const before = store.getState().layoutVersion
    store.getState().relayout()
    expect(store.getState().layoutVersion).toBe(before + 1)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npx vitest run tests/store`
Expected: FAIL — cannot resolve `@/store/appStore`.

- [ ] **Step 4: Implement `src/store/appStore.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { EngineHandle } from '@/engine/client'
import {
  STEP_LIMIT,
  type ColoringEngine,
  type ColoringResult,
  type DatasetId,
  type GraphSource,
  type GraphSummary,
} from '@/engine/types'

export type SourceKind = 'random' | 'dataset'

export interface RandomParams {
  n: number
  p: number
  seed: number
}

export interface DisplaySettings {
  nodeSize: number
  /** null = automatic (labels only up to 200 vertices) */
  showLabels: boolean | null
  edgeOpacity: number
}

export type AppError =
  | { key: 'errors.tooLarge'; d: number }
  | { key: 'errors.parse' | 'errors.generic'; message: string }
  | { key: 'errors.crash' }

export const DEFAULT_RANDOM: RandomParams = { n: 50, p: 0.1, seed: 42 }
export const MAX_RANDOM_NODES = 1000
export const MAX_DISTANCE = 10
export const MAX_IMPROVE_ROUNDS = 50
export const DEFAULT_DISPLAY: DisplaySettings = { nodeSize: 4, showLabels: null, edgeOpacity: 0.35 }
/** Labels are shown automatically up to this many vertices (spec §4.4). */
export const LABEL_LIMIT = 200

export interface AppState {
  sourceKind: SourceKind
  random: RandomParams
  datasetId: DatasetId
  d: number
  graph: GraphSummary | null
  /** Increments whenever a new graph is loaded (the canvas rebuilds). */
  graphVersion: number
  coloring: ColoringResult | null
  /** Number of colors per round; index 0 = first coloring. */
  rounds: number[]
  busy: boolean
  progress: number | null
  error: AppError | null
  display: DisplaySettings
  layoutVersion: number
  layoutRunning: boolean

  setSourceKind(kind: SourceKind): void
  setRandom(patch: Partial<RandomParams>): void
  setDataset(id: DatasetId): void
  setDisplay(patch: Partial<DisplaySettings>): void
  relayout(): void
  dismissError(): void
  generate(): Promise<void>
  setDistance(d: number): Promise<void>
  color(): Promise<void>
  improve(rounds: number): Promise<void>
  cancel(): Promise<void>
}

export type EngineFactory = (onCrash: () => void) => EngineHandle

const isValidN = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_RANDOM_NODES
const isValidP = (p: number) => Number.isFinite(p) && p >= 0.01 && p <= 1
const isValidSeed = (seed: number) => Number.isSafeInteger(seed) && seed >= 0
const isValidD = (d: number) => Number.isInteger(d) && d >= 1 && d <= MAX_DISTANCE

function toAppError(error: unknown, d: number): AppError {
  // Errors from the worker lose their class but keep their name
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'TooLargeError') return { key: 'errors.tooLarge', d }
  if (name === 'GraphParseError') return { key: 'errors.parse', message }
  return { key: 'errors.generic', message }
}

export function createAppStore(createEngineHandle: EngineFactory): StoreApi<AppState> {
  return createStore<AppState>()((set, get) => {
    let handle: EngineHandle = createEngineHandle(onCrash)
    /** Incremented by every operation and by cancel/crash: older results are dropped. */
    let operation = 0
    /** Settles once a restarted engine holds the last graph and d again. */
    let ready: Promise<void> = Promise.resolve()
    /** What the engine currently holds, to restore it after a restart. */
    let loadedSource: GraphSource | null = null
    let appliedD = 1

    type Current = () => boolean

    async function run(task: (engine: ColoringEngine, current: Current) => Promise<void>) {
      const token = ++operation
      const current = () => token === operation
      set({ busy: true, progress: null, error: null })
      try {
        await ready
        if (current()) await task(handle.engine, current)
      } catch (error) {
        if (current()) set({ error: toAppError(error, get().d) })
      } finally {
        if (current()) set({ busy: false, progress: null })
      }
    }

    /** Sets d in the engine. If d is too large, falls back to the last working d and reports it. */
    async function applyDistance(engine: ColoringEngine, current: Current, d: number) {
      try {
        await engine.setDistance(d, (fraction) => {
          if (current()) set({ progress: fraction })
        })
        if (!current()) return
        appliedD = d
        set({ d, coloring: null, rounds: [] })
      } catch (error) {
        if (!current()) return
        if (!(error instanceof Error && error.name === 'TooLargeError')) throw error
        const fallback = d === appliedD ? 1 : appliedD
        await engine.setDistance(fallback)
        appliedD = fallback
        set({ d: fallback, coloring: null, rounds: [], error: toAppError(error, d) })
      }
    }

    function restartEngine(): Promise<void> {
      operation++
      handle.terminate()
      handle = createEngineHandle(onCrash)
      set({ busy: false, progress: null, coloring: null, rounds: [], d: appliedD })
      const engine = handle.engine
      const source = loadedSource
      const d = appliedD
      ready = source
        ? engine.loadGraph(source).then(
            () => engine.setDistance(d).then(() => undefined),
            () => undefined,
          )
        : Promise.resolve()
      return ready
    }

    function onCrash() {
      void restartEngine()
      set({ error: { key: 'errors.crash' } })
    }

    return {
      sourceKind: 'random',
      random: DEFAULT_RANDOM,
      datasetId: 'yeast',
      d: 1,
      graph: null,
      graphVersion: 0,
      coloring: null,
      rounds: [],
      busy: false,
      progress: null,
      error: null,
      display: DEFAULT_DISPLAY,
      layoutVersion: 0,
      layoutRunning: false,

      setSourceKind: (sourceKind) => set({ sourceKind }),
      setDataset: (datasetId) => set({ datasetId }),
      setRandom(patch) {
        const next = { ...get().random }
        if (patch.n !== undefined && isValidN(patch.n)) next.n = patch.n
        if (patch.p !== undefined && isValidP(patch.p)) next.p = patch.p
        if (patch.seed !== undefined && isValidSeed(patch.seed)) next.seed = patch.seed
        set({ random: next })
      },
      setDisplay: (patch) => set({ display: { ...get().display, ...patch } }),
      relayout: () => set({ layoutVersion: get().layoutVersion + 1 }),
      dismissError: () => set({ error: null }),

      generate() {
        const { sourceKind, random, datasetId } = get()
        const source: GraphSource =
          sourceKind === 'random' ? { kind: 'random', ...random } : { kind: 'dataset', id: datasetId }
        return run(async (engine, current) => {
          const graph = await engine.loadGraph(source)
          if (!current()) return
          loadedSource = source
          set({ graph, graphVersion: get().graphVersion + 1, coloring: null, rounds: [] })
          await applyDistance(engine, current, get().d)
        })
      },

      setDistance(d) {
        if (!isValidD(d)) return Promise.resolve()
        set({ d })
        if (!get().graph) return Promise.resolve()
        return run((engine, current) => applyDistance(engine, current, d))
      },

      color() {
        const graph = get().graph
        if (!graph) return Promise.resolve()
        return run(async (engine, current) => {
          const result = await engine.colorFirst({ trace: graph.n <= STEP_LIMIT })
          if (current()) set({ coloring: result, rounds: [result.numColors] })
        })
      },

      improve(rounds) {
        if (!get().coloring || !Number.isInteger(rounds) || rounds < 1 || rounds > MAX_IMPROVE_ROUNDS) {
          return Promise.resolve()
        }
        const seed = get().random.seed
        return run(async (engine, current) => {
          const results = await engine.improve(rounds, seed)
          if (!current() || results.length === 0) return
          set({
            coloring: results[results.length - 1],
            rounds: [...get().rounds, ...results.map((r) => r.numColors)],
          })
        })
      },

      cancel: () => restartEngine(),
    }
  })
}
```

`src/store/index.ts`:

```ts
import { useStore } from 'zustand'
import { createWorkerEngine } from '@/engine/client'
import { createAppStore, type AppState } from './appStore'

export const appStore = createAppStore(createWorkerEngine)

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}

export type { AppState } from './appStore'
```

- [ ] **Step 5: Run tests and checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add package.json package-lock.json src/store tests/store
git commit -m "Add application store with cancel, crash recovery and error mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App shell, controls and end-to-end harness

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/shell.spec.ts`, `src/debug.ts`, `src/components/{TopBar,LanguageSwitch,ThemeToggle,ControlPanel,StatusBadge,BusyOverlay}.tsx`
- Create (shadcn): `src/components/ui/{slider,select,toggle,toggle-group,input,label,switch,collapsible,progress,separator,sonner,badge,tooltip}.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`, `src/index.css`, `package.json`, `tsconfig.node.json`, `tsconfig.test.json`, `.gitignore`

**Interfaces:**
- Consumes: `appStore`, `useApp` (Task 6), `DATASETS` (Task 3), `classColor` (Task 3), `initI18n`, `saveLanguage`, `LANGUAGES` (Task 5), `MAX_*` constants (Task 6)
- Produces: `window.__app = { getState, classColor }` (e2e hook), `<GraphCanvasSlot>` placeholder `div[data-testid="graph-canvas"]` that Task 8 replaces

- [ ] **Step 1: Install UI dependencies and Playwright**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npx shadcn@latest add slider select toggle-group input label switch collapsible progress separator sonner badge tooltip -y < /dev/null
npm install sigma graphology-layout-forceatlas2
npm install -D @playwright/test@1.60.0
npm pkg set scripts.test:e2e="playwright test"
printf '\n# Playwright\ntest-results\nplaywright-report\n' >> .gitignore
```

Expected: shadcn creates 13 files in `src/components/ui/` and adds `next-themes` and `sonner`.

The generated `Slider` renders unlabeled thumbs (`role="slider"` without a name), which screen readers and the e2e tests cannot identify. In `src/components/ui/slider.tsx` add a `thumbLabel` prop:

- change the props type to `React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel?: string }`
- destructure it: `max = 100, thumbLabel, ...props`
- pass it to every thumb: `<SliderPrimitive.Thumb aria-label={thumbLabel} data-slot="slider-thumb" …`

- [ ] **Step 2: Playwright configuration**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const PORT = 4180
const BASE = `http://127.0.0.1:${PORT}/GraphVisualisierung/`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: { baseURL: BASE, locale: 'en-US' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
```

In `tsconfig.node.json` change `"include": ["vite.config.ts"]` to `"include": ["vite.config.ts", "playwright.config.ts"]`. In `tsconfig.test.json` change `"include": ["tests", "src/core"]` to `"include": ["tests", "e2e", "src/core", "src/debug.ts"]` (the e2e specs need the `window.__app` declaration) and add `"DOM"` to its `lib` (`"lib": ["ES2023", "DOM"]`) so `page.evaluate` callbacks type-check.

- [ ] **Step 3: e2e helpers and the failing shell spec**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test'

/** Collects page errors and console errors; call expectNoErrors() at the end of a test. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return { expectNoErrors: () => expect(errors).toEqual([]) }
}

export async function openApp(page: Page) {
  await page.goto('./')
  await expect(page.getByTestId('status')).toContainText('nodes')
  await page.waitForFunction(() => window.__app?.getState().busy === false)
}

export async function waitIdle(page: Page) {
  await page.waitForFunction(() => window.__app?.getState().busy === false)
}
```

`e2e/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { openApp, trackErrors, waitIdle } from './helpers'

test('loads with a random graph', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  await expect(page.getByRole('heading', { name: 'Graph Coloring' })).toBeVisible()
  await expect(page.getByTestId('status')).toContainText('50 nodes')
  await expect(page.getByTestId('status')).toContainText('d = 1')
  errors.expectNoErrors()
})

test('colors and improves', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  await page.getByRole('button', { name: 'Color', exact: true }).click()
  await waitIdle(page)
  await expect(page.getByTestId('status')).toContainText(/\d+ colors?/)
  await page.getByRole('button', { name: 'Improve ×5' }).click()
  await waitIdle(page)
  const rounds = await page.evaluate(() => window.__app!.getState().rounds)
  expect(rounds.length).toBe(6)
  for (let i = 1; i < rounds.length; i++) expect(rounds[i]).toBeLessThanOrEqual(rounds[i - 1])
  errors.expectNoErrors()
})

test('loads the DC dataset and matches the C program', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  await page.getByRole('radio', { name: 'Dataset' }).click()
  await page.getByRole('combobox', { name: 'Dataset' }).click()
  await page.getByRole('option', { name: 'DC · 9,522 nodes' }).click()
  await page.getByRole('button', { name: 'Load' }).click()
  await waitIdle(page)
  await expect(page.getByTestId('status')).toContainText('9,522 nodes')
  await page.getByRole('button', { name: 'Color', exact: true }).click()
  await waitIdle(page)
  await expect(page.getByTestId('status')).toContainText('4 colors')
  errors.expectNoErrors()
})

test('switches the language and remembers it', async ({ page }) => {
  await openApp(page)
  await page.getByRole('radio', { name: 'DE' }).click()
  await expect(page.getByRole('button', { name: 'Erzeugen' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Erzeugen' })).toBeVisible()
})

test('toggles the theme and remembers it', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Toggle dark mode' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('ignores invalid numbers', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  const distance = page.getByLabel('Distance d')
  await distance.fill('11')
  await distance.blur()
  await expect(distance).toHaveValue('1')
  const seed = page.getByLabel('Seed')
  await seed.fill('-5')
  await seed.blur()
  await expect(seed).toHaveValue('42')
  await expect(page.getByTestId('status')).toContainText('d = 1')
  errors.expectNoErrors()
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm run test:e2e -- --project=chromium`
Expected: FAIL — the placeholder page has no status badge (`getByTestId('status')` not found).

- [ ] **Step 5: Debug hook, styles and entry point**

`src/debug.ts`:

```ts
import { classColor } from '@/lib/colors'
import type { AppState } from '@/store/appStore'
import type Sigma from 'sigma'

declare global {
  interface Window {
    /** Read-only hooks for the end-to-end tests. */
    __app?: { getState: () => AppState; classColor: (i: number) => string }
    __sigma?: Sigma
  }
}

export function exposeDebugHooks(getState: () => AppState) {
  window.__app = { getState, classColor }
}
```

Append to `src/index.css`:

```css
@layer base {
  html,
  body,
  #root {
    height: 100%;
  }
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { exposeDebugHooks } from '@/debug'
import { initI18n } from '@/i18n'
import { appStore } from '@/store'

exposeDebugHooks(appStore.getState)

void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
        <TooltipProvider>
          <App />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
```

- [ ] **Step 6: Components**

`src/components/LanguageSwitch.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LANGUAGES, saveLanguage, type Language } from '@/i18n'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      aria-label={t('language.label')}
      value={i18n.language}
      onValueChange={(value) => {
        if (!value) return
        saveLanguage(value as Language)
        void i18n.changeLanguage(value)
      }}
    >
      {LANGUAGES.map((language) => (
        <ToggleGroupItem key={language} value={language} aria-label={language.toUpperCase()}>
          {language.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

`src/components/ThemeToggle.tsx`:

```tsx
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  return (
    <Button variant="ghost" size="icon" aria-label={t('theme.toggle')} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
```

`src/components/TopBar.tsx`:

```tsx
import { ExternalLinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeToggle } from './ThemeToggle'

const REPOSITORY = 'https://github.com/GhassanAbuKhaled/GraphVisualisierung'

export function TopBar() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{t('app.title')}</h1>
        <p className="truncate text-xs text-muted-foreground">{t('app.subtitle')}</p>
      </div>
      <LanguageSwitch />
      <ThemeToggle />
      <Button variant="ghost" size="sm" asChild>
        <a href={REPOSITORY} target="_blank" rel="noreferrer">
          {t('app.github')}
          <ExternalLinkIcon />
        </a>
      </Button>
    </header>
  )
}
```

`src/components/StatusBadge.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store'

export function StatusBadge() {
  const { t } = useTranslation()
  const graph = useApp((s) => s.graph)
  const d = useApp((s) => s.d)
  const coloring = useApp((s) => s.coloring)
  if (!graph) return null
  const parts = [
    t('status.nodes', { count: graph.n }),
    t('status.edges', { count: graph.edgeCount }),
    t('status.distance', { d }),
  ]
  if (coloring) parts.push(t('status.colors', { count: coloring.numColors }))
  return (
    <div
      data-testid="status"
      className="pointer-events-none absolute top-3 right-3 rounded-md border bg-background/80 px-3 py-1.5 text-sm font-medium backdrop-blur"
    >
      {parts.join(' · ')}
    </div>
  )
}
```

`src/components/BusyOverlay.tsx`:

```tsx
import { LoaderCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { appStore, useApp } from '@/store'

export function BusyOverlay() {
  const { t } = useTranslation()
  const busy = useApp((s) => s.busy)
  const progress = useApp((s) => s.progress)
  if (!busy) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
      <div className="flex w-64 flex-col items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {t('status.computing')}
        </div>
        {progress !== null && <Progress value={Math.round(progress * 100)} className="w-full" />}
        <Button variant="outline" size="sm" onClick={() => void appStore.getState().cancel()}>
          {t('status.cancel')}
        </Button>
      </div>
    </div>
  )
}
```

`src/components/ControlPanel.tsx`:

```tsx
import { ChevronDownIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DATASETS } from '@/data/datasets'
import type { DatasetId } from '@/engine/types'
import { appStore, useApp } from '@/store'
import { LABEL_LIMIT, MAX_DISTANCE, MAX_IMPROVE_ROUNDS, MAX_RANDOM_NODES, type SourceKind } from '@/store/appStore'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ id, label, value, children }: { id: string; label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {value !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}

/** Number input that only commits valid values; shows the stored value again on blur. */
function NumberInput({ id, value, min, max, onCommit }: { id: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== '') onCommit(Number(draft))
        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

export function ControlPanel() {
  const { t } = useTranslation()
  const sourceKind = useApp((s) => s.sourceKind)
  const random = useApp((s) => s.random)
  const datasetId = useApp((s) => s.datasetId)
  const d = useApp((s) => s.d)
  const busy = useApp((s) => s.busy)
  const graph = useApp((s) => s.graph)
  const coloring = useApp((s) => s.coloring)
  const display = useApp((s) => s.display)
  const [improveRounds, setImproveRounds] = useState(5)
  const actions = appStore.getState()
  const labelsOn = display.showLabels ?? (graph ? graph.n <= LABEL_LIMIT : true)

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b p-4 md:w-72 md:border-r md:border-b-0">
      <Section title={t('graph.heading')}>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={sourceKind}
          onValueChange={(value) => value && actions.setSourceKind(value as SourceKind)}
        >
          <ToggleGroupItem value="random" className="flex-1" aria-label={t('graph.random')}>
            {t('graph.random')}
          </ToggleGroupItem>
          <ToggleGroupItem value="dataset" className="flex-1" aria-label={t('graph.dataset')}>
            {t('graph.dataset')}
          </ToggleGroupItem>
        </ToggleGroup>

        {sourceKind === 'random' ? (
          <>
            <Field id="nodes" label={t('graph.nodes')} value={random.n}>
              <Slider
                id="nodes"
                thumbLabel={t('graph.nodes')}
                min={1}
                max={MAX_RANDOM_NODES}
                step={1}
                value={[random.n]}
                onValueChange={([n]) => actions.setRandom({ n })}
              />
            </Field>
            <Field id="density" label={t('graph.density')} value={random.p.toFixed(2)}>
              <Slider
                id="density"
                thumbLabel={t('graph.density')}
                min={0.01}
                max={1}
                step={0.01}
                value={[random.p]}
                onValueChange={([p]) => actions.setRandom({ p: Math.round(p * 100) / 100 })}
              />
            </Field>
            <Field id="seed" label={t('graph.seed')}>
              <NumberInput id="seed" value={random.seed} min={0} max={Number.MAX_SAFE_INTEGER} onCommit={(seed) => actions.setRandom({ seed })} />
            </Field>
            <Button disabled={busy} onClick={() => void actions.generate()}>
              {t('graph.generate')}
            </Button>
          </>
        ) : (
          <>
            <Field id="dataset" label={t('graph.dataset')}>
              <Select value={datasetId} onValueChange={(value) => actions.setDataset(value as DatasetId)}>
                <SelectTrigger id="dataset" className="w-full" aria-label={t('graph.dataset')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {t('graph.datasetOption', { name: dataset.id, count: dataset.vertices })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button disabled={busy} onClick={() => void actions.generate()}>
              {t('graph.load')}
            </Button>
          </>
        )}
      </Section>

      <Separator />

      <Section title={t('coloring.heading')}>
        <Field id="distance" label={t('coloring.distance')}>
          <NumberInput id="distance" value={d} min={1} max={MAX_DISTANCE} onCommit={(value) => void actions.setDistance(value)} />
        </Field>
        <Button disabled={busy || !graph} onClick={() => void actions.color()}>
          {t('coloring.color')}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy || !coloring}
            onClick={() => void actions.improve(improveRounds)}
          >
            {t('coloring.improve', { count: improveRounds })}
          </Button>
          <div className="w-20">
            <NumberInput
              id="improve-rounds"
              value={improveRounds}
              min={1}
              max={MAX_IMPROVE_ROUNDS}
              onCommit={(value) => {
                if (Number.isInteger(value) && value >= 1 && value <= MAX_IMPROVE_ROUNDS) setImproveRounds(value)
              }}
            />
          </div>
        </div>
      </Section>

      <Separator />

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('display.heading')}
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-3">
          <Field id="node-size" label={t('display.nodeSize')} value={display.nodeSize}>
            <Slider id="node-size" thumbLabel={t('display.nodeSize')} min={1} max={15} step={1} value={[display.nodeSize]} onValueChange={([nodeSize]) => actions.setDisplay({ nodeSize })} />
          </Field>
          <div className="flex items-center justify-between">
            <Label htmlFor="labels">{t('display.labels')}</Label>
            <Switch id="labels" checked={labelsOn} onCheckedChange={(showLabels) => actions.setDisplay({ showLabels })} />
          </div>
          <Field id="edge-opacity" label={t('display.edgeOpacity')} value={display.edgeOpacity.toFixed(2)}>
            <Slider
              id="edge-opacity"
              thumbLabel={t('display.edgeOpacity')}
              min={0.05}
              max={1}
              step={0.05}
              value={[display.edgeOpacity]}
              onValueChange={([edgeOpacity]) => actions.setDisplay({ edgeOpacity })}
            />
          </Field>
          <Button variant="outline" disabled={!graph} onClick={() => actions.relayout()}>
            {t('display.relayout')}
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  )
}
```

`src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BusyOverlay } from '@/components/BusyOverlay'
import { ControlPanel } from '@/components/ControlPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { TopBar } from '@/components/TopBar'
import { appStore, useApp } from '@/store'

export default function App() {
  const { t } = useTranslation()
  const error = useApp((s) => s.error)

  useEffect(() => {
    void appStore.getState().generate()
  }, [])

  useEffect(() => {
    if (!error) return
    toast.error(t(error.key, error))
    appStore.getState().dismissError()
  }, [error, t])

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ControlPanel />
        <div className="relative min-h-[60vh] flex-1 md:min-h-0">
          <div data-testid="graph-canvas" className="absolute inset-0" />
          <StatusBadge />
          <BusyOverlay />
        </div>
      </main>
    </div>
  )
}
```

(`useEffect` with `generate()` runs twice in React StrictMode during development; the second run supersedes the first through the store's operation token. Production builds run it once.)

- [ ] **Step 7: Run unit checks**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint`
Expected: all pass (lint warnings from shadcn files allowed).

- [ ] **Step 8: Run the e2e suite**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm run test:e2e`
Expected: 12 passed (6 tests × chromium, webkit).

- [ ] **Step 9: Confirm the worker is bundled**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && ls dist/assets | grep -c worker`
Expected: `1`.

- [ ] **Step 10: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add -A
git commit -m "Add app shell, control panel, status badge, theme and language switch

Includes the Playwright end-to-end harness (Chromium + WebKit).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Graph canvas (Sigma + ForceAtlas2)

**Files:**
- Create: `src/components/GraphCanvas.tsx`, `e2e/canvas.spec.ts`
- Modify: `src/App.tsx` (replace the placeholder), `src/debug.ts` (nothing if `sigma` was installed in Task 7)

**Interfaces:**
- Consumes: `toGraphology` (Task 3), `classColor`, `UNCOLORED` (Task 3), `useApp`, `appStore` (Task 6), `window.__sigma` (Task 7 `debug.ts`)
- Produces: `GraphCanvas` component; sets `layoutRunning` in the store while ForceAtlas2 runs; exposes `window.__sigma`

- [ ] **Step 1: Write the failing canvas spec**

`e2e/canvas.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { openApp, trackErrors, waitIdle } from './helpers'

async function waitLayout(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__sigma !== undefined && window.__app?.getState().layoutRunning === false)
}

test('draws every node and edge', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  await waitLayout(page)
  const counts = await page.evaluate(() => ({
    order: window.__sigma!.getGraph().order,
    size: window.__sigma!.getGraph().size,
    edges: window.__app!.getState().graph!.edgeCount,
  }))
  expect(counts.order).toBe(50)
  expect(counts.size).toBe(counts.edges)
  errors.expectNoErrors()
})

test('paints every node with its class color', async ({ page }) => {
  const errors = trackErrors(page)
  await openApp(page)
  await page.getByRole('button', { name: 'Color', exact: true }).click()
  await waitIdle(page)
  const mismatches = await page.evaluate(() => {
    const { coloring } = window.__app!.getState()
    const sigma = window.__sigma!
    const wrong: string[] = []
    sigma.getGraph().forEachNode((node) => {
      const expected = window.__app!.classColor(coloring!.colorOf[Number(node)])
      const actual = sigma.getNodeDisplayData(node)?.color
      if (actual !== expected) wrong.push(`${node}: ${actual} != ${expected}`)
    })
    return wrong
  })
  expect(mismatches).toEqual([])
  errors.expectNoErrors()
})

test('keeps every node inside the canvas after the layout', async ({ page }) => {
  await openApp(page)
  await waitLayout(page)
  const outside = await page.evaluate(() => {
    const sigma = window.__sigma!
    const { width, height } = sigma.getDimensions()
    let count = 0
    sigma.getGraph().forEachNode((node) => {
      const data = sigma.getNodeDisplayData(node)!
      const p = sigma.graphToViewport(data)
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) count++
    })
    return count
  })
  expect(outside).toBe(0)
})

test('shows labels for small graphs and hides them above 200 nodes', async ({ page }) => {
  await openApp(page)
  await waitLayout(page)
  expect(await page.evaluate(() => window.__sigma!.getSetting('renderLabels'))).toBe(true)
  await page.getByRole('slider', { name: 'Nodes' }).focus()
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Generate' }).click()
  await waitIdle(page)
  await expect(page.getByTestId('status')).toContainText('1,000 nodes')
  await waitLayout(page)
  expect(await page.evaluate(() => window.__sigma!.getSetting('renderLabels'))).toBe(false)
})

test('display controls change the drawing', async ({ page }) => {
  await openApp(page)
  await waitLayout(page)
  await page.getByRole('button', { name: 'Display' }).click()
  await page.getByRole('switch', { name: 'Show labels' }).click()
  expect(await page.evaluate(() => window.__sigma!.getSetting('renderLabels'))).toBe(false)
  await page.getByRole('slider', { name: 'Node size' }).focus()
  await page.keyboard.press('End')
  const size = await page.evaluate(() => window.__sigma!.getNodeDisplayData('0')!.size)
  expect(size).toBe(15)
  await page.getByRole('button', { name: 'Re-layout' }).click()
  await page.waitForFunction(() => window.__app!.getState().layoutRunning === true)
  await waitLayout(page)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm run test:e2e -- --project=chromium e2e/canvas.spec.ts`
Expected: FAIL — `window.__sigma` is never set.

- [ ] **Step 3: Implement `src/components/GraphCanvas.tsx`**

```tsx
import type Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import Sigma from 'sigma'
import { classColor } from '@/lib/colors'
import { toGraphology } from '@/lib/graphModel'
import { appStore, useApp } from '@/store'
import { LABEL_LIMIT } from '@/store/appStore'

/** Layout run time: longer for bigger graphs, capped so the page settles quickly. */
const layoutDuration = (order: number) => Math.min(6000, 1500 + 2 * order)

export function GraphCanvas() {
  const container = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const graph = useApp((s) => s.graph)
  const layoutVersion = useApp((s) => s.layoutVersion)
  const coloring = useApp((s) => s.coloring)
  const display = useApp((s) => s.display)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'

  // New graph → new Sigma instance
  useEffect(() => {
    if (!graph || !container.current) return
    const g = toGraphology(graph)
    const sigma = new Sigma(g, container.current, { renderLabels: false, labelSize: 11, zIndex: true })
    graphRef.current = g
    sigmaRef.current = sigma
    window.__sigma = sigma
    return () => {
      sigma.kill()
      sigmaRef.current = null
      graphRef.current = null
      window.__sigma = undefined
    }
  }, [graph])

  // Layout: on every new graph and on "Re-layout"
  useEffect(() => {
    const g = graphRef.current
    if (!g) return
    const layout = new FA2Layout(g, {
      settings: { ...forceAtlas2.inferSettings(g), barnesHutOptimize: g.order > 500 },
    })
    appStore.setState({ layoutRunning: true })
    layout.start()
    const timer = setTimeout(() => {
      layout.stop()
      appStore.setState({ layoutRunning: false })
    }, layoutDuration(g.order))
    return () => {
      clearTimeout(timer)
      layout.kill()
      appStore.setState({ layoutRunning: false })
    }
  }, [graph, layoutVersion])

  // Colors, sizes, labels and theme
  useEffect(() => {
    const sigma = sigmaRef.current
    if (!sigma || !graph) return
    const colorOf = coloring?.colorOf
    const neutral = dark ? '#a1a1aa' : '#52525b'
    const edgeRgb = dark ? '161, 161, 170' : '82, 82, 91'
    sigma.setSetting('renderLabels', display.showLabels ?? graph.n <= LABEL_LIMIT)
    sigma.setSetting('labelColor', { color: dark ? '#e4e4e7' : '#27272a' })
    sigma.setSetting('nodeReducer', (node, data) => ({
      ...data,
      size: display.nodeSize,
      color: colorOf ? classColor(colorOf[Number(node)]) : neutral,
    }))
    sigma.setSetting('edgeReducer', (_edge, data) => ({
      ...data,
      color: `rgba(${edgeRgb}, ${display.edgeOpacity})`,
    }))
  }, [graph, coloring, display, dark])

  return <div ref={container} className="absolute inset-0" />
}
```

- [ ] **Step 4: Use it in `src/App.tsx`**

Replace `<div data-testid="graph-canvas" className="absolute inset-0" />` with `<GraphCanvas />` and add `import { GraphCanvas } from '@/components/GraphCanvas'`.

- [ ] **Step 5: Run unit checks and the full e2e suite**

Run: `cd /Users/ghassanabukhaled/Developer/GraphVisualisierung && npm test && npx tsc -b && npm run lint && npm run test:e2e`
Expected: unit tests pass; e2e 22 passed (11 tests × 2 browsers).

- [ ] **Step 6: Look at it**

Take screenshots for a visual check (not committed):

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npx playwright screenshot --browser webkit --viewport-size "1300,850" --wait-for-timeout 4000 "http://127.0.0.1:4180/GraphVisualisierung/" /tmp/gv-phase2.png
```

(Requires the preview server: run `npx vite preview --port 4180 --host 127.0.0.1` in the background first and stop it afterwards.) Check: nodes visible and spread, status badge readable in dark and light mode, control panel not clipped.

- [ ] **Step 7: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add src/components/GraphCanvas.tsx src/App.tsx e2e/canvas.spec.ts
git commit -m "Draw the graph with Sigma and ForceAtlas2 and paint class colors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: GitHub Pages workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:** none. Configuration only (TDD exception); verified by YAML parsing and a production build check. The workflow only runs once `redesign` is merged into `main` and the repository's Pages source is switched to **GitHub Actions** (user action, at merge time).

- [ ] **Step 1: Write the workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify**

Run:

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo yaml-ok
npm run build > /dev/null && grep -o 'src="/GraphVisualisierung/assets/[^"]*"' dist/index.html && ls dist/data
```

Expected: `yaml-ok`; the script tag path starts with `/GraphVisualisierung/assets/`; `dist/data` lists `DC.txt minnesota.txt yeast.txt`.

- [ ] **Step 3: Commit**

```bash
cd /Users/ghassanabukhaled/Developer/GraphVisualisierung
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deploy workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
