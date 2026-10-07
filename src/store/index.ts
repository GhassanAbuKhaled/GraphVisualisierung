import { useStore } from 'zustand'
import { createWorkerEngine } from '@/engine/client'
import { createAppStore, type AppState } from './appStore'

export const appStore = createAppStore(createWorkerEngine)

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}

export type { AppState } from './appStore'
