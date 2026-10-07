import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEngine } from '@/engine/engine'
import type { EngineHandle } from '@/engine/client'
import type { ColoringEngine, DatasetId } from '@/engine/types'
import { createAppStore, DEFAULT_RANDOM } from '@/store/appStore'

const files: Record<DatasetId, string> = { yeast: 'yeast.txt', minnesota: 'minnesota.txt', DC: 'DC.txt' }
const loadDataset = async (id: DatasetId) =>
  readFileSync(new URL(`../../public/data/${files[id]}`, import.meta.url), 'utf8')

/** Adds a delay to every call, like the real worker, so other actions can interleave. */
function slow(engine: ColoringEngine): ColoringEngine {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 5))
  return {
    loadGraph: async (source) => (await wait(), engine.loadGraph(source)),
    setDistance: async (d, onProgress) => (await wait(), engine.setDistance(d, onProgress)),
    colorFirst: async (options) => (await wait(), engine.colorFirst(options)),
    improve: async (rounds, seed) => (await wait(), engine.improve(rounds, seed)),
  }
}

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 1))
  expect(condition()).toBe(true)
}

function setup(options: { limit?: number; loader?: (id: DatasetId) => Promise<string>; slow?: boolean } = {}) {
  const handles: { terminated: boolean }[] = []
  let crash: () => void = () => {}
  const factory = (onCrash: () => void): EngineHandle => {
    crash = onCrash
    const record = { terminated: false }
    handles.push(record)
    return {
      engine: (options.slow ? slow : (e: ColoringEngine) => e)(
        createEngine({ loadDataset: options.loader ?? loadDataset, limit: options.limit }),
      ),
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

  it('ignores engine actions while another operation is running', async () => {
    const { store } = setup({ slow: true })
    await store.getState().generate()
    store.getState().setRandom({ n: 300 })
    const generating = store.getState().generate()
    await store.getState().setDistance(2)
    await store.getState().color()
    await generating
    expect(store.getState().d).toBe(1)
    expect(store.getState().graph?.n).toBe(300)
    await store.getState().color()
    expect(store.getState().coloring?.colorOf.length).toBe(300)
  })

  it('a cancel whose restore fails falls back to d = 1 and stays usable', async () => {
    const { store } = setup({ slow: true, limit: 600 })
    store.getState().setRandom({ n: 20, p: 0.1, seed: 7 })
    await store.getState().generate()
    await store.getState().setDistance(4)
    expect(store.getState().d).toBe(4)
    store.getState().setRandom({ n: 60 })
    const generating = store.getState().generate()
    await waitFor(() => store.getState().graph?.n === 60)
    await expect(store.getState().cancel()).resolves.toBeUndefined()
    await generating
    expect(store.getState().d).toBe(1)
    await store.getState().color()
    expect(store.getState().error).toBeNull()
    expect(store.getState().coloring?.colorOf.length).toBe(60)
  })

  it('stops restarting a worker that keeps crashing', async () => {
    const { store, handles, crash } = setup()
    await store.getState().generate()
    for (let i = 0; i < 10; i++) crash()
    expect(handles.length).toBeLessThanOrEqual(4)
    expect(store.getState().error).toEqual({ key: 'errors.crash' })
    expect(store.getState().busy).toBe(false)
    await store.getState().color()
    expect(store.getState().error).toEqual({ key: 'errors.crash' })
    expect(store.getState().busy).toBe(false)
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
