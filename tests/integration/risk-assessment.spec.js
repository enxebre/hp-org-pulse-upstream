const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Agentic Risk Assessment Module @risk-assessment', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('shows Chai risk assessment shares grouped by repository', async ({ page }) => {
    await page.goto('/#/risk-assessment/main')
    await page.waitForLoadState('networkidle')

    const view = page.getByTestId('risk-assessment')
    await expect(view.getByRole('heading', { name: 'Agentic Risk Assessment', exact: true })).toBeVisible()

    const summary = view.getByTestId('risk-summary')
    await expect(summary.getByText('Assessed PRs', { exact: true })).toBeVisible()
    await expect(summary.getByText('Low', { exact: true })).toBeVisible()
    await expect(summary.getByText('Moderate', { exact: true })).toBeVisible()
    await expect(summary.getByText('Critical', { exact: true })).toBeVisible()

    // Fixture rows, most assessed PRs first.
    const rows = view.getByTestId('risk-repo-row')
    await expect(rows).toHaveCount(5)
    await expect(rows.first()).toContainText('openshift/hypershift')
    await expect(rows.first()).toContainText('78')
    await expect(rows.first()).toContainText('54%')
    await expect(rows.last()).toContainText('No assessed PRs')
    await expect(view.getByTestId('risk-totals-row')).toContainText('All repositories')

    expect(page.errors).toHaveLength(0)
  })
})
