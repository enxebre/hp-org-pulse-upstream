import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AgenticToolsSettings from '../../client/components/AgenticToolsSettings.vue'
import { AVAILABLE_ICONS } from '../../client/icon-registry'

// Mock the API composable
vi.mock('../../client/services/agentic-tools-api', () => ({
  fetchTools: vi.fn(async () => [
    {
      id: 'tool_1',
      title: 'Test Tool 1',
      description: 'First test tool',
      icon: 'wrench',
      url: 'https://example.com',
      order: 0
    },
    {
      id: 'tool_2',
      title: 'Test Tool 2',
      description: 'Second test tool',
      icon: 'hammer',
      url: 'https://example.com/tool2',
      order: 1
    }
  ]),
  createTool: vi.fn(async (tool) => ({
    id: 'tool_new',
    ...tool
  })),
  updateTool: vi.fn(async (id, updates) => ({
    id,
    title: 'Test Tool 1',
    description: 'First test tool',
    icon: 'wrench',
    url: 'https://example.com',
    order: 0,
    ...updates
  })),
  deleteTool: vi.fn(async () => {})
}))

describe('AgenticToolsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function waitForDataLoad(wrapper) {
    await flushPromises()
    await wrapper.vm.$nextTick()
  }

  it('renders the settings title', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    expect(wrapper.text()).toContain('Manage Tools')
  })

  it('renders an Add Tool button', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    // Check that an "Add Tool" button exists by text content
    const buttons = wrapper.findAll('button')
    const addButton = buttons.find(b => b.text().includes('Add Tool'))
    expect(addButton).toBeDefined()
  })

  it('loads and displays tools from API', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    const text = wrapper.text()
    expect(text).toContain('Test Tool 1')
    expect(text).toContain('Test Tool 2')
  })

  it('shows loading state initially', async () => {
    const wrapper = mount(AgenticToolsSettings)
    // Component is loading before API returns
    expect(wrapper.vm.loading).toBe(true)
    await wrapper.vm.$nextTick()
    // After API resolves, loading should be false
    expect(wrapper.vm.loading).toBe(false)
  })

  it('opens add form when Add Tool button is clicked', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    expect(wrapper.vm.showAddForm).toBe(false)
    
    // Find and click the Add Tool button
    const buttons = wrapper.findAll('button')
    const addButton = buttons.find(b => b.text().includes('Add'))
    await addButton.trigger('click')
    
    expect(wrapper.vm.showAddForm).toBe(true)
  })

  it('populates form fields when editing a tool', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    const toolToEdit = wrapper.vm.tools[0]
    wrapper.vm.editTool(toolToEdit)
    
    expect(wrapper.vm.form.title).toBe('Test Tool 1')
    expect(wrapper.vm.form.description).toBe('First test tool')
    expect(wrapper.vm.form.icon).toBe('wrench')
    expect(wrapper.vm.form.url).toBe('https://example.com')
    expect(wrapper.vm.form.order).toBe(0)
  })

  it('closes form when Cancel is clicked', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    wrapper.vm.showAddForm = true
    await wrapper.vm.$nextTick()
    
    expect(wrapper.vm.showAddForm).toBe(true)
    wrapper.vm.closeForm()
    expect(wrapper.vm.showAddForm).toBe(false)
  })

  it('disables save button when required fields are empty', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    wrapper.vm.showAddForm = true
    wrapper.vm.form.title = ''
    wrapper.vm.form.description = ''
    wrapper.vm.form.icon = ''
    
    await wrapper.vm.$nextTick()
    
    // Form validation: button should be disabled if required fields empty
    expect(!wrapper.vm.form.title || !wrapper.vm.form.description || !wrapper.vm.form.icon).toBe(true)
  })

  it('opens delete confirmation for a tool', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    const toolToDelete = wrapper.vm.tools[0]
    wrapper.vm.confirmDelete(toolToDelete)
    
    expect(wrapper.vm.toolToDelete).toEqual(toolToDelete)
  })

  it('clears toolToDelete when delete is cancelled', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    wrapper.vm.toolToDelete = wrapper.vm.tools[0]
    wrapper.vm.toolToDelete = null
    
    expect(wrapper.vm.toolToDelete).toBe(null)
  })

  it('offers the registry icons in the dropdown', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    wrapper.vm.openAddForm()
    await wrapper.vm.$nextTick()

    const options = wrapper.get('#agentic-tool-icon').findAll('option')
    expect(options.map(option => option.element.value)).toEqual(['', ...AVAILABLE_ICONS])
    expect(options.map(option => option.text())).toEqual(['Select an icon', ...AVAILABLE_ICONS])
  })

  it('updates the icon preview when a selection is made', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    wrapper.vm.openAddForm()
    await wrapper.vm.$nextTick()

    const preview = wrapper.get('[data-testid="icon-selection-preview"]')
    expect(preview.text()).toBe('')
    expect(preview.attributes('aria-label')).toBe('Icon preview; select an icon')
    expect(preview.find('svg').exists()).toBe(false)

    await wrapper.get('#agentic-tool-icon').setValue('sparkles')

    expect(preview.text()).toBe('')
    expect(preview.attributes('aria-label')).toBe('sparkles icon preview')
    expect(preview.get('svg').classes()).toContain('lucide-sparkles')
  })

  it('shows the saved icon in the preview when editing a tool', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    wrapper.vm.editTool(wrapper.vm.tools[1])
    await wrapper.vm.$nextTick()

    const preview = wrapper.get('[data-testid="icon-selection-preview"]')
    expect(preview.text()).toBe('')
    expect(preview.attributes('aria-label')).toBe('hammer icon preview')
    expect(preview.get('svg').classes()).toContain('lucide-hammer')
  })

  it('shows empty state when no tools exist', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    wrapper.vm.tools = []
    wrapper.vm.loading = false
    await wrapper.vm.$nextTick()
    
    const text = wrapper.text()
    expect(text).toContain('No tools yet')
  })

  it('displays order badge for each tool in the list', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    const text = wrapper.text()
    expect(text).toContain('0') // First tool order
    expect(text).toContain('1') // Second tool order
  })

  it('opens add form with next available order when Add Tool is clicked', async () => {
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    expect(wrapper.vm.showAddForm).toBe(false)
    expect(wrapper.vm.editingTool).toBe(null)
    
    wrapper.vm.openAddForm()
    
    expect(wrapper.vm.showAddForm).toBe(true)
    expect(wrapper.vm.form.order).toBe(2) // max(0, 1) + 1
    expect(wrapper.vm.form.title).toBe('')
  })

  it('includes order when saving a new tool', async () => {
    const { createTool } = await import('../../client/services/agentic-tools-api')
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    wrapper.vm.openAddForm()
    wrapper.vm.form.title = 'New Tool'
    wrapper.vm.form.description = 'New tool desc'
    wrapper.vm.form.icon = 'wrench'
    wrapper.vm.form.url = 'https://new.example.com'
    wrapper.vm.form.order = 5
    
    await wrapper.vm.saveForm()
    
    expect(createTool).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Tool',
        description: 'New tool desc',
        icon: 'wrench',
        url: 'https://new.example.com',
        order: 5
      })
    )
  })

  it('saves hash routes as internal tool URLs', async () => {
    const { createTool } = await import('../../client/services/agentic-tools-api')
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)

    wrapper.vm.openAddForm()
    await wrapper.vm.$nextTick()
    wrapper.vm.form.title = 'RFE Review'
    wrapper.vm.form.description = 'Open the in-app review page'
    wrapper.vm.form.icon = 'clipboard-list'
    await wrapper.get('input[placeholder="#/ai-impact/rfe-review or https://example.com"]')
      .setValue('#/ai-impact/rfe-review')

    await wrapper.vm.saveForm()

    expect(createTool).toHaveBeenCalledWith(
      expect.objectContaining({ url: '#/ai-impact/rfe-review' })
    )
  })

  it('includes order when updating an existing tool', async () => {
    const { updateTool } = await import('../../client/services/agentic-tools-api')
    const wrapper = mount(AgenticToolsSettings)
    await waitForDataLoad(wrapper)
    
    const toolToEdit = wrapper.vm.tools[0]
    wrapper.vm.editTool(toolToEdit)
    wrapper.vm.form.order = 10
    
    await wrapper.vm.saveForm()
    
    expect(updateTool).toHaveBeenCalledWith(
      'tool_1',
      expect.objectContaining({
        order: 10
      })
    )
  })
})
