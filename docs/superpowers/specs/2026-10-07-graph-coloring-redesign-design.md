# Graph Coloring Visualizer — Redesign

- **Date:** 2026-10-07
- **Status:** Draft, awaiting review
- **Branch:** `redesign` (the previous plain-JS version stays on `main` until the redesign is merged)

## 1. Goal

Rebuild the GraphVisualisierung page as a modern React application that
visualizes the greedy distance-d graph coloring algorithm of the C project
*Abschlussprojekt*. The page serves three audiences at once:

1. **Thesis presentation**: explain the algorithm to the committee, reproducibly,
   on the same datasets the C program was tested with.
2. **Portfolio**: a modern, polished, publicly deployed page with clean code on GitHub.
3. **Teaching tool**: students explore coloring and the distance-d concept on their own.

### Success criteria

- For the first coloring round, the page produces **exactly the same number of colors
  as the C program** on the bundled datasets (see §6.2).
- Every coloring the page shows is valid: no two vertices of one color are at distance ≤ d.
- `DC.txt` (9,522 vertices, 29,614 edges) renders and colors without freezing the UI.
- The UI is available in English and German, works in dark and light mode, on desktop
  and phone widths, in Chromium and Safari/WebKit.
- The page is deployed on GitHub Pages.

### Non-goals (for now)

- Running the C code in the browser via WebAssembly (planned as a later phase; the
  architecture keeps it possible, see §3.2).
- Uploading user-provided graph files.
- Arabic UI / right-to-left layout.
- The large `graph.txt` dataset (250,986 edges, 2.9 MB).

## 2. Tech stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Build / dev server | Vite                                                          |
| UI                 | React + TypeScript (strict)                                   |
| Graph rendering    | Sigma.js (WebGL) + graphology                                 |
| Layout             | `graphology-layout-forceatlas2` in its Web Worker mode        |
| Styling / widgets  | Tailwind CSS + shadcn/ui (Radix based); Drawer (vaul) on phones |
| State              | Zustand                                                       |
| Worker messaging   | Comlink                                                       |
| i18n               | react-i18next (`en`, `de`)                                    |
| Unit tests         | Vitest                                                        |
| E2E tests          | Playwright (Chromium + WebKit, desktop + phone viewport)      |
| Deployment         | GitHub Pages via a GitHub Actions workflow                    |

Library versions: the current stable release of each at implementation time.

## 3. Architecture

```
src/
├── core/            Pure TypeScript. No React, no DOM, no worker APIs.
│   ├── graph.ts     Graph type (CSR) and helpers
│   ├── parser.ts    Parser for the C project's graph file format
│   ├── random.ts    Seeded random graph generator G(n, p)
│   ├── rng.ts       Seeded PRNG (e.g. mulberry32)
│   ├── distance.ts  Distance-d neighborhoods via depth-limited BFS
│   └── coloring.ts  Greedy coloring, improvement rounds, step trace
├── engine/
│   ├── types.ts     ColoringEngine interface
│   ├── worker.ts    Worker exposing a TypeScript ColoringEngine via Comlink
│   └── client.ts    Main-thread proxy used by the store
├── store/           Zustand store
├── components/      React components (see §4)
├── i18n/            en.json, de.json, setup
└── main.tsx
public/data/         yeast.txt, minnesota.txt, DC.txt (copied from Abschlussprojekt)
```

### 3.1 Data flow

1. The user changes a setting or presses a button.
2. The store calls the engine (in the worker) and sets `status: "busy"`.
3. The engine returns plain, transferable data (typed arrays where large).
4. The store saves the result; the canvas, color list and rounds chart re-render from the store.

Changing the graph or d clears the current coloring, trace and rounds history;
**Improve** is only enabled after **Color**. **Color** records a trace automatically
when n ≤ `STEP_LIMIT`.

The canvas never computes algorithm data; it only maps store state to Sigma
node/edge reducers (colors, highlighting, dimming).

### 3.2 Engine interface

