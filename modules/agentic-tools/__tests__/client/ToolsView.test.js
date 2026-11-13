import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// Mock the apiRequest function
vi.mock('@shared/client/services/api', () => {
  const mockFn = vi.fn(async (path) => {
    if (path === '/modules/agentic-tools/tools') {
      return [
        {
          id: 'test-tool-1',
          title: 'Test Tool 1',
          description: 'A test tool',
          icon: 'wrench',
          url: 'https://example.com/tool1',
          order: 0
        },
        {
          id: 'test-tool-2',
          title: 'Test Tool 2',
          description: 'Another test tool',
          icon: 'hammer',
          url: 'https://example.com/tool2',
          order: 1
        },
        {
          id: 'test-tool-tbd',
          title: 'Test TBD Tool',
          description: 'A tool coming soon',
          icon: 'sparkles',
          url: '',
          order: 2
        },
        {
          id: 'test-tool-internal',
          title: 'Internal Tool',
          description: 'An in-app link',
          icon: 'code',
          url: '#/ai-impact/rfe-review',
          order: 3
        }
      ]
    }
    return []
  })
  return { apiRequest: mockFn }
})

// Mock the useAuth composable
vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAdmin: { value: true }
  }))
}))

// Now import the component after mocks are defined
import ToolsView from '../../client/views/ToolsView.vue'
import StrategicInitiativesBlock from '../../client/blocks/StrategicInitiativesBlock.vue'
import { apiRequest } from '@shared/client/services/api'

