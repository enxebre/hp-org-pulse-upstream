const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Agentic Bug Pipeline @bug-pipeline', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('opens the pipeline from its home card in the current tab', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('strategic-initiatives').getByRole('link', { name: /Agentic Bug Pipeline/ })
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('href', '#/bug-pipeline/main')
    await expect(card).not.toHaveAttribute('target', '_blank')
    await card.click()
    await expect(page).toHaveURL(/#\/bug-pipeline\/main$/)
    await expect(page.getByTestId('bug-pipeline').getByRole('heading', { name: 'Agentic Bug Pipeline', exact: true })).toBeVisible()
    await expect(page.getByTestId('bug-pipeline').locator('tbody > tr')).toHaveCount(3)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('has its own sidebar section outside Agentic Bug Refinement', async ({ page }) => {
    await page.goto('/')
    const sections = page.locator('aside nav > div')
    const pipelineSection = sections.filter({ has: page.locator('button[aria-expanded][aria-label="Agentic Bug Pipeline"]') })
    const refinementSection = sections.filter({ has: page.locator('button[aria-expanded][aria-label="Agentic Bug Refinement"]') })
    await expect(pipelineSection).toHaveCount(1)
    await expect(refinementSection).toHaveCount(1)
    await expect(refinementSection.getByRole('button', { name: 'Agentic Bug Pipeline', exact: true })).toHaveCount(0)
    const header = pipelineSection.locator('button[aria-expanded]')
    if (await header.getAttribute('aria-expanded') === 'false') await header.click()
    await expect(pipelineSection.locator('button:not([aria-expanded])')).toHaveText(['Agentic Bug Pipeline'])
    await pipelineSection.locator('button:not([aria-expanded])').click()
    await expect(page).toHaveURL(/#\/bug-pipeline\/main$/)
    await expect(page.getByTestId('bug-pipeline').locator('tbody > tr')).toHaveCount(3)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('shows pipeline percentages for refined OCPBUGS issues, solves, and backports', async ({ page }) => {
    await page.goto('/#/bug-pipeline/main')
    const view = page.getByTestId('bug-pipeline')
    await expect(view.getByTestId('pipeline-demo')).toContainText('fictional examples, not results from Jira')
    await expect(view.locator('[data-testid^="stage-"] .text-3xl')).toHaveText(['3', '33%', '0%', '33%', '33%', '100%', '50%'])
    await expect(view.locator('[data-testid^="stage-"] p:nth-child(2)')).toHaveText(['Refined bugs', 'Close', 'Need human analysis', 'Needs info', 'Sent to solve', 'Solve merged', 'Backports merged'])
    await expect(view.getByTestId('stage-NEEDS_INFO')).toContainText('1 of 3 refined bugs')
    await expect(view.getByTestId('stage-merged')).toHaveText(/1 of 1 sent to solve$/)
    await expect(view.getByTestId('stage-backports')).toContainText('1 of 2 linked backports')
    const all = view.getByTestId('pipeline-team-all')
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    await expect(all.locator('[data-testid^="rate-"]')).toHaveText(['3', '33%', '0%', '33%', '33%', '100%', '50%'])
    await expect(all).not.toContainText(' of ')
    await expect(all).not.toContainText('PR posted')
    await expect(view.getByRole('group', { name: 'Filter by component', exact: true }).getByRole('button')).toHaveCount(3)
    await expect(view.getByRole('heading', { name: 'Refined bugs (3)', exact: true })).toBeVisible()
    await expect(view.getByRole('columnheader', { name: 'Disposition', exact: true })).toBeVisible()
    const rows = view.locator('tbody > tr')
    await expect(view.getByRole('columnheader', { name: 'Updated', exact: true })).toHaveAttribute('aria-sort', 'descending')
    await expect(rows.locator('td:first-child')).toHaveText(['OCPBUGS-10001 (example)', 'OCPBUGS-10002 (example)', 'OCPBUGS-10003 (example)'])
    await expect(rows.getByTestId('disposition')).toHaveText(['NEEDS_INFO', 'SOLVE', 'CLOSE'])
    await expect(rows.getByTestId('solve-outcome')).toHaveText(['Merged'])
    const solved = rows.nth(1)
    await expect(solved.locator('td:nth-child(4)')).toContainText('example-repo#101 (example)')
    await expect(solved.locator('td:nth-child(6) li')).toHaveText([/release-4\.22\s*OCPBUGS-10011 \(example\)\s*Merged/, /release-4\.21\s*OCPBUGS-10012 \(example\)\s*POST/])
    await expect(view.locator('tbody a')).toHaveCount(0)
    await expect(view.getByText(/CNTRLPLANE-/)).toHaveCount(0)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('filters pipeline percentages by component and counts backport clones through their original', async ({ page }) => {
    const fixture = require('../../fixtures/bug-refinement/data.json')
    const solved = fixture.issues.find(issue => issue.disposition === 'SOLVE')
    await page.route('**/api/modules/bug-pipeline/data', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...fixture,
        demo: false,
        jiraHost: 'https://jira.example.com',
        issues: [
          solved,
          { ...solved, key: 'OCPBUGS-10005', components: ['HyperShift'], status: 'POST', labels: ['refined-by-agent'], merged: false, backports: [], pullRequests: [
            { url: 'https://github.com/openshift/hypershift/pull/4242', repo: 'openshift/hypershift', number: 4242 }
          ] },
          { ...solved, key: 'OCPBUGS-10011', disposition: null, status: 'Verified', labels: ['refined-by-agent', 'chai-backport'], backports: [] },
          ...fixture.issues.filter(issue => issue !== solved)
        ]
      })
    }))
    await page.goto('/#/bug-pipeline/main')
    const view = page.getByTestId('bug-pipeline')
    await expect(view.locator('[data-testid^="stage-"] .text-3xl')).toHaveText(['4', '25%', '0%', '25%', '50%', '50%', '50%'])
    await expect(view.locator('tbody > tr')).toHaveCount(4)
    const hypershift = view.getByRole('group', { name: 'Filter by component', exact: true }).getByRole('button', { name: 'HyperShift', exact: true })
    await expect(hypershift.getByTestId('rate-backports-merged')).toHaveText('—')
    await hypershift.click()
    await expect(hypershift).toHaveAttribute('aria-pressed', 'true')
    await expect(view.locator('[data-testid^="stage-"] .text-3xl')).toHaveText(['3', '33%', '0%', '33%', '33%', '0%', '—'])
    const rows = view.locator('tbody > tr')
    await expect(rows.getByTestId('disposition')).toHaveText(['NEEDS_INFO', 'SOLVE', 'CLOSE'])
    await expect(rows.getByTestId('solve-outcome')).toHaveText(['PR posted'])
    await expect(view.getByRole('link', { name: 'OCPBUGS-10005', exact: true })).toHaveAttribute('href', 'https://jira.example.com/browse/OCPBUGS-10005')
    const pullRequest = view.getByRole('link', { name: 'hypershift#4242', exact: true })
    await expect(pullRequest).toHaveAttribute('href', 'https://github.com/openshift/hypershift/pull/4242')
    await expect(pullRequest).toHaveAttribute('title', 'openshift/hypershift#4242')
    await expect(pullRequest).toHaveAttribute('target', '_blank')
    await expect(pullRequest).toHaveAttribute('rel', 'noopener noreferrer')
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('sorts the pipeline table by the newest update by default and by clicked columns', async ({ page }) => {
    await page.goto('/#/bug-pipeline/main')
    const view = page.getByTestId('bug-pipeline')
    const keys = view.locator('tbody > tr td:first-child')
    const updated = view.getByRole('columnheader', { name: 'Updated', exact: true })
    const key = view.getByRole('columnheader', { name: 'Key', exact: true })
    const disposition = view.getByRole('columnheader', { name: 'Disposition', exact: true })
    await expect(updated).toHaveAttribute('aria-sort', 'descending')
    await expect(key).toHaveAttribute('aria-sort', 'none')
    await expect(keys).toHaveText(['OCPBUGS-10001 (example)', 'OCPBUGS-10002 (example)', 'OCPBUGS-10003 (example)'])
    await updated.getByRole('button').click()
    await expect(updated).toHaveAttribute('aria-sort', 'ascending')
    await expect(keys).toHaveText(['OCPBUGS-10003 (example)', 'OCPBUGS-10002 (example)', 'OCPBUGS-10001 (example)'])
    await disposition.getByRole('button').click()
    await disposition.getByRole('button').click()
    await expect(disposition).toHaveAttribute('aria-sort', 'descending')
    await expect(updated).toHaveAttribute('aria-sort', 'none')
    await expect(view.locator('tbody').getByTestId('disposition')).toHaveText(['SOLVE', 'NEEDS_INFO', 'CLOSE'])
    await key.getByRole('button').click()
    await expect(keys).toHaveText(['OCPBUGS-10001 (example)', 'OCPBUGS-10002 (example)', 'OCPBUGS-10003 (example)'])
    await view.getByRole('group', { name: 'Filter by component', exact: true }).getByRole('button', { name: 'HyperShift', exact: true }).click()
    await expect(key).toHaveAttribute('aria-sort', 'ascending')
    await expect(keys).toHaveText(['OCPBUGS-10001 (example)', 'OCPBUGS-10003 (example)'])
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('asks for a refresh instead of reporting zero merges for an older snapshot', async ({ page }) => {
    const fixture = require('../../fixtures/bug-refinement/data.json')
    const lifecycleFields = ['prPosted', 'merged', 'backports', 'pullRequests']
    await page.route('**/api/modules/bug-pipeline/data', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...fixture, demo: true, issues: fixture.issues.map(issue => Object.fromEntries(Object.entries(issue).filter(([key]) => !lifecycleFields.includes(key)))) })
    }))
    await page.goto('/#/bug-pipeline/main')
    const view = page.getByTestId('bug-pipeline')
    await expect(view.getByTestId('pipeline-refresh-needed')).toContainText('Refresh it to load solve and backport outcomes')
    await expect(view.locator('[data-testid^="stage-"] .text-3xl')).toHaveText(['3', '33%', '0%', '33%', '33%', '—', '—'])
    await expect(view.getByTestId('solve-outcome')).toHaveText('Unknown')
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('shows a recoverable pipeline error and retries', async ({ page }) => {
    await page.route('**/api/modules/bug-pipeline/data', route => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Pipeline temporarily unavailable' })
    }), { times: 1 })
    await page.goto('/#/bug-pipeline/main')
    const view = page.getByTestId('bug-pipeline')
    await expect(view.getByRole('alert')).toContainText('Pipeline temporarily unavailable')
    await view.getByRole('button', { name: 'Retry' }).click()
    await expect(view.locator('tbody > tr')).toHaveCount(3)
    await expect(view.getByRole('alert')).toHaveCount(0)
  })
})
