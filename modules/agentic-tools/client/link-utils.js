export function getToolLinkType(url) {
  if (!url) return 'tbd'

  try {
    const resolvedUrl = new URL(url, window.location.href)
    return resolvedUrl.origin === window.location.origin ? 'internal' : 'external'
  } catch {
    return 'external'
  }
}
