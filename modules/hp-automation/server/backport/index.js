const { createJiraClient } = require('../../../../shared/server/jira')
const { computeMetrics, fetchBackports } = require('./jira/fetcher')

module.exports = function registerRoutes(router, context) {
  const { readFromStorage, writeToStorage } = context.storage
  context.registerScopes([
    { key: 'backport-tracker:read', label: 'Backport Tracker (Read)', description: 'Read Chai backport data', category: 'Agentic Backports' },
    { key: 'backport-tracker:write', label: 'Backport Tracker (Write)', description: 'Refresh Chai backport data', category: 'Agentic Backports' }
  ])

  const jira = createJiraClient({
    email: context.secrets?.JIRA_EMAIL || '',
    token: context.secrets?.JIRA_TOKEN || '',
    host: process.env.JIRA_HOST
  })

  function responseFrom(issues, fetchedAt) {
    return {
      fetchedAt: fetchedAt || null,
      jiraHost: jira.JIRA_HOST,
      metrics: computeMetrics(issues || []),
      issues: issues || []
    }
  }

  async function runRefresh() {
    if (process.env.DEMO_MODE === 'true') return
    const issues = await fetchBackports(jira.jiraRequest)
    const fetchedAt = new Date().toISOString()
    await writeToStorage('backport-tracker/data.json', { fetchedAt, issues })
    return responseFrom(issues, fetchedAt)
  }

  /**
   * @openapi
   * /api/modules/hp-automation/backport/data:
   *   get:
   *     tags: [Agentic Backports]
   *     summary: Get Chai-driven backport totals and merge outcomes
   *     responses:
   *       200:
   *         description: Backport metrics and Jira issues
   */
  router.get('/data', context.requireScope('backport-tracker:read'), async function(req, res) {
    const cached = await readFromStorage('backport-tracker/data.json')
    if (Array.isArray(cached?.issues)) return res.json(responseFrom(cached.issues, cached.fetchedAt))

    try {
      return res.json((await runRefresh()) || responseFrom([], null))
    } catch (err) {
      console.error('[backport-tracker] Initial Jira fetch failed:', err)
      return res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/hp-automation/backport/refresh:
   *   post:
   *     tags: [Agentic Backports]
   *     summary: Refresh Chai-driven backport data from Jira
   *     responses:
   *       200:
   *         description: Refreshed backport metrics and Jira issues
   */
  router.post('/refresh', context.requireAdmin, context.requireScope('backport-tracker:write'), async function(req, res) {
    try {
      res.json(await runRefresh())
    } catch (err) {
      console.error('[backport-tracker] Refresh failed:', err)
      res.status(500).json({ error: err.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('refresh', { order: 62, timeout: 300000, handler: runRefresh })
  }

  context.registerDiagnostics(async function() {
    const cached = await readFromStorage('backport-tracker/data.json')
    return {
      status: Array.isArray(cached?.issues) ? 'ok' : 'no-data',
      issueCount: cached?.issues?.length || 0,
      fetchedAt: cached?.fetchedAt || null
    }
  })
}
