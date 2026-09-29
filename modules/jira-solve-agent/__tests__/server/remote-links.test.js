import { describe, it, expect, vi } from 'vitest'

const {
  parseRemoteLinkPr,
  prStateFromRemoteLink,
  fetchRemoteLinksForKey,
  fetchLinkedPrsForKeys
} = require('../../server/jira/remote-links')

function remoteLink({ url, status }) {
  return {
    object: {
      url,
      title: url,
      status: status || {}
    }
  }
}

describe('prStateFromRemoteLink', () => {
  it('maps merged icon title to MERGED', () => {
    expect(prStateFromRemoteLink(remoteLink({
      url: 'https://github.com/openshift/origin/pull/1',
      status: { icon: { title: 'Merged' } }
    }))).toBe('MERGED')
  })

  it('maps open icon title to OPEN', () => {
    expect(prStateFromRemoteLink(remoteLink({
      url: 'https://github.com/openshift/origin/pull/1',
      status: { icon: { title: 'Open' } }
    }))).toBe('OPEN')
  })

  it('maps resolved without icon to CLOSED', () => {
    expect(prStateFromRemoteLink(remoteLink({
      url: 'https://github.com/openshift/origin/pull/1',
      status: { resolved: true }
    }))).toBe('CLOSED')
  })
})

describe('parseRemoteLinkPr', () => {
  it('parses repo, number, state and team from a GitHub remote link', () => {
    const pr = parseRemoteLinkPr(remoteLink({
      url: 'https://github.com/openshift/sippy/pull/3452',
      status: { icon: { title: 'Open' } }
    }), new Set(['openshift/sippy']))

    expect(pr).toEqual({
      repo: 'openshift/sippy',
      team: 'trt',
      number: 3452,
      url: 'https://github.com/openshift/sippy/pull/3452',
      state: null,
      author: null
    })
  })

  it('skips links outside agent repos', () => {
    const pr = parseRemoteLinkPr(remoteLink({
      url: 'https://github.com/other/repo/pull/1'
    }), new Set(['openshift/sippy']))
    expect(pr).toBeNull()
  })

  it('skips non-PR urls', () => {
    const pr = parseRemoteLinkPr(remoteLink({
      url: 'https://github.com/openshift/origin/issues/99'
    }), new Set(['openshift/origin']))
    expect(pr).toBeNull()
  })
})

describe('fetchRemoteLinksForKey', () => {
  it('calls the Jira remotelink endpoint for the issue key', async () => {
    const jiraRequest = vi.fn().mockResolvedValue([])
    await fetchRemoteLinksForKey(jiraRequest, 'WINC-2089')
    expect(jiraRequest).toHaveBeenCalledWith('/rest/api/3/issue/WINC-2089/remotelink')
  })
})

describe('fetchLinkedPrsForKeys', () => {
  it('maps each key to parsed PRs from remote links', async () => {
    const jiraRequest = vi.fn()
      .mockResolvedValueOnce([
        remoteLink({ url: 'https://github.com/openshift/sippy/pull/1', status: { icon: { title: 'Open' } } })
      ])
      .mockResolvedValueOnce([
        remoteLink({ url: 'https://github.com/openshift/origin/pull/2', status: { resolved: true } })
      ])

    const m = await fetchLinkedPrsForKeys(jiraRequest, ['TRT-1', 'TRT-2'], { throttleMs: 0 })

    expect(jiraRequest).toHaveBeenCalledTimes(2)
    expect(m.get('TRT-1')[0].number).toBe(1)
    expect(m.get('TRT-2')[0].state).toBe(null)
  })

  it('de-duplicates keys and skips falsy values', async () => {
    const jiraRequest = vi.fn().mockResolvedValue([])
    const m = await fetchLinkedPrsForKeys(jiraRequest, ['TRT-1', 'TRT-1', null, ''], { throttleMs: 0 })
    expect(jiraRequest).toHaveBeenCalledTimes(1)
    expect(m.size).toBe(0)
  })

  it('caps the number of keys fetched and logs the remainder', async () => {
    const jiraRequest = vi.fn().mockResolvedValue([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const keys = Array.from({ length: 5 }, (_, i) => `TRT-${i + 1}`)
    const m = await fetchLinkedPrsForKeys(jiraRequest, keys, { throttleMs: 0, maxKeys: 2 })

    expect(jiraRequest).toHaveBeenCalledTimes(2)
    expect(m.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/capped at 2 keys/))
    warn.mockRestore()
  })

  it('keeps going when a single key fetch fails', async () => {
    const jiraRequest = vi.fn()
      .mockRejectedValueOnce(new Error('network boom'))
      .mockResolvedValueOnce([
        remoteLink({ url: 'https://github.com/openshift/origin/pull/9' })
      ])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const m = await fetchLinkedPrsForKeys(jiraRequest, ['TRT-1', 'TRT-2'], { throttleMs: 0 })

    expect(m.has('TRT-1')).toBe(false)
    expect(m.get('TRT-2')[0].number).toBe(9)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/failed for TRT-1/))
    warn.mockRestore()
  })

  it('de-duplicates multiple remote links to the same PR url', async () => {
    const jiraRequest = vi.fn().mockResolvedValue([
      remoteLink({ url: 'https://github.com/openshift/hypershift/pull/7' }),
      remoteLink({ url: 'https://github.com/openshift/hypershift/pull/7' })
    ])
    const m = await fetchLinkedPrsForKeys(jiraRequest, ['OCPBUGS-1'], { throttleMs: 0 })
    expect(m.get('OCPBUGS-1')).toHaveLength(1)
  })
})

describe('fetchLinkedPrsForKeys concurrency', () => {
  it('fetches keys concurrently in bounded waves', async () => {
    let inFlight = 0
    let peak = 0
    const jiraRequest = vi.fn().mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 5))
      inFlight--
      return []
    })

    const keys = Array.from({ length: 10 }, (_, i) => `TRT-${i + 1}`)
    await fetchLinkedPrsForKeys(jiraRequest, keys, { concurrency: 4 })

    expect(jiraRequest).toHaveBeenCalledTimes(10)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('still collects results from other keys when one rejects mid-wave', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const jiraRequest = vi.fn().mockImplementation(async (path) => {
      if (path.includes('TRT-2')) throw new Error('network boom')
      return [remoteLink({ url: 'https://github.com/openshift/origin/pull/5' })]
    })

    const m = await fetchLinkedPrsForKeys(jiraRequest, ['TRT-1', 'TRT-2', 'TRT-3'], { concurrency: 3 })

    expect(m.has('TRT-1')).toBe(true)
    expect(m.has('TRT-2')).toBe(false)
    expect(m.has('TRT-3')).toBe(true)
    warn.mockRestore()
  })
})
