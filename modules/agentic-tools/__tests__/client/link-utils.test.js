import { describe, expect, it } from 'vitest'
import { getToolLinkType } from '../../client/link-utils'

describe('getToolLinkType', () => {
  it('treats hash routes as internal links', () => {
    expect(getToolLinkType('#/ai-impact/rfe-review')).toBe('internal')
  })

  it('treats root-relative routes as internal links', () => {
    expect(getToolLinkType('/#/ai-impact/rfe-review')).toBe('internal')
  })

  it('treats absolute URLs on the current origin as internal links', () => {
    expect(getToolLinkType(`${window.location.origin}/#/ai-impact/rfe-review`)).toBe('internal')
  })

  it('treats URLs on another origin as external links', () => {
    expect(getToolLinkType('https://example.com')).toBe('external')
  })

  it('treats missing URLs as TBD', () => {
    expect(getToolLinkType('')).toBe('tbd')
  })
})
