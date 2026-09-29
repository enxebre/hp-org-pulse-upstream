import { describe, it, expect, vi } from 'vitest'

const {
  prStateFromRestPull,
  hydratePullRequestState,
  hydrateLinkedPrStates
} = require('../../server/github/prs')

function okPullResponse(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data
  }
}

describe('prStateFromRestPull', () => {
  it('maps merged PRs to MERGED', () => {
    expect(prStateFromRestPull({ merged: true, state: 'closed' })).toBe('MERGED')
  })

  it('maps open PRs to OPEN', () => {
    expect(prStateFromRestPull({ merged: false, state: 'open' })).toBe('OPEN')
  })

  it('maps closed-not-merged PRs to CLOSED', () => {
    expect(prStateFromRestPull({ merged: false, state: 'closed' })).toBe('CLOSED')
  })

  it('maps missing API fields to UNKNOWN', () => {
    expect(prStateFromRestPull(null)).toBe('UNKNOWN')
    expect(prStateFromRestPull({})).toBe('UNKNOWN')
  })
})

describe('hydratePullRequestState', () => {
  it('fetches PR state from the GitHub REST API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okPullResponse({ merged: true, state: 'closed' }))
    const state = await hydratePullRequestState('openshift/hypershift', 7577, 'token', fetchImpl)

    expect(state).toBe('MERGED')
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/openshift/hypershift/pulls/7577'
    )
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
  })
})

describe('hydrateLinkedPrStates', () => {
  it('updates state on every unique linked PR in the map', async () => {
    const pr1 = {
      repo: 'openshift/hypershift',
      number: 7577,
      url: 'https://github.com/openshift/hypershift/pull/7577',
      state: 'OPEN'
    };
    const pr2 = {
      repo: 'openshift/origin',
      number: 1,
      url: 'https://github.com/openshift/origin/pull/1',
      state: 'OPEN'
    };
    const linkedByKey = new Map([
      ['CNTRLPLANE-644', [pr1]],
      ['TRT-1', [pr2, pr2]]
    ]);

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okPullResponse({ merged: true, state: 'closed' }))
      .mockResolvedValueOnce(okPullResponse({ merged: false, state: 'open' }))

    await hydrateLinkedPrStates(linkedByKey, { token: 't', fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(pr1.state).toBe('MERGED')
    expect(pr2.state).toBe('OPEN')
  })

  it('sets UNKNOWN when no token is provided', async () => {
    const fetchImpl = vi.fn()
    const pr = { repo: 'openshift/origin', number: 1, url: 'u', state: null }
    const linkedByKey = new Map([
      ['TRT-1', [pr]]
    ])
    await hydrateLinkedPrStates(linkedByKey, { fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(pr.state).toBe('UNKNOWN')
  })

  it('sets UNKNOWN when the GitHub API call fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) })
    const pr = { repo: 'openshift/hypershift', number: 7577, url: 'u', state: null }
    const linkedByKey = new Map([['CNTRLPLANE-644', [pr]]])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await hydrateLinkedPrStates(linkedByKey, { token: 't', fetchImpl })

    expect(pr.state).toBe('UNKNOWN')
    warn.mockRestore()
  })
})

function headers(map) {
  return { get: (k) => (k in map ? map[k] : null) }
}

describe('hydratePullRequestState rate limiting', () => {
  it('retries a 429 and returns the eventual state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: headers({ 'x-ratelimit-reset': '1' })
      })
      .mockResolvedValueOnce(okPullResponse({ merged: true, state: 'closed' }))

    const state = await hydratePullRequestState('openshift/origin', 1, 't', fetchImpl, { backoffBaseMs: 0 })

    expect(state).toBe('MERGED')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('retries a 403 with an exhausted primary rate limit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1' })
      })
      .mockResolvedValueOnce(okPullResponse({ merged: false, state: 'open' }))

    expect(await hydratePullRequestState('openshift/origin', 1, 't', fetchImpl, { backoffBaseMs: 0 })).toBe('OPEN')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('does not retry a plain 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found', headers: headers({})
    })
    await expect(hydratePullRequestState('openshift/origin', 1, 't', fetchImpl)).rejects.toThrow(/404/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('hydrateLinkedPrStates pooling', () => {
  it('bounds in-flight requests to the configured concurrency', async () => {
    let inFlight = 0
    let peak = 0
    const fetchImpl = vi.fn().mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 5))
      inFlight--
      return okPullResponse({ merged: false, state: 'open' })
    })

    const linkedByKey = new Map()
    for (let i = 0; i < 12; i++) {
      linkedByKey.set(`TRT-${i}`, [{
        repo: 'openshift/origin', number: i, url: `u${i}`, state: null
      }])
    }

    await hydrateLinkedPrStates(linkedByKey, { token: 't', fetchImpl, concurrency: 3 })

    expect(fetchImpl).toHaveBeenCalledTimes(12)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(3)
    expect(linkedByKey.get('TRT-11')[0].state).toBe('OPEN')
  })

  it('hydrates remaining PRs when one call fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const good = { repo: 'openshift/origin', number: 1, url: 'a', state: null }
    const bad = { repo: 'openshift/origin', number: 2, url: 'b', state: null }
    const fetchImpl = vi.fn().mockImplementation(async (url) => {
      if (url.endsWith('/2')) throw new Error('socket hang up')
      return okPullResponse({ merged: true, state: 'closed' })
    })

    await hydrateLinkedPrStates(new Map([['K-1', [good, bad]]]), { token: 't', fetchImpl, concurrency: 2 })

    expect(good.state).toBe('MERGED')
    expect(bad.state).toBe('UNKNOWN')
    warn.mockRestore()
  })
})

