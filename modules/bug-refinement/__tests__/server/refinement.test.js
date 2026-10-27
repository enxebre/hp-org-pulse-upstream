import { afterEach, describe, expect, it, vi } from 'vitest'

const { createTestContext } = require('../../../../shared/server/module-context')
const registerRefinementRoutes = require('../../server/routes')
const registerModule = require('../../server')
const { fetchRefinedIssues, fetchDisposition, REFINEMENT_JQL, PR_POSTED_JQL, MERGED_JQL } = require('../../server/jira/refinement')
const fixture = require('../../../../fixtures/bug-refinement/data.json')

afterEach(() => vi.unstubAllEnvs())

function setup(cached = null) {
  const handlers = {}
  const router = {
    get: vi.fn((path, ...middleware) => { handlers[`GET ${path}`] = middleware.at(-1) }),
    post: vi.fn((path, ...middleware) => { handlers[`POST ${path}`] = middleware.at(-1) })
  }
  const storage = { readFromStorage: vi.fn(async () => cached), writeToStorage: vi.fn() }
  const context = createTestContext({ storage, registerRefresh: vi.fn(), registerExport: vi.fn() })
  const jira = { JIRA_HOST: 'https://jira.example.com', jiraRequest: vi.fn(async () => ({ issues: [] })) }
  registerRefinementRoutes(router, context, jira)
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
  return { handlers, router, storage, context, jira, res }
}

