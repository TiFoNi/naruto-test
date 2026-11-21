let touched = -1
let moves = 0
let press: { at: number; moves: number; center: boolean } | null = null

const PRESS_FRESH_MS = 3_000

if (typeof window !== 'undefined') {
  const mark = (event: Event) => {
    if (event.isTrusted) touched = performance.now()
  }
  for (const type of ['pointerdown', 'touchstart', 'keydown', 'click']) window.addEventListener(type, mark, { capture: true, passive: true })
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.isTrusted && event.pointerType === 'mouse') moves += 1
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'keydown',
    () => {
      press = null
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isTrusted || event.pointerType !== 'mouse') {
        press = null
        return
      }
      const target = event.target instanceof Element ? (event.target.closest('button, a, li, [role="option"]') ?? event.target) : null
      const box = target?.getBoundingClientRect()
      const center = !!box && box.width > 0 && Math.abs(event.clientX - (box.left + box.width / 2)) < 0.5 && Math.abs(event.clientY - (box.top + box.height / 2)) < 0.5
      press = { at: performance.now(), moves, center }
      moves = 0
    },
    { capture: true, passive: true },
  )
}

export const humanHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}
  return {
    'x-nanda-touch': touched < 0 ? 'none' : String(Math.round(performance.now() - touched)),
    ...(navigator.webdriver ? { 'x-nanda-wd': '1' } : {}),
    ...(press && performance.now() - press.at < PRESS_FRESH_MS ? { 'x-nanda-ptr': `${press.moves},${press.center ? 1 : 0}` } : {}),
  }
}

export const HUMAN_CHECK_EVENT = 'nanda:human-check'

export const askHuman = () => window.dispatchEvent(new Event(HUMAN_CHECK_EVENT))
