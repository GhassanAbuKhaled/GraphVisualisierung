# Graph Coloring Visualizer

An interactive web page for the greedy **distance-d graph coloring** algorithm:
vertices that are at most `d` edges apart always receive different colors. It is
the visual counterpart of the C implementation in the companion project
*Abschlussprojekt*, and reproduces its results exactly (see [Tests](#tests)).

> **Status:** this branch (`redesign`) is a rebuild of the original plain-JS page
> (still on `main` and live on GitHub Pages) with React, TypeScript and WebGL.
> Phases 1–2 of 6 are done, see [Roadmap](#roadmap).

## Features

- Random graphs (1–1000 nodes, edge density, seed) and the real datasets from
  the C project: `yeast` (2,361 nodes), `minnesota` (2,642) and `DC` (9,522)
- Distance d from 1 to 10, greedy coloring and improvement rounds that reshuffle
  the color classes (the number of colors never increases)
- All computation runs in a Web Worker, with progress and a Cancel button
- WebGL drawing (Sigma.js) with a ForceAtlas2 layout
- English and German, dark and light mode

## Development

Requires Node.js 24.

```sh
npm install
npm run dev        # http://localhost:5173/GraphVisualisierung/
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright, Chromium + WebKit)
npm run build      # production build in dist/
```

`@playwright/test` is pinned to 1.60.0 so it uses the browsers already installed
on the development machine. After upgrading it, run `npx playwright install`.

## Tests

- **Unit tests** check the algorithm against independent brute-force results
  (all-pairs distances, 500 random graphs) and the store's behaviour under
  cancel, worker crashes and invalid input.
- **Parity with the C program:** the first coloring round must give exactly the
  same number of colors as the C program:

  | Dataset   | d = 1 | d = 2 | d = 3 |
  | --------- | ----- | ----- | ----- |
  | yeast     | 12    | 65    | 239   |
  | minnesota | 4     | 7     | 12    |
  | DC        | 4     | 9     | 15    |

- **Browser tests** run the production build in Chromium and WebKit (Safari).

## Project structure

| Path              | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `src/core/`       | The algorithm in plain TypeScript (no React, no browser APIs)     |
| `src/engine/`     | `ColoringEngine` interface, its implementation and the Web Worker |
| `src/store/`      | Application state (Zustand)                                       |
| `src/components/` | React components; `ui/` holds the shadcn/ui components            |
| `src/i18n/`       | English and German translations                                   |
| `public/data/`    | The datasets from the C project                                   |
| `tests/`, `e2e/`  | Unit tests and browser tests                                      |
| `docs/superpowers/` | Design spec and the implementation plans per phase             |

The full design is in
[`docs/superpowers/specs/2026-10-07-graph-coloring-redesign-design.md`](docs/superpowers/specs/2026-10-07-graph-coloring-redesign-design.md).

## Roadmap

| Phase | Content | Status |
| ----- | ------- | ------ |
| 1. Foundation | Project setup, algorithm in `src/core/`, parity with the C program | ✅ Done |
| 2. Basic app | Worker engine, store, Sigma canvas, controls, datasets, color + improve, EN/DE, themes, deploy workflow | ✅ Done |
| 3. Teaching features | Hover a vertex to highlight its distance-d neighborhood, color class panel (click to highlight), rounds chart | ⏳ Open |
| 4. Step player | Play / pause / step through the coloring, one explanatory sentence per step (graphs up to 300 nodes) | ⏳ Open |
| 5. Phone and release | Bottom drawer layout on phones, more browser tests, final README, merge into `main` | ⏳ Open |
| 6. WebAssembly | Run the C code of *Abschlussprojekt* in the browser behind the same `ColoringEngine` interface and compare results | ⏳ Later |

Each phase gets its own implementation plan in `docs/superpowers/plans/`
before work starts.

### Before merging into `main`

1. Finish phase 5.
2. In the repository settings, change **Settings → Pages → Source** from
   *Deploy from a branch* to **GitHub Actions**. The workflow in
   `.github/workflows/deploy.yml` then builds and deploys on every push to
   `main`. Until then, `main` keeps serving the old plain-JS page.

### Known issues to address later

- After a rare non-TooLarge error while changing d, the status badge can show a
  d the engine does not hold.
- A random graph with 1000 nodes and density 1 (≈ 500,000 edges) takes about
  0.65 s to build for drawing on the main thread.
- Turning labels on once keeps them on for later large graphs; automatic mode
  does not come back.
- No browser test yet for an invalid value in the improve-rounds field.
- The main JavaScript bundle is larger than 500 kB; it could be split.
- The `DC` dataset looks like one dense blob: 6 s of ForceAtlas2 is not enough
  to lay out 9,522 nodes.
- On phones the control panel takes most of the screen (planned for phase 5).
- The graph file parser has no upper limit for the vertex count in the header
  (only matters once users can upload their own files).
- Nothing enforces that `src/core/` stays free of browser and Node APIs.
