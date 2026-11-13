const { createJiraClient } = require('../../../../shared/server/jira')
const registerRefinementRoutes = require('./routes')

module.exports = function registerRoutes(router, context) {
  context.registerScopes([
    { key: 'bug-refinement:read', label: 'Bug Refinement (Read)', description: 'Read agent-refined bugs and dispositions', category: 'Agentic Bug Refinement' },
    { key: 'bug-refinement:write', label: 'Bug Refinement (Write)', description: 'Refresh agent-refined bugs from Jira', category: 'Agentic Bug Refinement' }
  ])

  const jira = createJiraClient({
    email: context.secrets?.JIRA_EMAIL || '',
    token: context.secrets?.JIRA_TOKEN || '',
    host: process.env.JIRA_HOST
  })
  registerRefinementRoutes(router, context, jira)
}
