const { fetchRefinedIssues, REFINEMENT_JQL } = require('./jira/refinement')

const STORAGE_KEY = 'bug-refinement/data.json'

module.exports = function registerRefinementRoutes(router, context, jira) {
  const { readFromStorage, writeToStorage } = context.storage
  let refreshPromise = null

  function responseFrom(cached) {
    return {
      fetchedAt: cached?.fetchedAt || null,
      jiraHost: jira.JIRA_HOST,
      jiraSearchUrl: `${jira.JIRA_HOST}/issues/?${new URLSearchParams({ jql: REFINEMENT_JQL })}`,
      demo: process.env.DEMO_MODE === 'true',
      issues: cached?.issues || []
    }
  }

  function refresh() {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      if (process.env.DEMO_MODE === 'true') return responseFrom(await readFromStorage(STORAGE_KEY))
      const issues = await fetchRefinedIssues(jira.jiraRequest)
      const snapshot = { fetchedAt: new Date().toISOString(), issues }
      await writeToStorage(STORAGE_KEY, snapshot)
      return responseFrom(snapshot)
    })().finally(() => { refreshPromise = null })
    return refreshPromise
  }

  /**
   * @openapi
   * /api/modules/bug-refinement/data:
   *   get:
   *     tags: [Agentic Bug Refinement]
   *     summary: Get OCPBUGS and CNTRLPLANE issues labeled refined-by-agent
   *     description: Returns cached issues with dispositions from the newest saved refine:v1 comment. Fetches from Jira on the first request when no snapshot exists. Includes a demo flag and the exact Jira search URL.
   *     responses:
   *       200:
   *         description: Refinement snapshot with fetchedAt, jiraHost, jiraSearchUrl, demo, and issues
   *       500:
   *         description: Jira or storage request failed
   */
  router.get('/data', context.requireScope('bug-refinement:read'), async function(req, res) {
    try {
      const cached = await readFromStorage(STORAGE_KEY)
      res.json(Array.isArray(cached?.issues) ? responseFrom(cached) : await refresh())
    } catch (err) {
      console.error('[bug-refinement] Refinement fetch failed:', err)
      res.status(500).json({ error: 'Unable to load bug refinement data. Please try again.' })
    }
  })

  /**
   * @openapi
   * /api/modules/bug-refinement/refresh:
   *   post:
   *     tags: [Agentic Bug Refinement]
   *     summary: Refresh agent-refined issues from Jira
   *     description: Requires admin role and bug-refinement:write scope. Demo mode returns fixture data without writes.
   *     responses:
   *       200:
   *         description: Refreshed refinement snapshot with fetchedAt, jiraHost, jiraSearchUrl, demo, and issues
   *       403:
   *         description: Not authorized
   *       500:
   *         description: Jira or storage request failed; the previous snapshot is preserved
   */
  router.post('/refresh', context.requireAdmin, context.requireScope('bug-refinement:write'), async function(req, res) {
    try {
      res.json(await refresh())
    } catch (err) {
      console.error('[bug-refinement] Refinement refresh failed:', err)
      res.status(500).json({ error: 'Unable to refresh bug refinement data. Please try again.' })
    }
  })

  context.registerRefresh?.('refresh', { order: 61, timeout: 300000, handler: refresh })
  context.registerExport?.(async function(addFile, storage, mapping) {
    const cached = await storage.readFromStorage(STORAGE_KEY)
    if (!cached) return
    addFile(STORAGE_KEY, {
      ...cached,
      issues: (cached.issues || []).map(issue => ({
        ...issue,
        key: mapping.anonymizeJiraKey(issue.key),
        summary: mapping.anonymizeIssueSummary(issue.key),
        assignee: issue.assignee ? mapping.getOrCreateNameMapping(issue.assignee) : null
      }))
    })
  })
}
