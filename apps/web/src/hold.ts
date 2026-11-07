'use client'

export const HOLD_MS = 320
const SLOP_PX = 10

type Press = { pointerType: string; pointerId: number; clientX: number; clientY: number }

const stop = (event: Event) => event.preventDefault()

const lockScroll = (pointerId: number) => {
  document.addEventListener('touchmove', stop, { passive: false })
  window.addEventListener('contextmenu', stop, { capture: true })
  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    document.removeEventListener('touchmove', stop)
    window.removeEventListener('contextmenu', stop, { capture: true })
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

export function afterHold(press: Press, start: (held: boolean) => void) {
  if (press.pointerType !== 'touch') {
    start(false)
    return
  }
  const { pointerId, clientX, clientY } = press
  const quit = () => {
    window.clearTimeout(timer)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    window.removeEventListener('contextmenu', stop, { capture: true })
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId === pointerId && Math.hypot(event.clientX - clientX, event.clientY - clientY) > SLOP_PX) quit()
  }
  const end = (event: PointerEvent) => {
    if (event.pointerId === pointerId) quit()
  }
  const timer = window.setTimeout(() => {
    quit()
    lockScroll(pointerId)
    navigator.vibrate?.(8)
    start(true)
  }, HOLD_MS)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  window.addEventListener('contextmenu', stop, { capture: true })
}
