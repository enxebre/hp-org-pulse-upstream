/**
 * Agentic Tools — server-side routes for managing internal and external tool links.
 *
 * Routes:
 * - GET  /tools              — list all tools (public)
 * - POST /tools              — create a new tool (admin-gated)
 * - PATCH /tools/:id         — update a tool (admin-gated)
 * - DELETE /tools/:id        — delete a tool (admin-gated)
 *
 * @module modules/agentic-tools/server
 */

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context
  const { readFromStorage, writeToStorage } = storage
  const DEMO_MODE = process.env.DEMO_MODE === 'true'

  // Register scopes for this module
  context.registerScopes([
    { key: 'agentic-tools:write', label: 'Agentic Tools (Write)', description: 'Manage internal and external tool links', category: 'Agentic Tools' }
  ])

  /**
   * Prevent writes in demo mode.
   * Returns true if demo mode is active (caller should return early).
   */
  function demoWriteGuard(res) {
    if (DEMO_MODE) {
      res.json({ demo: true, message: 'Demo mode — changes are not saved' })
      return true
    }
    return false
  }

  /**
   * @openapi
   * /api/modules/agentic-tools/tools:
   *   get:
   *     tags: ['Agentic Tools']
   *     summary: List all internal and external tool links
   *     description: Returns an array of tool objects sorted by order field
   *     responses:
   *       200:
   *         description: Array of tool objects
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: tool_1234567890_abcdef
   *                   title:
   *                     type: string
   *                     example: Example Tool
   *                   description:
   *                     type: string
   *                     example: A tool for doing things
   *                   icon:
   *                     type: string
   *                     example: Wrench
   *                   url:
   *                     type: string
   *                     example: https://example.com
   *                   order:
   *                     type: integer
   *                     example: 0
   */
  router.get('/tools', async (req, res) => {
    const tools = (await readFromStorage('agentic-tools/tools.json')) || []
    const sorted = tools.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    res.json(sorted)
  })

  /**
   * @openapi
   * /api/modules/agentic-tools/tools:
   *   post:
   *     tags: ['Agentic Tools']
   *     summary: Create a new tool launcher
   *     description: Requires admin role and agentic-tools:write scope
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, description, icon]
   *             properties:
   *               title:
   *                 type: string
   *                 example: My Tool
   *               description:
   *                 type: string
   *                 example: What this tool does
   *               icon:
   *                 type: string
   *                 example: Wrench
   *               url:
   *                 type: string
   *                 example: https://example.com
   *               order:
   *                 type: integer
   *                 example: 0
   *     responses:
   *       201:
   *         description: Tool created successfully
   *       400:
   *         description: Missing required fields
   *       403:
   *         description: Not authorized
   */
  router.post('/tools', requireAdmin, requireScope('agentic-tools:write'), async (req, res) => {
    if (demoWriteGuard(res)) return

    const { title, description, icon, url, order } = req.body || {}

    // Validation
    if (!title || !description || !icon) {
      return res.status(400).json({ error: 'title, description, and icon are required' })
    }

    // Read existing tools
    const tools = (await readFromStorage('agentic-tools/tools.json')) || []

    // Generate ID
    const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Determine order: if not provided, append to end
    let finalOrder = order
    if (finalOrder === undefined || finalOrder === null) {
      const maxOrder = tools.reduce((m, t) => Math.max(m, t.order ?? 0), -1)
      finalOrder = maxOrder + 1
    }

    const tool = {
      id,
      title,
      description,
      icon,
      url: url || '',
      order: finalOrder
    }

    tools.push(tool)
    await writeToStorage('agentic-tools/tools.json', tools)

    res.status(201).json(tool)
  })

  /**
   * @openapi
   * /api/modules/agentic-tools/tools/{id}:
   *   patch:
   *     tags: ['Agentic Tools']
   *     summary: Update a tool launcher
   *     description: Requires admin role and agentic-tools:write scope. Pass only fields to update.
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               icon:
   *                 type: string
   *               url:
   *                 type: string
   *               order:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Tool updated successfully
   *       404:
   *         description: Tool not found
   *       403:
   *         description: Not authorized
   */
  router.patch('/tools/:id', requireAdmin, requireScope('agentic-tools:write'), async (req, res) => {
    if (demoWriteGuard(res)) return

    const tools = (await readFromStorage('agentic-tools/tools.json')) || []
    const idx = tools.findIndex(t => t.id === req.params.id)

    if (idx === -1) {
      return res.status(404).json({ error: 'Tool not found' })
    }

    // Update: merge request body into existing tool, preserve id
    const updated = {
      ...tools[idx],
      ...req.body,
      id: tools[idx].id // prevent id tampering
    }

    tools[idx] = updated
    await writeToStorage('agentic-tools/tools.json', tools)

    res.json(updated)
  })

  /**
   * @openapi
   * /api/modules/agentic-tools/tools/{id}:
   *   delete:
   *     tags: ['Agentic Tools']
   *     summary: Delete a tool launcher
   *     description: Requires admin role and agentic-tools:write scope
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Tool deleted successfully
   *       404:
   *         description: Tool not found
   *       403:
   *         description: Not authorized
   */
  router.delete('/tools/:id', requireAdmin, requireScope('agentic-tools:write'), async (req, res) => {
    if (demoWriteGuard(res)) return

    const tools = (await readFromStorage('agentic-tools/tools.json')) || []
    const idx = tools.findIndex(t => t.id === req.params.id)

    if (idx === -1) {
      return res.status(404).json({ error: 'Tool not found' })
    }

    tools.splice(idx, 1)
    await writeToStorage('agentic-tools/tools.json', tools)

    res.status(204).end()
  })
}
