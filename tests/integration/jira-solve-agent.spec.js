const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Jira Solve Agent Module @jira-solve-agent', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('shows the module with metrics and issues from fixture data', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    // Scoped to main: the core app shell also renders the page title in the header.
    await expect(page.getByRole('main').getByRole('heading', { name: 'OpenShift Jira Solve Agent' })).toBeVisible()

    // Verify stat cards are visible - scope to stat cards grid to avoid matching filter dropdowns and table cells
    const statCardsGrid = page.locator('.p-6.grid.gap-4')
    await expect(statCardsGrid.getByText('Total Issues')).toBeVisible()
    await expect(statCardsGrid.getByText('New')).toBeVisible()
    await expect(statCardsGrid.getByText('In Progress')).toBeVisible()
    await expect(statCardsGrid.getByText('Closed')).toBeVisible()

    // Verify fixture data issues are visible (fixture has TRT-1001, OCPBUGS-60001, TRT-1002)
    await expect(page.getByRole('link', { name: 'TRT-1001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'OCPBUGS-60001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'TRT-1002' })).toBeVisible()

    // Verify no console errors
    expect(page.errors).toHaveLength(0)
  })
})