```ts
interface ColoringEngine {
  loadGraph(source: GraphSource): Promise<GraphSummary>;
  // Builds the distance-d neighborhoods (d = 1 uses the graph itself).
  // Reports progress, can be aborted, fails with a size error above the limit (§5).
  setDistance(d: number, onProgress?: (fraction: number) => void): Promise<DistanceSummary>;
  // First round, natural vertex order 0..n-1. `trace` only allowed for n <= STEP_LIMIT.
  colorFirst(options: { trace: boolean }): Promise<ColoringResult>;
  // `rounds` improvement rounds, continuing from the last result.
  improve(rounds: number, seed: number): Promise<ColoringResult[]>;
}
```

`GraphSource` is either `{ kind: "random", n, p, seed }` or `{ kind: "dataset", name }`.
The worker holds the graph and the distance neighborhoods; only results cross the
boundary. A later WebAssembly engine implements the same interface, so no UI code changes.

`ColoringResult`:

```ts
{
  colorOf: Int32Array;      // class index per vertex, -1 = not colored (no edges)
  classes: number[][];      // members per class, in insertion order
  numColors: number;
  trace?: Step[];
}
type Step = {
  vertex: number;
  rejected: { classIndex: number; witness: number }[]; // witness = a conflicting member
  placedIn: number;
  createdNewClass: boolean;
};
```

## 4. User interface

### 4.1 Desktop layout

- **Top bar:** title, language switch (EN | DE), theme toggle (dark default), GitHub link.
- **Left panel:**
  - *Graph*: source (Random | Dataset ▾). Random: nodes slider (1–1000), density slider
    (0.01–1), seed field, **Generate**. Dataset: yeast / minnesota / DC with their sizes.
  - *Coloring*: distance d (number stepper, 1–10), **Color**, **Improve ×N** (N = 1–50).
  - *Display* (collapsed): node size, show labels, edge opacity, **Re-layout**.
- **Center:** Sigma canvas filling the area. A status badge shows nodes, edges, d and colors.
  The step player sits at the bottom of the canvas when a trace exists.
- **Right panel:** color class list and rounds chart.

### 4.2 Interactions

- **Hover a vertex:** highlight it and all vertices within distance d, dim the rest;
  tooltip with id, degree, color class.
- **Click a color class:** highlight its members; click again to clear.
- **Step player:** first / previous / play-pause / next / last, speed slider, "step k / n",
  and one explanatory sentence per step, e.g. *"Vertex 7 → color 2 (color 1 rejected:
  conflict with vertex 3)"*. Hidden for graphs above `STEP_LIMIT = 300` vertices, with a
  note explaining why.
- **Rounds chart:** colors per round (round 0 = first coloring); small inline SVG, no chart library.

### 4.3 Phone layout (≤ 768 px)

Canvas full screen; top bar collapses to title + menu. Controls, color classes and the
rounds chart move into a bottom drawer with three tabs. No horizontal scrolling at 320 px.

### 4.4 Visual rules

- Colors: classes 0–9 use the Tableau 10 palette; further classes use golden-angle hue
  spacing (`hue = i × 137.508° mod 360`) so consecutive classes differ clearly.
  Uncolored vertices (no edges) are gray.
- Labels are hidden automatically above 200 vertices (toggle still available).
- `color-scheme` matches the active theme so native controls stay visible (Safari).
- Font: Inter.

### 4.5 i18n

All user-facing strings come from `en.json` / `de.json`. Initial language: saved
choice, else browser language, else English. Language and theme are persisted in
`localStorage` (wrapped in try/catch; the app works without it).

## 5. Algorithm (must match the C project)

### 5.1 Graph file format

```
vertices, edges, edgesProbability <n>, <m>, <p>
e <u> <v>
...
```

Whitespace around commas varies between files (`5000 , 250986` vs `2361, 13828`).
Edge lines are sorted by `u`; every edge appears in both directions; self-loops
(`e v v`) occur (536 in yeast). Parse errors report the line number.

### 5.2 Colorable vertices

