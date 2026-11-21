let touched = -1
let moves = 0
let press: { at: number; moves: number; center: boolean; leap: boolean } | null = null

type Spot = { x: number; y: number; t: number }

let path: Spot[] = []

const PRESS_FRESH_MS = 3_000
const PATH_KEEP = 32
const GAP_PX = 30
const JUMP_PX = 400
const LINE_FROM_MS = 600
const LINE_STEPS = 6
const LINE_SPREAD = 0.06
const LINE_TURN = 0.035

const far = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y)

const spread = (values: number[]) => {
  const mean = values.reduce((sum, one) => sum + one, 0) / values.length
  if (mean <= 0) return 0
  return Math.sqrt(values.reduce((sum, one) => sum + (one - mean) ** 2, 0) / values.length) / mean
}

const ruled = (spots: Spot[]) => {
  const end = spots.at(-1)
  if (!end) return false
  const recent = spots.filter((one) => end.t - one.t <= LINE_FROM_MS)
  if (recent.length < LINE_STEPS + 1) return false
  const steps = recent.slice(1).map((one, index) => ({ len: far(one, recent[index]!), dt: one.t - recent[index]!.t, turn: Math.atan2(one.y - recent[index]!.y, one.x - recent[index]!.x) }))
  if (steps.some((one) => one.len < 1)) return false
  const turns = steps.map((one) => one.turn)
  const bend = Math.max(...turns.map((one) => Math.abs(Math.atan2(Math.sin(one - turns[0]!), Math.cos(one - turns[0]!)))))
  return bend < LINE_TURN && spread(steps.map((one) => one.len)) < LINE_SPREAD && spread(steps.map((one) => one.dt)) < LINE_SPREAD
}

const leapt = (spots: Spot[], down: Spot) => {
  const before = spots.at(-1)
  if (before && far(before, down) > GAP_PX) return true
  if (spots.slice(1).some((one, index) => far(one, spots[index]!) > JUMP_PX)) return true
  return ruled(spots)
}

if (typeof window !== 'undefined') {
  const mark = (event: Event) => {
    if (event.isTrusted) touched = performance.now()
  }
  for (const type of ['pointerdown', 'touchstart', 'keydown', 'click']) window.addEventListener(type, mark, { capture: true, passive: true })
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!event.isTrusted || event.pointerType !== 'mouse') return
      moves += 1
      path.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
      if (path.length > PATH_KEEP) path = path.slice(-PATH_KEEP)
    },
    { capture: true, passive: true },
  )
  const forget = () => {
    path = []
  }
  window.addEventListener('blur', forget)
  document.addEventListener('mouseleave', forget)
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
      const down = { x: event.clientX, y: event.clientY, t: event.timeStamp }
      press = { at: performance.now(), moves, center, leap: leapt(path, down) }
      moves = 0
      path = [down]
    },
    { capture: true, passive: true },
  )
}

export const humanHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}
  return {
    'x-nanda-touch': touched < 0 ? 'none' : String(Math.round(performance.now() - touched)),
    ...(navigator.webdriver ? { 'x-nanda-wd': '1' } : {}),
    ...(press && performance.now() - press.at < PRESS_FRESH_MS ? { 'x-nanda-ptr': `${press.moves},${press.center ? 1 : 0},${press.leap ? 1 : 0}` } : {}),
  }
}

export const HUMAN_CHECK_EVENT = 'nanda:human-check'

export const askHuman = () => window.dispatchEvent(new Event(HUMAN_CHECK_EVENT))
