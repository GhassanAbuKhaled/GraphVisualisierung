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
