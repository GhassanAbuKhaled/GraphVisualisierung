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

test('draws edges with an opaque color that follows the opacity setting', async ({ page }) => {
  await openApp(page)
  await waitLayout(page)
  const edgeColor = () =>
    page.evaluate(() => {
      const sigma = window.__sigma!
      return sigma.getEdgeDisplayData(sigma.getGraph().edges()[0])!.color
    })
  const before = await edgeColor()
  expect(before).toMatch(/^#[0-9a-f]{6}$/)
  await page.getByRole('button', { name: 'Display' }).click()
  await page.getByRole('slider', { name: 'Edge opacity' }).focus()
  await page.keyboard.press('End')
  const after = await edgeColor()
  expect(after).toMatch(/^#[0-9a-f]{6}$/)
  expect(after).not.toBe(before)
})
