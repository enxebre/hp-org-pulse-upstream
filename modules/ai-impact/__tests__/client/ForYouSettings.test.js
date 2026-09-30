import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ForYouSettings from '../../client/components/ForYouSettings.vue'

describe('ForYouSettings', () => {
  const defaults = {
    mode: 'auto',
    manualComponents: [],
    availableComponents: ['Platform Core', 'ML Models', 'Dashboard'],
    componentsLoading: false
  }

  function createWrapper(props = {}) {
    return mount(ForYouSettings, {
      props: { ...defaults, ...props },
      attachTo: document.body
    })
  }

  it('renders mode radio buttons', () => {
    const wrapper = createWrapper()
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    wrapper.unmount()
  })

  it('selects auto by default when mode is auto', () => {
    const wrapper = createWrapper({ mode: 'auto' })
    const autoRadio = wrapper.find('input[type="radio"][value="auto"]')
    expect(autoRadio.element.checked).toBe(true)
    wrapper.unmount()
  })

  it('shows component picker when manual mode is selected', async () => {
    const wrapper = createWrapper({ mode: 'manual' })
    expect(wrapper.text()).toContain('Select All')
    wrapper.unmount()
  })

  it('hides component picker in auto mode', () => {
    const wrapper = createWrapper({ mode: 'auto' })
    expect(wrapper.text()).not.toContain('Select All')
    wrapper.unmount()
  })

  it('emits update with auto mode when Apply clicked in auto mode', async () => {
    const wrapper = createWrapper({ mode: 'auto' })
    const applyBtn = wrapper.findAll('button').find(b => b.text().includes('Apply'))
    await applyBtn.trigger('click')
    expect(wrapper.emitted('update')).toHaveLength(1)
    expect(wrapper.emitted('update')[0]).toEqual(['auto', []])
    wrapper.unmount()
  })

  it('emits update with manual mode and components when Apply clicked', async () => {
    const wrapper = createWrapper({ mode: 'manual', manualComponents: ['Platform Core'] })
    const applyBtn = wrapper.findAll('button').find(b => b.text().includes('Apply'))
    await applyBtn.trigger('click')
    expect(wrapper.emitted('update')[0]).toEqual(['manual', ['Platform Core']])
    wrapper.unmount()
  })

  it('shows Reset to Auto link in manual mode', () => {
    const wrapper = createWrapper({ mode: 'manual' })
    const resetBtn = wrapper.findAll('button').find(b => b.text().includes('Reset to Auto'))
    expect(resetBtn).toBeTruthy()
    wrapper.unmount()
  })

  it('emits update with auto when Reset to Auto is clicked', async () => {
    const wrapper = createWrapper({ mode: 'manual', manualComponents: ['ML Models'] })
    const resetBtn = wrapper.findAll('button').find(b => b.text().includes('Reset to Auto'))
    await resetBtn.trigger('click')
    expect(wrapper.emitted('update')[0]).toEqual(['auto', []])
    wrapper.unmount()
  })

  it('emits close on click outside', async () => {
    const wrapper = createWrapper()
    // Simulate click outside the popover
    const event = new MouseEvent('mousedown', { bubbles: true })
    document.body.dispatchEvent(event)
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
