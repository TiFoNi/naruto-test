let touched = -1

if (typeof window !== 'undefined') {
  const mark = (event: Event) => {
    if (event.isTrusted) touched = performance.now()
  }
  for (const type of ['pointerdown', 'touchstart', 'keydown', 'click']) window.addEventListener(type, mark, { capture: true, passive: true })
}

export const humanHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}
  return {
    'x-nanda-touch': touched < 0 ? 'none' : String(Math.round(performance.now() - touched)),
    ...(navigator.webdriver ? { 'x-nanda-wd': '1' } : {}),
  }
}
