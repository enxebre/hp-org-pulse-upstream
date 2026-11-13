import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GuideView from '../../client/views/GuideView.vue'

describe('Bug Pipeline Guide', () => {
  it('documents the pipeline stages, their skills, and how to onboard', () => {
    const wrapper = mount(GuideView)
    expect(wrapper.get('h2').text()).toBe('Bug Pipeline Guide')
    const guide = wrapper.get('[data-testid="pipeline-guide"]')
    expect(guide.get('[data-testid="pipeline-docs"]').attributes()).toMatchObject({
      href: 'https://thoughts-e2c4a9.pages.redhat.com/self-driven-bug-backlog/self-driven-bug-backlog.html',
      target: '_blank',
      rel: 'noopener noreferrer'
    })
    expect(guide.findAll('[data-testid^="guide-stage-"]').map(stage => stage.attributes('data-testid'))).toEqual(['guide-stage-refine', 'guide-stage-solve', 'guide-stage-backport', 'guide-stage-risk'])
    const sources = guide.findAll('[data-testid="guide-source"]')
    expect(sources.map(link => link.text())).toEqual([
      '/openshift-developer:jira-refine ↗',
      'jira_solve_pipeline.md ↗',
      'openshift_backport_pipeline.md ↗',
      '/openshift-developer:backport ↗',
      '/openshift-developer:cherry-pick ↗',
      '/openshift-developer:pr-risk-assessment ↗'
    ])
    const profiles = 'https://github.com/openshift-eng/ship-help-bot/blob/910ff153b5fad68550cf8868c5f7752fadd3ded2/ship_help_bot/shared/instructions/workspace/profiles'
    const skills = 'https://github.com/openshift-eng/ai-helpers/blob/main/plugins/openshift-developer/skills'
    expect(sources.map(link => link.attributes('href'))).toEqual([
      `${skills}/jira-refine/SKILL.md`,
      `${profiles}/jira_solve_pipeline.md`,
      `${profiles}/openshift_backport_pipeline.md`,
      `${skills}/backport/SKILL.md`,
      `${skills}/cherry-pick/SKILL.md`,
      `${skills}/pr-risk-assessment/SKILL.md`
    ])
    expect(guide.get('[data-testid="guide-stage-backport"]').findAll('[data-testid="guide-source"]')).toHaveLength(3)
    const guideline = guide.get('[data-testid="guide-stage-risk"] [data-testid="guide-source-text"]')
    expect(guideline.text()).toBe('Risk assessment guideline')
    expect(guideline.element.tagName).toBe('SPAN')
    expect(guide.html()).not.toContain('docs.google.com')
    const refine = guide.get('[data-testid="guide-stage-refine"]')
    expect(refine.text()).toContain('Triages each new OCPBUGS bug into one of:')
    expect(refine.findAll('[data-testid="guide-point"]').map(point => point.text())).toEqual(['CLOSE', 'SOLVE, with an implementation plan and backport targets', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS'])
    expect(guide.findAll('[data-testid="guide-point"]')).toHaveLength(4)
    expect(sources.every(link => link.attributes('target') === '_blank' && link.attributes('rel') === 'noopener noreferrer')).toBe(true)
    const onboarding = guide.get('[data-testid="pipeline-onboarding"]')
    expect(onboarding.get('[data-testid="onboarding-persona"]').attributes('href')).toBe('https://github.com/openshift-eng/ship-help-bot/blob/main/config/groups/openshift-core/personas/openshift_asdlc.yaml')
    expect(onboarding.text()).toContain('extends: openshift_asdlc')
    expect(onboarding.get('[data-testid="onboarding-prompt"]').text()).toBe('@chai-bot please onboard "Component X" into the automated refine+solve pipeline.')
  })

  it('lights a hovered or focused stage, its neighbors, and their edges, and fades the rest', async () => {
    const wrapper = mount(GuideView)
    const nodeStates = () => ['refine', 'solve', 'backport', 'risk'].map(key => wrapper.get(`[data-testid="guide-stage-${key}"]`).attributes('data-state'))
    const edgeStates = () => ['refine-solve', 'solve-backport', 'solve-risk', 'backport-risk'].map(key => wrapper.get(`[data-testid="guide-edge-${key}"]`).attributes('data-state'))
    expect(nodeStates()).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(edgeStates()).toEqual(['idle', 'idle', 'idle', 'idle'])

    await wrapper.get('[data-testid="guide-stage-refine"]').trigger('pointerenter', { pointerType: 'mouse' })
    expect(nodeStates()).toEqual(['active', 'related', 'dimmed', 'dimmed'])
    expect(edgeStates()).toEqual(['lit', 'dimmed', 'dimmed', 'dimmed'])

    // Moving straight to another box switches the focus without clearing in between.
    await wrapper.get('[data-testid="guide-stage-refine"]').trigger('pointerleave')
    await wrapper.get('[data-testid="guide-stage-backport"]').trigger('pointerenter', { pointerType: 'mouse' })
    expect(nodeStates()).toEqual(['dimmed', 'related', 'active', 'related'])
    expect(edgeStates()).toEqual(['dimmed', 'lit', 'dimmed', 'lit'])

    await wrapper.get('[data-testid="guide-stage-backport"]').trigger('pointerleave')
    await new Promise(resolve => setTimeout(resolve, 120))
    expect(nodeStates()).toEqual(['idle', 'idle', 'idle', 'idle'])

    // Keyboard focus on a stage's link lights it too; a tap does not.
    await wrapper.get('[data-testid="guide-stage-risk"] a').trigger('focusin')
    expect(nodeStates()).toEqual(['dimmed', 'related', 'related', 'active'])
    expect(edgeStates()).toEqual(['dimmed', 'dimmed', 'lit', 'lit'])
    await wrapper.get('[data-testid="guide-stage-risk"] a').trigger('focusout')
    await new Promise(resolve => setTimeout(resolve, 120))
    await wrapper.get('[data-testid="guide-stage-solve"]').trigger('pointerenter', { pointerType: 'touch' })
    expect(nodeStates()).toEqual(['idle', 'idle', 'idle', 'idle'])
  })

  it('keeps the next steps short: two cards whose prompts copy without being shown in full', () => {
    const wrapper = mount(GuideView)
    const onboarding = wrapper.get('[data-testid="pipeline-onboarding"]')
    expect(onboarding.get('h4').text()).toBe('Onboard your component')
    expect(onboarding.find('input').exists()).toBe(false)
    expect(onboarding.get('mark').text()).toBe('Component X')
    const customize = wrapper.get('[data-testid="pipeline-customize"]')
    expect(customize.get('h4').text()).toBe('Customize if you need to')
    expect(customize.findAll('[data-testid^="context-file-"] code').map(name => name.text())).toEqual(['AGENTS.md', '↳ refine.md', '↳ risk-assessment.md'])
    // The customize prompt is long, so the page offers it only through the copy button.
    expect(customize.text()).not.toContain('progressive disclosure')
    expect(wrapper.find('[data-testid="customize-prompt"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pipeline-repo-context"]').exists()).toBe(false)
    // Onboarding comes first, so newcomers see how to opt in before customizing.
    expect(onboarding.element.compareDocumentPosition(customize.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('copies the onboarding prompt and the customize prompt', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      const wrapper = mount(GuideView)
      const copyOnboarding = wrapper.get('[data-testid="copy-onboarding-prompt"]')
      expect(copyOnboarding.text()).toBe('Copy prompt')
      await copyOnboarding.trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith('@chai-bot please onboard "Component X" into the automated refine+solve pipeline.')
      expect(copyOnboarding.text()).toBe('Copied')

      const copyCustomize = wrapper.get('[data-testid="copy-customize-prompt"]')
      await copyCustomize.trigger('click')
      await flushPromises()
      const prompt = writeText.mock.lastCall[0]
      expect(prompt).toContain('progressive disclosure')
      expect(prompt).toContain('Create refine.md')
      expect(prompt).toContain('Create risk-assessment.md')
      expect(prompt).toContain('## Automated Bug Pipeline guides\n\n- [Refining bugs](refine.md)\n- [Assessing pull request risk](risk-assessment.md)')
      expect(copyCustomize.text()).toBe('Copied')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back to a hidden textarea when the clipboard API is blocked', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    let copiedText = null
    document.execCommand = vi.fn(() => {
      copiedText = document.activeElement?.value ?? document.querySelector('textarea')?.value
      return true
    })
    try {
      const wrapper = mount(GuideView, { attachTo: document.body })
      const copy = wrapper.get('[data-testid="copy-customize-prompt"]')
      await copy.trigger('click')
      await flushPromises()
      expect(document.execCommand).toHaveBeenCalledWith('copy')
      expect(copiedText).toContain('## Automated Bug Pipeline guides')
      expect(document.querySelector('textarea')).toBeNull()
      expect(copy.text()).toBe('Copied')

      // When both ways fail, the button stays ready to retry.
      document.execCommand = vi.fn(() => false)
      const copyOnboarding = wrapper.get('[data-testid="copy-onboarding-prompt"]')
      await copyOnboarding.trigger('click')
      await flushPromises()
      expect(copyOnboarding.text()).toBe('Copy prompt')
      wrapper.unmount()
    } finally {
      vi.unstubAllGlobals()
      delete document.execCommand
    }
  })
})
