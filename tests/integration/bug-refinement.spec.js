const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Agentic Bug Refinement @bug-refinement', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('opens the tracker from the home card in the current tab', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('strategic-initiatives').getByRole('link', { name: /Agentic Bug Refinement/ })
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('href', '#/bug-refinement/main')
    await expect(card).not.toHaveAttribute('target', '_blank')
    await card.click()
    await expect(page).toHaveURL(/#\/bug-refinement\/main$/)
    await expect(page.getByTestId('bug-refinement').getByRole('heading', { name: 'Agentic Bug Refinement', exact: true })).toBeVisible()
    await expect(page.getByTestId('bug-refinement').locator('tbody tr')).toHaveCount(5)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('has its own sidebar section outside Jira Solve Agent', async ({ page }) => {
    await page.goto('/')
    const sections = page.locator('aside nav > div')
    const refinementSection = sections.filter({ has: page.locator('button[aria-expanded][aria-label="Agentic Bug Refinement"]') })
    const solveSection = sections.filter({ has: page.locator('button[aria-expanded][aria-label="OpenShift Jira Solve Agent"]') })
    await expect(refinementSection).toHaveCount(1)
    await expect(solveSection).toHaveCount(1)
    await expect(solveSection.getByRole('button', { name: 'Agentic Bug Refinement', exact: true })).toHaveCount(0)
    const header = refinementSection.locator('button[aria-expanded]')
    if (await header.getAttribute('aria-expanded') === 'false') await header.click()
    await refinementSection.locator('button:not([aria-expanded])').click()
    await expect(page).toHaveURL(/#\/bug-refinement\/main$/)
    await expect(page.getByTestId('bug-refinement').locator('tbody tr')).toHaveCount(5)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('tracks both projects, includes closed issues, and combines search with project filters', async ({ page }) => {
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    await expect(view.locator('tbody tr')).toHaveCount(5)
    await expect(view.locator('.text-3xl')).toHaveText(['5', '3', '2'])
    await expect(view.getByRole('cell', { name: 'Closed', exact: true })).toHaveCount(2)
    await expect(view.getByRole('cell', { name: 'needs-info', exact: true })).toBeVisible()
    await expect(view.getByRole('cell', { name: 'need-human-analysis', exact: true })).toBeVisible()
    await expect(view.getByRole('columnheader', { name: 'Disposition', exact: true })).toBeVisible()
    for (const disposition of ['DEFER', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS', 'CLOSE']) {
      await expect(view.getByRole('cell', { name: disposition, exact: true })).toBeVisible()
    }
    await expect(view.getByRole('status')).toContainText('fictional examples, not results from Jira')
    await expect(view.locator('tbody a')).toHaveCount(0)
    await expect(view.getByRole('cell', { name: 'CNTRLPLANE-10001 (example)', exact: true })).toBeVisible()
    const jiraLink = view.getByRole('link', { name: 'View matching issues in Jira', exact: true })
    const searchUrl = new URL(await jiraLink.getAttribute('href'))
    expect(searchUrl.searchParams.get('jql')).toBe('project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" ORDER BY updated DESC')
    await expect(jiraLink).toHaveAttribute('target', '_blank')
    await expect(jiraLink).toHaveAttribute('rel', 'noopener noreferrer')
    await view.getByLabel('Project', { exact: true }).selectOption('CNTRLPLANE')
    await expect(view.locator('tbody tr')).toHaveCount(2)
    await view.getByLabel('Search refined bugs').fill('Sam')
    await expect(view.locator('tbody tr')).toHaveCount(1)
    await expect(view.locator('tbody')).toContainText('CNTRLPLANE-10001')
    await view.getByLabel('Search refined bugs').fill('no matching issue')
    await expect(view.getByText('No refined bugs match your filters.')).toBeVisible()
    await expect(view.locator('.text-3xl')).toHaveText(['5', '3', '2'])
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('shows a recoverable error and retries', async ({ page }) => {
    await page.route('**/api/modules/bug-refinement/data', route => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Refinement temporarily unavailable' })
    }), { times: 1 })
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    await expect(view.getByRole('alert')).toContainText('Refinement temporarily unavailable')
    await view.getByRole('button', { name: 'Retry' }).click()
    await expect(view.locator('tbody tr')).toHaveCount(5)
    await expect(view.getByRole('alert')).toHaveCount(0)
  })

  test('generates component boxes and combines them with project and search filters', async ({ page }) => {
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    const teams = view.getByRole('group', { name: 'Filter by component', exact: true })
    const all = teams.getByRole('button', { name: 'All Teams', exact: true })
    const hypershift = teams.getByRole('button', { name: 'HyperShift', exact: true })
    const mco = teams.getByRole('button', { name: 'Machine Config Operator', exact: true })
    await expect(teams.getByRole('button')).toHaveCount(3)
    const totalsBounds = await view.getByTestId('refinement-project-totals').boundingBox()
    const note = view.getByText('Boxes follow Jira components across OCPBUGS and CNTRLPLANE. Bugs with multiple components appear in each matching box. Totals include deferred and unknown assessments.', { exact: true })
    await expect(note).toBeVisible()
    const noteBounds = await note.boundingBox()
    const componentsBounds = await teams.boundingBox()
    expect(totalsBounds.y + totalsBounds.height).toBeLessThanOrEqual(noteBounds.y)
    expect(noteBounds.y + noteBounds.height).toBeLessThanOrEqual(componentsBounds.y)
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    for (const [card, counts] of [[all, ['5', '1', '1', '1', '1']], [hypershift, ['4', '0', '1', '1', '1']], [mco, ['1', '1', '0', '0', '0']]]) {
      for (const [index, disposition] of ['total', 'SOLVE', 'CLOSE', 'NEED_HUMAN_ANALYSIS', 'NEEDS_INFO'].entries()) {
        await expect(card.getByTestId(`count-${disposition}`)).toHaveText(counts[index])
      }
      for (const label of ['Total', 'Solve', 'Close', 'Need human analysis', 'Needs info']) {
        await expect(card.getByText(label, { exact: true })).toBeVisible()
      }
    }
    await hypershift.click()
    await expect(hypershift).toHaveAttribute('aria-pressed', 'true')
    await expect(all).toHaveAttribute('aria-pressed', 'false')
    await expect(view.locator('tbody tr')).toHaveCount(4)
    await expect(view.locator('tbody')).not.toContainText('OCPBUGS-10002')
    await expect(view.locator('.text-3xl')).toHaveText(['4', '2', '2'])
    await view.getByLabel('Project', { exact: true }).selectOption('OCPBUGS')
    await expect(view.locator('tbody tr')).toHaveCount(2)
    await view.getByLabel('Search refined bugs').fill('configuration')
    await expect(view.getByText('No refined bugs match your filters.')).toBeVisible()
    await expect(hypershift.getByTestId('count-total')).toHaveText('4')
    await all.click()
    await expect(view.locator('tbody tr')).toHaveCount(1)
    await expect(view.locator('tbody')).toContainText('OCPBUGS-10002')
    await expect(all.getByTestId('count-total')).toHaveText('5')
    await mco.click()
    await expect(view.locator('tbody tr')).toHaveCount(1)
    await expect(view.getByRole('cell', { name: 'Machine Config Operator', exact: true })).toBeVisible()
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('discovers new component names and groups tickets with multiple or no components', async ({ page }) => {
    const fixture = require('../../fixtures/bug-refinement/data.json')
    await page.route('**/api/modules/bug-refinement/data', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...fixture, demo: true, issues: [
        { ...fixture.issues[0], components: ['Networking / router', 'Networking-router', 'Networking / router'] },
        { ...fixture.issues[1], components: ['Networking / router'] },
        { ...fixture.issues[2], components: [] }
      ] })
    }))
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    const components = view.getByRole('group', { name: 'Filter by component', exact: true })
    await expect(components.getByRole('button')).toHaveCount(4)
    await expect(components.getByRole('button', { name: 'HyperShift', exact: true })).toHaveCount(0)
    for (const [name, count] of [['All Teams', '3'], ['Networking / router', '2'], ['Networking-router', '1'], ['No component', '1']]) {
      const card = components.getByRole('button', { name, exact: true })
      await expect(card.getByTestId('count-total')).toHaveText(count)
      await card.click()
      await expect(view.locator('tbody tr')).toHaveCount(Number(count))
    }
    await expect(view.locator('tbody')).toContainText('OCPBUGS-10002')
    await expect(view.getByRole('cell', { name: '—', exact: true })).toHaveCount(2)
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('sorts table columns and retains sorting when filtering by component', async ({ page }) => {
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    const keyHeader = view.getByRole('columnheader', { name: 'Key', exact: true })
    await keyHeader.getByRole('button').click()
    await expect(keyHeader).toHaveAttribute('aria-sort', 'ascending')
    await expect(view.locator('tbody tr td:first-child')).toHaveText(['CNTRLPLANE-10001 (example)', 'CNTRLPLANE-10002 (example)', 'OCPBUGS-10001 (example)', 'OCPBUGS-10002 (example)', 'OCPBUGS-10003 (example)'])
    await keyHeader.getByRole('button').click()
    await expect(keyHeader).toHaveAttribute('aria-sort', 'descending')
    await expect(view.locator('tbody tr').first()).toContainText('OCPBUGS-10003')
    const componentHeader = view.getByRole('columnheader', { name: 'Components', exact: true })
    await componentHeader.getByRole('button').click()
    await expect(componentHeader).toHaveAttribute('aria-sort', 'ascending')
    await expect(keyHeader).toHaveAttribute('aria-sort', 'none')
    await expect(view.locator('tbody tr').last()).toContainText('Machine Config Operator')
    await view.getByRole('group', { name: 'Filter by component', exact: true }).getByRole('button', { name: 'HyperShift', exact: true }).click()
    await expect(view.locator('tbody tr')).toHaveCount(4)
    await expect(componentHeader).toHaveAttribute('aria-sort', 'ascending')
    await expect(view.locator('tbody')).not.toContainText('Machine Config Operator')
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })

  test('distinguishes saved CLOSE assessments from legacy Jira closures and counts both', async ({ page }) => {
    const fixture = require('../../fixtures/bug-refinement/data.json')
    await page.route('**/api/modules/bug-refinement/data', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...fixture,
        demo: false,
        jiraHost: 'https://jira.example.com',
        issues: [
          fixture.issues.find(issue => issue.disposition === 'CLOSE'),
          { key: 'OCPBUGS-10004', summary: 'Administrative closure without a saved assessment', project: 'OCPBUGS', status: 'Closed', labels: ['refined-by-agent'], disposition: null }
        ]
      })
    }))
    await page.goto('/#/bug-refinement/main')
    const view = page.getByTestId('bug-refinement')
    const closure = view.getByRole('link', { name: 'CLOSE', exact: true })
    await expect(closure).toHaveAttribute('href', 'https://jira.example.com/browse/OCPBUGS-10003?focusedCommentId=10005')
    await expect(closure).toHaveAttribute('title', /Saved assessment:/)
    await expect(view.getByRole('cell', { name: 'Closed', exact: true })).toHaveCount(2)
    const legacyRow = view.getByRole('row').filter({ hasText: 'OCPBUGS-10004' })
    await expect(legacyRow.getByRole('cell', { name: 'CLOSE (Jira)', exact: true })).toBeVisible()
    await expect(legacyRow.getByText('CLOSE (Jira)', { exact: true })).toHaveAttribute('title', /Closed in Jira; no saved refinement assessment/)
    await expect(legacyRow.getByRole('link', { name: 'CLOSE (Jira)', exact: true })).toHaveCount(0)
    await expect(view.getByTestId('refinement-team-all').getByTestId('count-CLOSE')).toHaveText('2')
    expect(page.errors.filter(error => error.type === 'pageerror')).toHaveLength(0)
  })
})
