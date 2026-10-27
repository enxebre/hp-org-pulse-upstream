import { afterEach, describe, expect, it, vi } from 'vitest'

const { createTestContext } = require('../../../../shared/server/module-context')
const { JIRA_HOST } = require('../../../../shared/server/jira')
const registerModule = require('../../server')
const fixture = require('../../../../fixtures/bug-refinement/data.json')

afterEach(() => vi.unstubAllEnvs())

function setup(readFromStorage = vi.fn(async () => fixture)) {
  const handlers = {}
  const router = { get: vi.fn((path, ...middleware) => { handlers[`GET ${path}`] = middleware.at(-1) }) }
  const storage = { readFromStorage, writeToStorage: vi.fn() }
  const context = createTestContext({ storage, registerScopes: vi.fn() })
  registerModule(router, context)
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
  return { handlers, router, storage, context, res }
}

describe('agentic bug pipeline', () => {
  it('registers a read scope and a scoped data route', () => {
    const { router, context } = setup()
    expect(context.registerScopes).toHaveBeenCalledWith([expect.objectContaining({ key: 'bug-pipeline:read', category: 'Agentic Bug Pipeline' })])
    expect(router.get).toHaveBeenCalledWith('/data', expect.any(Function), expect.any(Function))
  })

  it('serves the exported refinement snapshot without writing storage', async () => {
    const { handlers, storage, res } = setup()
    await handlers['GET /data']({}, res)
    expect(storage.readFromStorage).toHaveBeenCalledWith('bug-refinement/data.json')
    expect(res.json).toHaveBeenCalledWith({ fetchedAt: fixture.fetchedAt, jiraHost: JIRA_HOST, demo: false, issues: fixture.issues })
    expect(storage.writeToStorage).not.toHaveBeenCalled()
  })

  it('returns an empty pipeline before the first refinement snapshot', async () => {
    const { handlers, res } = setup(vi.fn(async () => null))
    await handlers['GET /data']({}, res)
    expect(res.json).toHaveBeenCalledWith({ fetchedAt: null, jiraHost: JIRA_HOST, demo: false, issues: [] })
  })

  it('flags demo data', async () => {
    vi.stubEnv('DEMO_MODE', 'true')
    const { handlers, res } = setup()
    await handlers['GET /data']({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ demo: true, issues: fixture.issues }))
  })

  it('returns an error when storage cannot be read', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { handlers, res } = setup(vi.fn(async () => { throw new Error('disk unavailable') }))
      await handlers['GET /data']({}, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unable to load bug pipeline data. Please try again.' })
    } finally {
      log.mockRestore()
    }
  })
})