describe('agentic bug refinement', () => {
  it('registers its own API scopes and routes independently of Jira Solve Agent', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = createTestContext({ registerScopes: vi.fn() })
    registerModule(router, context)
    expect(context.registerScopes).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'bug-refinement:read' }),
      expect.objectContaining({ key: 'bug-refinement:write' })
    ])
    expect(router.get).toHaveBeenCalledWith('/data', expect.any(Function), expect.any(Function))
    expect(router.post).toHaveBeenCalledWith('/refresh', context.requireAdmin, expect.any(Function), expect.any(Function))
  })

  it('uses the label and both projects and follows Jira cursor pagination', async () => {
    const jiraRequest = vi.fn()
      .mockResolvedValueOnce({ issues: [{ key: 'OCPBUGS-1', fields: { summary: 'First', labels: ['refined-by-agent'] } }], isLast: false, nextPageToken: 'page-two' })
      .mockResolvedValueOnce({ issues: [{ key: 'CNTRLPLANE-2', fields: { status: { name: 'Closed' } } }], isLast: true })
      .mockResolvedValue({ comments: [], total: 0 })
    const issues = await fetchRefinedIssues(jiraRequest)
    expect(REFINEMENT_JQL).toBe('project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" ORDER BY updated DESC')
    const firstQuery = new URL(jiraRequest.mock.calls[0][0], 'https://jira.example.com').searchParams
    expect(firstQuery.get('jql')).toBe(REFINEMENT_JQL)
    expect(firstQuery.get('fields')).not.toContain('comment')
    expect(jiraRequest.mock.calls[1][0]).toContain('nextPageToken=page-two')
    expect(issues).toMatchObject([
      { key: 'OCPBUGS-1', project: 'OCPBUGS', summary: 'First', labels: ['refined-by-agent'], assignee: null },
      { key: 'CNTRLPLANE-2', project: 'CNTRLPLANE', status: 'Closed', summary: 'CNTRLPLANE-2' }
    ])
  })

  it('uses the newest saved marker across ADF formatting instead of older assessments', async () => {
    const jiraRequest = vi.fn().mockResolvedValue({ startAt: 0, total: 3, comments: [
      { id: '3', body: 'An unrelated newer comment' },
      { id: '2', created: '2026-10-15T08:00:00Z', body: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: '[refine:v1]' }, { type: 'text', text: ' outcome=' }, { type: 'text', text: 'NEEDS_INFO', marks: [{ type: 'strong' }] }
      ] }] } },
      { id: '1', created: '2026-10-14T08:00:00Z', body: '[refine:v1] outcome=SOLVE' }
    ] })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toEqual({ disposition: 'NEEDS_INFO', dispositionAt: '2026-10-15T08:00:00Z', dispositionCommentId: '2' })
  })

  it('finds a saved assessment beyond the first page and stops before older comments', async () => {
    const jiraRequest = vi.fn()
      .mockResolvedValueOnce({ startAt: 0, total: 3, comments: [{ body: 'A newer ordinary comment' }] })
      .mockResolvedValueOnce({ startAt: 1, total: 3, comments: [{ id: '2', created: '2026-10-14', body: '[refine:v1] outcome=DEFER' }] })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toEqual({ disposition: 'DEFER', dispositionAt: '2026-10-14', dispositionCommentId: '2' })
    expect(jiraRequest).toHaveBeenCalledTimes(2)
    const query = new URL(jiraRequest.mock.calls[1][0], 'https://jira.example.com').searchParams
    expect(query.get('orderBy')).toBe('-created')
    expect(query.get('startAt')).toBe('1')
  })

  it.each(['DEFER', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS', 'CLOSE'])('reads a plain-text %s disposition', async disposition => {
    const jiraRequest = vi.fn().mockResolvedValue({ comments: [{ id: '1', body: `[refine:v1] outcome=${disposition}` }], total: 1 })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toMatchObject({ disposition, dispositionCommentId: '1' })
  })

  it('uses a newer CLOSE assessment instead of an earlier human-analysis assessment', async () => {
    const jiraRequest = vi.fn().mockResolvedValue({ comments: [
      { id: '2', created: '2026-10-20T09:42:01Z', body: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Closing as Not a Bug.' }, { type: 'hardBreak' },
        { type: 'text', text: '[refine:v1] outcome=' }, { type: 'text', text: 'CLOSE', marks: [{ type: 'strong' }] }
      ] }] } },
      { id: '1', body: '[refine:v1] outcome=NEED_HUMAN_ANALYSIS' }
    ], total: 2 })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toEqual({ disposition: 'CLOSE', dispositionAt: '2026-10-20T09:42:01Z', dispositionCommentId: '2' })
  })

  it('does not infer a disposition from an administrative closure without a saved marker', async () => {
    const jiraRequest = vi.fn().mockResolvedValue({ comments: [
      { id: '2', body: 'Status changed to Closed (resolution: Cannot Reproduce)' },
      { id: '1', body: 'Closing due to age and inactivity. No fix is claimed.' }
    ], total: 2 })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toEqual({ disposition: null, dispositionAt: null, dispositionCommentId: null })
  })

  it('does not fall back to an older assessment when the newest marker has an unknown outcome', async () => {
    const jiraRequest = vi.fn().mockResolvedValue({ comments: [
      { id: '2', body: '[refine:v1] outcome=BLOCKED' },
      { id: '1', body: '[refine:v1] outcome=SOLVE' }
    ], total: 2 })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toMatchObject({ disposition: null, dispositionCommentId: '2' })
  })

  it('leaves disposition unknown when no saved assessment is visible', async () => {
    const jiraRequest = vi.fn().mockResolvedValue({ comments: [{ body: 'needs-info, SOLVE, and NEED_HUMAN_ANALYSIS appear in ordinary text' }], total: 1 })
    expect(await fetchDisposition(jiraRequest, 'OCPBUGS-1')).toEqual({ disposition: null, dispositionAt: null, dispositionCommentId: null })
  })

  it('hydrates issue dispositions without retaining comment bodies', async () => {
    const jiraRequest = vi.fn()
      .mockResolvedValueOnce({ issues: [{ key: 'OCPBUGS-1', fields: { labels: ['refined-by-agent'] } }] })
      .mockResolvedValueOnce({ comments: [{ id: '1', created: '2026-10-15', body: '[refine:v1] outcome=SOLVE' }], total: 1 })
      .mockResolvedValue({ issues: [] })
    const [issue] = await fetchRefinedIssues(jiraRequest)
    expect(issue).toMatchObject({ disposition: 'SOLVE', dispositionAt: '2026-10-15', dispositionCommentId: '1' })
    expect(issue).not.toHaveProperty('comments')
    expect(issue).not.toHaveProperty('body')
  })

  it('marks pull requests and merges from Jira status history and links backport clones', async () => {
    const jiraRequest = vi.fn(async url => {
      if (url.includes('/comment')) return { comments: [], total: 0 }
      const query = new URL(url, 'https://jira.example.com').searchParams
      if (query.get('jql') === PR_POSTED_JQL || query.get('jql') === MERGED_JQL) expect(query.get('fields')).toBe('status')
      return {
        [REFINEMENT_JQL]: { issues: [
          { key: 'OCPBUGS-1', fields: { status: { name: 'Verified' }, labels: ['refined-by-agent', 'jlp-release-4.22:OCPBUGS-2', 'jlp-release-4.21:OCPBUGS-9'] } },
          { key: 'OCPBUGS-2', fields: { status: { name: 'POST' }, labels: ['refined-by-agent', 'chai-backport'] } },
          { key: 'OCPBUGS-3', fields: { status: { name: 'POST' }, labels: ['refined-by-agent', 'jlp-unrelated'] } },
          { key: 'OCPBUGS-4', fields: { status: { name: 'New' }, labels: ['refined-by-agent'] } }
        ] },
        [PR_POSTED_JQL]: { issues: [{ key: 'OCPBUGS-2' }, { key: 'OCPBUGS-3' }] },
        [MERGED_JQL]: { issues: [{ key: 'OCPBUGS-1' }] }
      }[query.get('jql')]
    })
    const issues = await fetchRefinedIssues(jiraRequest)
    expect(PR_POSTED_JQL).toBe('project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS POST')
    expect(MERGED_JQL).toBe('project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS MODIFIED')
    expect(issues.map(({ key, prPosted, merged, backports }) => ({ key, prPosted, merged, backports }))).toEqual([
      { key: 'OCPBUGS-1', prPosted: true, merged: true, backports: [
        { key: 'OCPBUGS-2', branch: 'release-4.22', status: 'POST', merged: false },
        { key: 'OCPBUGS-9', branch: 'release-4.21', status: null, merged: null }
      ] },
      { key: 'OCPBUGS-2', prPosted: true, merged: false, backports: [] },
      { key: 'OCPBUGS-3', prPosted: true, merged: false, backports: [] },
      { key: 'OCPBUGS-4', prPosted: false, merged: false, backports: [] }
    ])
  })

  it('stores GitHub pull request links from remote links only for issues sent to solve', async () => {
    const jiraRequest = vi.fn(async url => {
      if (url.includes('/comment')) return { comments: [{ id: '1', body: `[refine:v1] outcome=${url.includes('/OCPBUGS-1/') ? 'SOLVE' : 'CLOSE'}` }], total: 1 }
      if (url.includes('/remotelink')) return [
        { object: { url: 'https://github.com/openshift/hypershift/pull/9982', title: 'openshift/hypershift#9982: OCPBUGS-1: Fix endpoints' } },
        { object: { url: 'https://github.com/openshift/hypershift/pull/9982/files' } },
        { object: { url: 'https://github.com/openshift/hypershift/issues/12' } },
        { object: { url: 'https://jira.example.com/browse/OCPBUGS-7' } },
        { object: {} }
      ]
      const query = new URL(url, 'https://jira.example.com').searchParams
      return query.get('jql') === REFINEMENT_JQL ? { issues: [{ key: 'OCPBUGS-1', fields: {} }, { key: 'OCPBUGS-2', fields: {} }] } : { issues: [] }
    })
    const issues = await fetchRefinedIssues(jiraRequest)
    expect(issues.map(({ key, disposition, pullRequests }) => ({ key, disposition, pullRequests }))).toEqual([
      { key: 'OCPBUGS-1', disposition: 'SOLVE', pullRequests: [{ url: 'https://github.com/openshift/hypershift/pull/9982', repo: 'openshift/hypershift', number: 9982 }] },
      { key: 'OCPBUGS-2', disposition: 'CLOSE', pullRequests: [] }
    ])
    expect(jiraRequest.mock.calls.map(([url]) => url).filter(url => url.includes('/remotelink'))).toEqual(['/rest/api/3/issue/OCPBUGS-1/remotelink'])
  })

  it('serves cached data without contacting Jira', async () => {
    const { handlers, res, jira, storage } = setup(fixture)
    await handlers['GET /data']({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ...fixture, jiraHost: jira.JIRA_HOST, demo: false }))
    const searchUrl = new URL(res.json.mock.calls[0][0].jiraSearchUrl)
    expect(searchUrl.origin).toBe(jira.JIRA_HOST)
    expect(searchUrl.searchParams.get('jql')).toBe(REFINEMENT_JQL)
    expect(jira.jiraRequest).not.toHaveBeenCalled()
    expect(storage.readFromStorage).toHaveBeenCalledWith('bug-refinement/data.json')
  })

  it('treats a cached empty issue list as valid', async () => {
    const { handlers, res, jira } = setup({ fetchedAt: fixture.fetchedAt, issues: [] })
    await handlers['GET /data']({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ fetchedAt: fixture.fetchedAt, jiraHost: jira.JIRA_HOST, issues: [], demo: false }))
    expect(jira.jiraRequest).not.toHaveBeenCalled()
  })

  it('shares concurrent cold fetches and saves an empty result as a valid snapshot', async () => {
    const { handlers, res, jira, storage } = setup()
    await Promise.all([handlers['GET /data']({}, res), handlers['GET /data']({}, res)])
    expect(jira.jiraRequest).toHaveBeenCalledTimes(1)
    expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
    expect(storage.writeToStorage).toHaveBeenCalledWith('bug-refinement/data.json', { fetchedAt: expect.any(String), issues: [] })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jiraHost: jira.JIRA_HOST, fetchedAt: expect.any(String), issues: [], demo: false }))
  })

  it('returns an error without overwriting cached data and permits a later refresh', async () => {
    const { handlers, res, jira, storage } = setup(fixture)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      jira.jiraRequest.mockRejectedValueOnce(new Error('Jira unavailable'))
      await handlers['POST /refresh']({}, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(storage.writeToStorage).not.toHaveBeenCalled()
      await handlers['POST /refresh']({}, res)
      expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
    } finally {
      log.mockRestore()
    }
  })

  it.each([fixture, null])('uses demo data without Jira calls or writes', async cached => {
    vi.stubEnv('DEMO_MODE', 'true')
    const { handlers, jira, storage, res } = setup(cached)
    await handlers['POST /refresh']({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jiraHost: jira.JIRA_HOST, fetchedAt: cached?.fetchedAt || null, issues: cached?.issues || [], demo: true }))
    expect(jira.jiraRequest).not.toHaveBeenCalled()
    expect(storage.writeToStorage).not.toHaveBeenCalled()
  })

  it('registers a coordinated refresh and protects manual refresh with admin middleware', () => {
    const { router, context } = setup()
    expect(router.post).toHaveBeenCalledWith('/refresh', context.requireAdmin, expect.any(Function), expect.any(Function))
    expect(context.registerRefresh).toHaveBeenCalledWith('refresh', expect.objectContaining({ handler: expect.any(Function) }))
  })

  it('anonymizes exported keys, summaries, and assignees', async () => {
    const { context, storage } = setup(fixture)
    const addFile = vi.fn()
    const mapping = { anonymizeJiraKey: () => 'ISSUE-1', anonymizeIssueSummary: () => 'Example issue', getOrCreateNameMapping: () => 'Example person' }
    await context.registerExport.mock.calls[0][0](addFile, storage, mapping)
    expect(addFile).toHaveBeenCalledWith('bug-refinement/data.json', expect.objectContaining({ issues: expect.arrayContaining([
      expect.objectContaining({ key: 'ISSUE-1', summary: 'Example issue', assignee: 'Example person' }),
      expect.objectContaining({ assignee: null })
    ]) }))
  })

  it('anonymizes backport keys and drops pull request links in exports', async () => {
    const { context, storage } = setup({ fetchedAt: fixture.fetchedAt, issues: [{
      key: 'OCPBUGS-1', summary: 'Real summary', labels: ['refined-by-agent', 'jlp-release-4.22:OCPBUGS-2'],
      backports: [{ key: 'OCPBUGS-2', branch: 'release-4.22', status: 'POST', merged: false }],
      pullRequests: [{ url: 'https://github.com/openshift/hypershift/pull/1', repo: 'openshift/hypershift', number: 1 }]
    }] })
    const addFile = vi.fn()
    const mapping = { anonymizeJiraKey: key => key.replace('OCPBUGS', 'TEST1'), anonymizeIssueSummary: () => 'Example issue', getOrCreateNameMapping: () => 'Example person' }
    await context.registerExport.mock.calls[0][0](addFile, storage, mapping)
    const [issue] = addFile.mock.calls[0][1].issues
    expect(issue.labels).toEqual(['refined-by-agent', 'jlp-release-4.22:TEST1-2'])
    expect(issue.backports).toEqual([{ key: 'TEST1-2', branch: 'release-4.22', status: 'POST', merged: false }])
    expect(issue.pullRequests).toEqual([])
    expect(JSON.stringify(addFile.mock.calls[0][1])).not.toContain('OCPBUGS')
    expect(JSON.stringify(addFile.mock.calls[0][1])).not.toContain('github.com')
  })
})
