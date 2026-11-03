const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''

const DONE = 'nanda.cookie-lift'

let pending: Promise<void> | null = null

const done = () => {
  try {
    return localStorage.getItem(DONE) === '1'
  } catch {
    return false
  }
}

export const liftCookies = () => {
  if (!base || typeof window === 'undefined' || done()) return Promise.resolve()
  pending ??= fetch('/api/pulse', { credentials: 'same-origin', signal: AbortSignal.timeout(5000) })
    .then((response) => {
      if (!response.ok) return
      try {
        localStorage.setItem(DONE, '1')
      } catch {
        /* приватний режим */
      }
    })
    .catch(() => undefined)
  return pending
}
