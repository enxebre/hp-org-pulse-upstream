import { describe, expect, it, vi } from 'vitest'

const { createTestContext } = require('../../../../../shared/server/module-context')
const registerRoutes = require('../../../server/risk/index')

function routeHandler(router, method, path) {
  const call = router[method].mock.calls.find(args => args[0] === path)
  return call[call.length - 1]
}

describe('risk assessment routes', () => {
  it('registers data and refresh endpoints', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    registerRoutes(router, createTestContext())

    expect(router.get).toHaveBeenCalledWith('/data', expect.any(Function), expect.any(Function))
    expect(router.post).toHaveBeenCalledWith('/refresh', expect.any(Function), expect.any(Function), expect.any(Function))
  })

  it('serves cached counts with per-repo and combined shares', async () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = createTestContext()
    context.storage.readFromStorage = vi.fn().mockResolvedValue({
      fetchedAt: '2026-11-10T08:00:00.000Z',
      repos: [{ repo: 'openshift/hypershift', counts: { low: 25, moderate: 42, critical: 11 } }]
    })
    registerRoutes(router, context)

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await routeHandler(router, 'get', '/data')({}, res)

    expect(context.storage.readFromStorage).toHaveBeenCalledWith('risk-assessment/data.json')
    const body = res.json.mock.calls[0][0]
    expect(body.fetchedAt).toBe('2026-11-10T08:00:00.000Z')
    expect(body.levels).toEqual(['low', 'moderate', 'critical'])
    expect(body.repos[0]).toEqual({
      repo: 'openshift/hypershift',
      total: 78,
      counts: { low: 25, moderate: 42, critical: 11 },
      percentages: { low: 32, moderate: 54, critical: 14 }
    })
    expect(body.totals.total).toBe(78)
  })
})