describe('hydrateLinkedPrStates shared PRs', () => {
  it('applies state to every copy of a PR linked from multiple Jira keys', async () => {
    // Same PR, distinct objects — what fetchLinkedPrsForKeys actually produces.
    const copyA = { repo: 'openshift/hypershift', number: 9263, url: 'https://github.com/openshift/hypershift/pull/9263', state: null }
    const copyB = { repo: 'openshift/hypershift', number: 9263, url: 'https://github.com/openshift/hypershift/pull/9263', state: null }
    const other = { repo: 'openshift/origin', number: 1, url: 'https://github.com/openshift/origin/pull/1', state: null }

    const fetchImpl = vi.fn().mockResolvedValue(okPullResponse({ merged: true, state: 'closed' }))

    await hydrateLinkedPrStates(new Map([
      ['OCPBUGS-105435', [copyA]],
      ['OCPBUGS-105434', [copyB]],
      ['TRT-9', [other]]
    ]), { token: 't', fetchImpl })

    // One fetch per unique url, not per copy.
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(copyA.state).toBe('MERGED')
    expect(copyB.state).toBe('MERGED')
  })

  it('marks every copy UNKNOWN when the shared PR fails to hydrate', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const copyA = { repo: 'openshift/origin', number: 5, url: 'u5', state: null }
    const copyB = { repo: 'openshift/origin', number: 5, url: 'u5', state: null }
    const fetchImpl = vi.fn().mockRejectedValue(new Error('socket hang up'))

    await hydrateLinkedPrStates(new Map([['A', [copyA]], ['B', [copyB]]]), { token: 't', fetchImpl })

    expect(copyA.state).toBe('UNKNOWN')
    expect(copyB.state).toBe('UNKNOWN')
    warn.mockRestore()
  })

  it('marks every copy UNKNOWN when no token is provided', async () => {
    const copyA = { repo: 'openshift/origin', number: 5, url: 'u5', state: null }
    const copyB = { repo: 'openshift/origin', number: 5, url: 'u5', state: null }
    await hydrateLinkedPrStates(new Map([['A', [copyA]], ['B', [copyB]]]), {})
    expect(copyA.state).toBe('UNKNOWN')
    expect(copyB.state).toBe('UNKNOWN')
  })
})
