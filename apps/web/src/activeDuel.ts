const KEY = 'nanda.duel'
const EVENT = 'nanda-duel'

export const activeDuel = () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY))

export function setActiveDuel(code: string | null) {
  if (typeof localStorage === 'undefined') return
  if (code) localStorage.setItem(KEY, code)
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function watchActiveDuel(onChange: (code: string | null) => void) {
  const handle = () => onChange(activeDuel())
  window.addEventListener(EVENT, handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}
