import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a mock context with test storage
function createMockContext() {
  const storage = {
    readFromStorage: vi.fn(async () => [
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
    writeToStorage: vi.fn(async () => {}),
    deleteFromStorage: vi.fn(async () => {})
  }

  return {
    storage,
    requireAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next(),
    registerScopes: vi.fn()
  }
}

// Create a mock Express router
function createMockRouter() {
  const routes = {}

  const router = {
    get: vi.fn((path, ...handlers) => {
      routes[`GET ${path}`] = handlers
    }),
    post: vi.fn((path, ...handlers) => {
      routes[`POST ${path}`] = handlers
    }),
    patch: vi.fn((path, ...handlers) => {
      routes[`PATCH ${path}`] = handlers
    }),
    delete: vi.fn((path, ...handlers) => {
      routes[`DELETE ${path}`] = handlers
    }),
    _routes: routes
  }

  return router
}

describe('Agentic Tools Server Routes', () => {
  let router
  let context

  beforeEach(() => {
    // Setup for each test
  })

  // These tests verify the route registration structure
  // Full integration tests would require a full Express app setup

  it('registers GET /tools route', () => {
    router = createMockRouter()
    context = createMockContext()

    // Register routes (this is synchronous in the module)
    const Module = require('../../server/index.js')
    Module(router, context)

    expect(router.get).toHaveBeenCalledWith('/tools', expect.any(Function))
  })

  it('registers POST /tools route', () => {
    router = createMockRouter()
    context = createMockContext()

    const Module = require('../../server/index.js')
    Module(router, context)

    expect(router.post).toHaveBeenCalledWith('/tools', expect.any(Function), expect.any(Function), expect.any(Function))
  })

  it('registers PATCH /tools/:id route', () => {
    router = createMockRouter()
    context = createMockContext()

    const Module = require('../../server/index.js')
    Module(router, context)

    expect(router.patch).toHaveBeenCalledWith('/tools/:id', expect.any(Function), expect.any(Function), expect.any(Function))
  })

  it('registers DELETE /tools/:id route', () => {
    router = createMockRouter()
    context = createMockContext()

    const Module = require('../../server/index.js')
    Module(router, context)

    expect(router.delete).toHaveBeenCalledWith('/tools/:id', expect.any(Function), expect.any(Function), expect.any(Function))
  })

  it('registers agentic-tools:write scope', () => {
    router = createMockRouter()
    context = createMockContext()

    const Module = require('../../server/index.js')
    Module(router, context)

    expect(context.registerScopes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'agentic-tools:write',
          label: expect.any(String),
          description: expect.any(String),
          category: 'Agentic Tools'
        })
      ])
    )
  })
})
