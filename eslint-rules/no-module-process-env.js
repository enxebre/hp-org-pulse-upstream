/**
 * ESLint rule: no-module-process-env (HP Eng extension)
 *
 * Extends core's ALLOWED set with HP Eng-specific config variables.
 * These are non-secret configuration — not credentials or tokens.
 */

const ALLOWED = new Set([
  // Core config vars
  'DEMO_MODE',
  'NODE_ENV',
  'API_PORT',
  'HTTPS_PROXY',
  'https_proxy',
  'JIRA_HOST',
  'JIRA_STORY_POINTS_FIELD',
  'GITLAB_BASE_URL',
  'PROXY_AUTH_SECRET',
  // Same domain rewrite used by platform role matching (core role-store)
  'AUTH_EMAIL_DOMAIN',
])

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow process.env access for secrets in module code'
    },
    messages: {
      forbidden: 'Use context.secrets or context.resolveSecret() instead of process.env.{{name}} in module code.',
      forbiddenComputed: 'Use context.resolveSecret(varName) instead of process.env[varName] in module code.'
    }
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.type === 'MemberExpression' &&
          node.object.object.name === 'process' &&
          node.object.property.name === 'env') {
          // Static access: process.env.SOME_VAR
          if (!node.computed && node.property.type === 'Identifier' && !ALLOWED.has(node.property.name)) {
            context.report({ node, messageId: 'forbidden', data: { name: node.property.name } })
          }
          // Computed access: process.env[varName]
          if (node.computed) {
            context.report({ node, messageId: 'forbiddenComputed' })
          }
        }
      }
    }
  }
}
