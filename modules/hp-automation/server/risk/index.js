const {
  REPOS,
  RISK_LEVELS,
  RISK_LABEL_PREFIX,
  computeSummary,
  fetchRiskCounts
} = require('./github/risk-labels')

const DATA_FILE = 'risk-assessment/data.json'

module.exports = function registerRoutes(router, context) {
  const { readFromStorage, writeToStorage } = context.storage
  context.registerScopes([
    { key: 'risk-assessment:read', label: 'Risk Assessment (Read)', description: 'Read Chai risk assessment counts', category: 'Agentic Risk Assessment' },
    { key: 'risk-assessment:write', label: 'Risk Assessment (Write)', description: 'Refresh Chai risk assessment counts', category: 'Agentic Risk Assessment' }
  ])

  function responseFrom(repos, fetchedAt) {
    return {
      fetchedAt: fetchedAt || null,
      labelPrefix: RISK_LABEL_PREFIX,
      levels: RISK_LEVELS,
      ...computeSummary(repos || [])
    }
  }

  async function runRefresh() {
    if (process.env.DEMO_MODE === 'true') return
    const repos = await fetchRiskCounts({ token: context.secrets?.GITHUB_TOKEN || '', repos: REPOS })
    const fetchedAt = new Date().toISOString()
    await writeToStorage(DATA_FILE, { fetchedAt, repos })
    return responseFrom(repos, fetchedAt)
  }

  /**
   * @openapi
   * /api/modules/hp-automation/risk/data:
   *   get:
   *     tags: [Agentic Risk Assessment]
   *     summary: Get Chai risk assessment PR counts and shares per repository
   *     responses:
   *       200:
   *         description: Per-repository and combined counts of PRs labeled low, moderate, and critical risk
   */
  router.get('/data', context.requireScope('risk-assessment:read'), async function(req, res) {
    const cached = await readFromStorage(DATA_FILE)
    if (Array.isArray(cached?.repos)) return res.json(responseFrom(cached.repos, cached.fetchedAt))

    try {
      return res.json((await runRefresh()) || responseFrom([], null))
    } catch (err) {
      console.error('[risk-assessment] Initial GitHub fetch failed:', err)
      return res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/hp-automation/risk/refresh:
   *   post:
   *     tags: [Agentic Risk Assessment]
   *     summary: Refresh Chai risk assessment PR counts from GitHub
   *     responses:
   *       200:
   *         description: Refreshed per-repository risk assessment counts
   */
  router.post('/refresh', context.requireAdmin, context.requireScope('risk-assessment:write'), async function(req, res) {
    try {
      res.json((await runRefresh()) || responseFrom([], null))
    } catch (err) {
      console.error('[risk-assessment] Refresh failed:', err)
      res.status(500).json({ error: err.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('refresh', { order: 63, timeout: 120000, handler: runRefresh })
  }

  context.registerDiagnostics(async function() {
    const cached = await readFromStorage(DATA_FILE)
    return {
      status: Array.isArray(cached?.repos) ? 'ok' : 'no-data',
      repoCount: cached?.repos?.length || 0,
      fetchedAt: cached?.fetchedAt || null
    }
  })
}
