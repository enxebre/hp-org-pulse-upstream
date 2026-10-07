import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  BarChart3, ClipboardCheck, Columns, ExternalLink, GitMerge, Globe,
  Grid3x3, Layout, Link2, Search, Wand2, Wrench
} from 'lucide-vue-next'
import { AVAILABLE_ICONS, getIconComponent } from '../../client/icon-registry'

describe('tool icon registry', () => {
  it('offers sorted, unique kebab-case names', () => {
    expect(AVAILABLE_ICONS).toEqual([...AVAILABLE_ICONS].sort())
    expect(new Set(AVAILABLE_ICONS).size).toBe(AVAILABLE_ICONS.length)
    for (const name of AVAILABLE_ICONS) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it.each([
    ['bar-chart-3', BarChart3],
    ['clipboard-check', ClipboardCheck],
    ['columns', Columns],
    ['git-merge', GitMerge],
    ['globe', Globe],
    ['grid-3x3', Grid3x3],
    ['layout', Layout],
    ['link-2', Link2],
    ['search', Search],
    ['wand-2', Wand2],
    ['wrench', Wrench]
  ])('resolves the required %s icon', (name, component) => {
    expect(AVAILABLE_ICONS).toContain(name)
    expect(getIconComponent(name)).toBe(component)
  })

  it('renders every picker choice as an SVG icon', () => {
    for (const name of AVAILABLE_ICONS) {
      const component = getIconComponent(name)
      if (name !== 'external-link') expect(component).not.toBe(ExternalLink)
      const wrapper = mount(component)
      expect(wrapper.get('svg').classes()).toContain('lucide')
      wrapper.unmount()
    }
  })

  it.each(['missing-icon', 'Sparkles', '', undefined])('falls back for unsupported name %s', name => {
    expect(getIconComponent(name)).toBe(ExternalLink)
  })
})
