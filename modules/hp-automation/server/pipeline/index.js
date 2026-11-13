const { JIRA_HOST } = require('../../../../shared/server/jira')

// Exported by bug-refinement (see its module.json), which owns the Jira fetch and refresh.
const SNAPSHOT_KEY = 'bug-refinement/data.json'

module.exports = function registerRoutes(router, context) {
  context.registerScopes([
    { key: 'bug-pipeline:read', label: 'Bug Pipeline (Read)', description: 'Read agentic bug pipeline outcomes', category: 'Agentic Bug Pipeline' }
  ])

  /**
   * @openapi
   * /api/modules/hp-automation/pipeline/data:
   *   get:
   *     tags: [Agentic Bug Pipeline]
   *     summary: Get refined OCPBUGS issues with their solve and backport outcomes
   *     description: Returns the Agentic Bug Refinement snapshot, read from its exported bug-refinement/data.json file, with the configured jiraHost and a boolean demo flag. Returns an empty issue list with a null fetchedAt until Agentic Bug Refinement fetches its first snapshot.
   *     responses:
   *       200:
   *         description: Pipeline snapshot with fetchedAt, jiraHost, demo, and issues
   *       500:
   *         description: Storage read failed
   */
  router.get('/data', context.requireScope('bug-pipeline:read'), async function(req, res) {
    try {
      const snapshot = await context.storage.readFromStorage(SNAPSHOT_KEY)
      res.json({
        fetchedAt: snapshot?.fetchedAt || null,
        jiraHost: JIRA_HOST,
        demo: process.env.DEMO_MODE === 'true',
        issues: Array.isArray(snapshot?.issues) ? snapshot.issues : []
      })
    } catch (err) {
      console.error('[bug-pipeline] Snapshot read failed:', err)
      res.status(500).json({ error: 'Unable to load bug pipeline data. Please try again.' })
    }
  })
}
