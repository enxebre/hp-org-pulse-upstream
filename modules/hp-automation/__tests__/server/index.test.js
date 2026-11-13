import { describe, expect, it, vi } from 'vitest'

const { createTestContext } = require('../../../../shared/server/module-context')
const registerRoutes = require('../../server/index')

function setup() {
  const router = { get: vi.fn(), post: vi.fn() }
  const registerRefresh = vi.fn()
  const registerExport = vi.fn()
  const registerScopes = vi.fn()
  registerRoutes(router, createTestContext({ registerRefresh, registerExport, registerScopes }))
  return { router, registerRefresh, registerExport, registerScopes }
}

describe('HP Automation routes', () => {
  it('serves each section under its own path', () => {
    const { router } = setup()
    expect(router.get.mock.calls.map(([path]) => path)).toEqual([
      '/pipeline/data',
      '/refine/data',
      '/solve/data',
      '/backport/data',
      '/risk/data',
      '/cve/data'
    ])
    expect(router.post.mock.calls.map(([path]) => path)).toEqual([
      '/refine/refresh',
      '/solve/refresh',
      '/backport/refresh',
      '/risk/refresh',
      '/cve/refresh'
    ])
  })

  it('gives each section its own refresh id', () => {
    const { registerRefresh } = setup()
    expect(registerRefresh.mock.calls.map(([id]) => id)).toEqual([
      'refine-refresh',
      'solve-refresh',
      'backport-refresh',
      'risk-refresh',
      'cve-refresh'
    ])
    expect(registerRefresh.mock.calls.every(([, config]) => typeof config.handler === 'function')).toBe(true)
  })

  it('keeps the scopes API tokens already use', () => {
    const { registerScopes } = setup()
    const keys = registerScopes.mock.calls.flatMap(([configs]) => configs.map(config => config.key))
    expect(keys).toEqual(expect.arrayContaining(['bug-pipeline:read', 'bug-refinement:read', 'jira-solve-agent:read', 'backport-tracker:read', 'risk-assessment:read', 'cve-triage:read']))
  })

  it('registers one export hook for the module, which exports the refine snapshot', async () => {
    const { registerExport } = setup()
    // Core keeps one export hook per module, so the sections share it.
    expect(registerExport).toHaveBeenCalledTimes(1)
    const exportAll = registerExport.mock.calls[0][0]
    const mapping = {
      getOrCreateNameMapping: name => `person-${name}`,
      anonymizeJiraKey: key => `KEY-${key}`,
      anonymizeIssueSummary: () => 'summary'
    }

    const files = []
    const snapshot = { fetchedAt: '2026-11-13T00:00:00Z', issues: [{ key: 'OCPBUGS-1', assignee: 'Ada', labels: [] }] }
    await exportAll((path, data) => files.push([path, data]), { readFromStorage: vi.fn(async () => snapshot) }, mapping)
    expect(files.map(([path]) => path)).toEqual(['bug-refinement/data.json'])
    expect(files[0][1].issues[0]).toMatchObject({ key: 'KEY-OCPBUGS-1', assignee: 'person-Ada' })
  })

  it('names the section when an export fails', async () => {
    const { registerExport } = setup()
    const exportAll = registerExport.mock.calls[0][0]
    const storage = { readFromStorage: vi.fn(async () => { throw new Error('disk unavailable') }) }
    await expect(exportAll(() => {}, storage, {})).rejects.toThrow('Export failed for refine: disk unavailable')
  })
})
