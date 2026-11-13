// Each HP automation page keeps its own server code in server/<section>/ and serves
// its API under /api/modules/hp-automation/<section>/.
const SECTIONS = [
  ['pipeline', require('./pipeline')],
  ['refine', require('./refine')],
  ['solve', require('./solve')],
  ['backport', require('./backport')],
  ['risk', require('./risk')],
  ['cve', require('./cve')]
]

function sectionRouter(router, section) {
  const mount = method => (path, ...handlers) => router[method](`/${section}${path}`, ...handlers)
  return { get: mount('get'), post: mount('post'), put: mount('put'), patch: mount('patch'), delete: mount('delete') }
}

// Core keeps one refresh handler per id and one export hook per module, so each
// section gets its own refresh ids and the sections share one export hook.
function sectionContext(context, section, exportHooks) {
  return Object.freeze({
    ...context,
    registerRefresh: (id, config) => context.registerRefresh(`${section}-${id}`, config),
    registerExport: (fn) => { if (typeof fn === 'function') exportHooks.push({ section, fn }) }
  })
}

module.exports = function registerRoutes(router, context) {
  const exportHooks = []
  for (const [section, register] of SECTIONS) {
    register(sectionRouter(router, section), sectionContext(context, section, exportHooks))
  }
  // One section's failure doesn't stop the others from exporting.
  context.registerExport(async function exportAll(addFile, storage, mapping) {
    const failed = []
    for (const { section, fn } of exportHooks) {
      try {
        await fn(addFile, storage, mapping)
      } catch (err) {
        failed.push(`${section}: ${err.message}`)
      }
    }
    if (failed.length) throw new Error(`Export failed for ${failed.join('; ')}`)
  })
}

module.exports.SECTIONS = SECTIONS.map(([section]) => section)