As in C, a vertex is colored only if it has at least one edge line in the input
**including self-loops**. Vertices without any edge line keep `colorOf = -1`.
For random graphs this means degree ≥ 1.

### 5.3 Distance-d neighborhoods

`N_d(v)` = all vertices `u ≠ v` with shortest-path distance 1 ≤ dist(v, u) ≤ d,
computed by BFS from every colorable vertex, stopping at depth d (as `bfs.c`).
Stored as CSR (`Int32Array` offsets + neighbors). For d = 1 this is the adjacency
without self-loops.

**Size limit:** if the total neighbor count would exceed 20,000,000 entries the
engine aborts with a `TooLarge` error and the UI suggests a smaller d. The build
runs in the worker, reports progress and can be cancelled.

### 5.4 First round

Visit vertices in order 0..n-1, skipping non-colorable ones. Place each vertex in the
first class that contains no member of `N_d(v)`; if none, open a new class. (This equals
"smallest class index not used by any colored neighbor in `N_d(v)`", which the
implementation may use for speed; the trace still records one witness per rejected class.)

### 5.5 Improvement round (as `randomShuffleSets` in `set.c`)

1. Shuffle the class order with Fisher–Yates (`for i = k-1 … 1: j = rand(0..i); swap`).
2. New vertex order = members of each class in the shuffled order, members in insertion order.
3. Re-run §5.4 with that order.

This never increases the number of colors. The PRNG is seeded (`seed + round`), so
results are reproducible; they are not expected to match C's `rand()` sequence.

## 6. Testing

### 6.1 Unit tests (Vitest, `core/`)

- Parser: both header spacings, self-loops, malformed lines (error with line number).
- Distance: `N_d` equals a brute-force all-pairs BFS on random graphs (n ≤ 60, d = 1..4).
- Coloring validity: on 500 seeded random graphs and d = 1..3, no conflicts, every
  colorable vertex colored, non-colorable vertices uncolored.
- Improvement: colors never increase over 20 rounds.
- Reproducibility: same seed → identical graph and identical coloring.
- Trace: replaying the steps reproduces `colorOf`.

### 6.2 Parity with the C program (Vitest, bundled datasets)

First-round color counts recorded from the C program on 2026-10-07:

| Dataset   | d = 1 | d = 2 | d = 3 |
| --------- | ----- | ----- | ----- |
| yeast     | 12    | 65    | 239   |
| minnesota | 4     | 7     | 12    |
| DC        | 4     | 9     | 15    |

The TypeScript engine must reproduce these numbers exactly.

### 6.3 E2E tests (Playwright)

Chromium and WebKit, 1300×850 and 390×844: load page, generate, color, improve,
step through a trace, load each dataset, switch language and theme, hover highlight;
no console errors; no vertex outside the canvas; no horizontal scroll at 320 px.

## 7. Error handling

- File/parse error: message with line number; previous graph stays loaded.
- Distance size limit: `TooLarge` error → explanatory message, d resets to the last valid value.
- Worker crash or unexpected error: toast, engine restarts, UI stays usable.
- Long operations show progress and a Cancel button.

## 8. Phases

Each phase ends with a working, deployable page.

1. **Foundation:** Vite + React + TS + Tailwind + shadcn/ui setup, `core/` with all unit
   and parity tests passing.
2. **Basic app:** engine worker, store, Sigma canvas with ForceAtlas2, left panel,
   datasets, color + improve, status badge, i18n, themes, GitHub Pages workflow.
   The old plain-JS files are removed from the branch (they remain in git history).
3. **Teaching features:** hover neighborhood, color class panel, rounds chart.
4. **Step player.**
5. **Phone layout, E2E tests, README.**
6. **Later:** WebAssembly engine running the C code (separate spec).

## 9. Notes

- GitHub Pages must be enabled for the repository (Settings → Pages → Source: GitHub
  Actions). Vite `base` is `/GraphVisualisierung/`.
- The bundled datasets are copied from `Abschlussprojekt/data/`; their total size is ~570 KB.
