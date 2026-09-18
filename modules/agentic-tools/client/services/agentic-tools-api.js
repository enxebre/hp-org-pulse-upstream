/**
 * Agentic Tools API composable — thin wrapper around apiRequest for tools CRUD.
 *
 * @module modules/agentic-tools/client/services/agentic-tools-api
 */

import { apiRequest } from '@shared/client/services/api'

const BASE_PATH = '/modules/agentic-tools/tools'

/**
 * Fetch all tools.
 * @returns {Promise<Array>} Array of tool objects
 */
export async function fetchTools() {
  return apiRequest(BASE_PATH)
}

/**
 * Create a new tool.
 * @param {object} tool - { title, description, icon, url }
 * @returns {Promise<object>} Created tool with id, order, etc.
 */
export async function createTool(tool) {
  return apiRequest(BASE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tool)
  })
}

/**
 * Update an existing tool.
 * @param {string} id - Tool ID
 * @param {object} updates - Partial tool object (title, description, icon, url, order)
 * @returns {Promise<object>} Updated tool
 */
export async function updateTool(id, updates) {
  return apiRequest(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
}

/**
 * Delete a tool.
 * @param {string} id - Tool ID
 * @returns {Promise<void>}
 */
export async function deleteTool(id) {
  return apiRequest(`${BASE_PATH}/${id}`, {
    method: 'DELETE'
  })
}


