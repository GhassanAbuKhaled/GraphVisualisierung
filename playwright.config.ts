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
