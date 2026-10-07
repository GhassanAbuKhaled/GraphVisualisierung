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
