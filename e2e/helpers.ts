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