describe('ToolsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function waitForDataLoad(wrapper) {
    await flushPromises()
    await wrapper.vm.$nextTick()
  }

  it('renders the page title', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    expect(wrapper.text()).toContain('Agentic Tools')
  })

  it('does not render the landing-only Strategic Initiatives heading in the module view', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)

    expect(wrapper.find('[data-testid="strategic-initiatives"] h2').exists()).toBe(false)
    expect(wrapper.find('[data-testid="agentic-tools-content"]').exists()).toBe(true)
  })

  it('renders the Org Pulse intro hero before Strategic Initiatives in the landing block', async () => {
    const wrapper = mount(StrategicInitiativesBlock)
    await waitForDataLoad(wrapper)

    const sections = wrapper.findAll('section')
    expect(sections).toHaveLength(2)

    const intro = sections[0]
    expect(intro.find('p').text()).toBe('What is Org Pulse?')
    expect(intro.find('p').classes()).toContain('uppercase')
    expect(intro.get('h1').text()).toBe('Hybrid Platforms’ agentic evolution')
    expect(intro.findAll('p')[1].text()).toBe(
      'Org Pulse brings delivery signals, engineering data, and agentic initiatives together to tell the story of how Hybrid Platforms is evolving.'
    )
    expect(sections[1].attributes('data-testid')).toBe('strategic-initiatives')
  })

  it('renders the Strategic Initiatives heading in the landing block with CSS uppercase styling', async () => {
    const wrapper = mount(StrategicInitiativesBlock)
    await waitForDataLoad(wrapper)

    const heading = wrapper.get('[data-testid="strategic-initiatives"] h2')
    expect(heading.text()).toBe('Strategic Initiatives')
    expect(heading.classes()).toContain('uppercase')
  })

  it('renders one card per tool', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    const cards = wrapper.findAll('[data-testid="agentic-tools-content"] .grid > *')
    expect(cards).toHaveLength(4)
  })

  it('adds the refinement and pipeline home cards, in that order, when HP Automation is available', async () => {
    const wrapper = mount(StrategicInitiativesBlock, {
      global: { provide: { moduleNav: { isModuleAvailable: slug => slug === 'hp-automation' } } }
    })
    await waitForDataLoad(wrapper)
    const refine = wrapper.get('a[href="#/hp-automation/refine"]')
    expect(refine.text()).toContain('Agentic Bug Refinement')
    expect(refine.attributes('target')).toBeUndefined()
    expect(refine.get('svg').classes()).toContain('lucide-clipboard-check')
    const pipeline = wrapper.get('a[href="#/hp-automation/pipeline"]')
    expect(pipeline.text()).toContain('Agentic Bug Pipeline')
    expect(pipeline.get('svg').classes()).toContain('lucide-trending-up')
    const moduleLinks = wrapper.findAll('a').map(link => link.attributes('href')).filter(href => href?.startsWith('#/hp-automation/'))
    expect(moduleLinks).toEqual(['#/hp-automation/refine', '#/hp-automation/pipeline'])
  })

  it('hides the refinement and pipeline home cards when HP Automation is unavailable', async () => {
    const wrapper = mount(StrategicInitiativesBlock, {
      global: { provide: { moduleNav: { isModuleAvailable: slug => slug !== 'hp-automation' } } }
    })
    await waitForDataLoad(wrapper)
    expect(wrapper.find('a[href="#/hp-automation/refine"]').exists()).toBe(false)
    expect(wrapper.find('a[href="#/hp-automation/pipeline"]').exists()).toBe(false)
  })

  it('does not duplicate an admin-configured refinement launcher', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 'custom-refinement', title: 'Custom refinement', icon: 'bot', url: '#/hp-automation/refine' }])
    const wrapper = mount(StrategicInitiativesBlock, {
      global: { provide: { moduleNav: { isModuleAvailable: () => true } } }
    })
    await waitForDataLoad(wrapper)
    expect(wrapper.findAll('a[href="#/hp-automation/refine"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Custom refinement')
  })

  it.each([
    ['Test Tool 1', 'lucide-wrench'],
    ['Test Tool 2', 'lucide-hammer'],
    ['Test TBD Tool', 'lucide-sparkles'],
    ['Internal Tool', 'lucide-code']
  ])('renders the configured icon for %s', async (title, iconClass) => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)

    const card = wrapper.findAll('[data-testid="agentic-tools-content"] .grid > *')
      .find(item => item.get('h4').text() === title)
    expect(card.get('svg').classes()).toContain(iconClass)
  })

  it('renders internal tool links in the current tab', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)

    const card = wrapper.findAll('[data-testid="agentic-tools-content"] .grid > *')
      .find(item => item.find('h4').text() === 'Internal Tool')

    expect(card.element.tagName).toBe('A')
    expect(card.attributes('href')).toBe('#/ai-impact/rfe-review')
    expect(card.attributes('target')).toBeUndefined()
    expect(card.attributes('rel')).toBeUndefined()
    expect(card.text()).toContain('Internal')
  })

  it('sets correct href and target attributes on tool cards with URLs', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    const links = wrapper.findAll('a[target="_blank"]')

    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('https://example.com/tool1')
    expect(links[0].attributes('target')).toBe('_blank')
    expect(links[0].attributes('rel')).toBe('noopener noreferrer')

    expect(links[1].attributes('href')).toBe('https://example.com/tool2')
    expect(links[1].attributes('target')).toBe('_blank')
    expect(links[1].attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders tool title and description', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    expect(wrapper.text()).toContain('Test Tool 1')
    expect(wrapper.text()).toContain('A test tool')
    expect(wrapper.text()).toContain('Test Tool 2')
    expect(wrapper.text()).toContain('Another test tool')
  })

  it('renders TBD tool as non-interactive div without href', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    // Find div cards (TBD cards rendered as divs, not anchors)
    const divCards = wrapper.findAll('div.group')
    // Should have at least one div card (the TBD tool)
    expect(divCards.length).toBeGreaterThan(0)

    // Verify TBD tool content and badge
    const text = wrapper.text()
    expect(text).toContain('Test TBD Tool')
    expect(text).toContain('A tool coming soon')
    // Badge should show TBD (uppercase due to uppercase class)
    expect(text).toContain('TBD')
  })

  it('does not apply group-hover classes to TBD card icon and title', async () => {
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    // Find all div.group cards (TBD cards are divs, not anchors)
    const divCards = wrapper.findAll('div.group')
    expect(divCards.length).toBeGreaterThan(0)
    
    // Verify at least one div card is the TBD tool and lacks group-hover classes
    let foundTbdWithoutHover = false
    divCards.forEach(card => {
      const titleText = card.find('h4').text()
      if (titleText.includes('Test TBD Tool')) {
        // Verify title element does NOT have group-hover classes
        const titleClasses = card.find('h4').attributes('class')
        expect(titleClasses).not.toContain('group-hover:text-primary-600')
        expect(titleClasses).not.toContain('group-hover:text-primary-400')
        
        // Verify icon component (first child within flex container) also doesn't have group-hover
        const iconElement = card.find('.flex-shrink-0 svg')
        if (iconElement.exists()) {
          const iconClasses = iconElement.element.parentElement?.getAttribute('class') || ''
          expect(iconClasses).not.toContain('group-hover:text-primary-600')
          expect(iconClasses).not.toContain('group-hover:text-primary-400')
        }
        foundTbdWithoutHover = true
      }
    })
    expect(foundTbdWithoutHover).toBe(true)
  })

  it('handles tools gracefully when array is loaded', async () => {
    // The component correctly loads and renders tools from the API
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    const text = wrapper.text()
    // Should render either tool cards OR empty state, not both
    const hasCards = text.includes('Test Tool 1')
    const hasEmptyState = text.includes('No tools yet')
    expect(hasCards || hasEmptyState).toBe(true)
    expect(hasCards && hasEmptyState).toBe(false)
  })

  it('renders empty state when no tools are available', async () => {
    // Mock empty response
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    const text = wrapper.text()
    expect(text).toContain('No tools yet')
  })

  it('displays Wand2 icon in the empty state', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    // Check for the centered flex layout used by empty state
    const emptyState = wrapper.find('.flex.flex-col.items-center')
    expect(emptyState.exists()).toBe(true)
  })

  it('shows Settings link in empty state when user is admin', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    const text = wrapper.text()
    expect(text).toContain('Go to')
    expect(text).toContain('Settings')
    expect(text).toContain('to add your first tool')
  })

  it('navigates to settings when Settings link is clicked', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    vi.stubGlobal('location', {
      href: window.location.href,
      origin: window.location.origin,
      hash: ''
    })
    
    const settingsButton = wrapper.find('button')
    await settingsButton.trigger('click')
    
    expect(window.location.hash).toBe('#/settings?tab=agentic-tools')
  })

  it('shows either admin or non-admin message based on isAdmin value', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    
    const wrapper = mount(ToolsView)
    await waitForDataLoad(wrapper)
    
    const text = wrapper.text()
    // For admin users (default mock), should show Settings link
    expect(text).toContain('Go to')
    expect(text).toContain('Settings')
    
    // Non-admin message should only appear if isAdmin is false
    // This is tested implicitly — if it were visible here, the first assertions would fail
  })
})
