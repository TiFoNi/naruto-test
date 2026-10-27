const GATED = [
  '.player-title',
  '.hero-tile',
  '.quest',
  '.bonus',
  '.award',
  '.footer-support',
  '.shot-cell',
  '.duel-vs',
  '.rival-live',
  '.tune-disc',
].join(', ')

const MARGIN = '120px'

export function startAnimGate() {
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return () => undefined

  const seen = new WeakSet<Element>()

  const sight = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.toggleAttribute('data-still', !entry.isIntersecting)
    },
    { rootMargin: MARGIN },
  )

  const watch = (node: Element) => {
    if (seen.has(node)) return
    seen.add(node)
    sight.observe(node)
  }

  const scan = (root: ParentNode) => {
    if (root instanceof Element && root.matches(GATED)) watch(root)
    root.querySelectorAll(GATED).forEach(watch)
  }

  const changes = new MutationObserver((records) => {
    for (const record of records)
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node)
      })
  })

  scan(document.body)
  changes.observe(document.body, { childList: true, subtree: true })

  return () => {
    changes.disconnect()
    sight.disconnect()
  }
}
