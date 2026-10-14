'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointer } from 'react'
import BackButton from './BackButton'
import { api } from './api'
import { GAMES } from './games'
import { useI18n } from './i18n'
import { CloseIcon, PlusIcon } from './icons'
import { useHref } from './router'
import { SHOWCASE_MAX } from './showcase'

type Row = { game: string; pool: number; solved: number }
type Summary = { games: Row[]; showcase: string[] }
type Drag = { game: string; w: number }

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const THRESHOLD = 6
const HOLD = 300
const SETTLE = 560
const EDGE_STEP = 16
const EDGE_GAP = 24

export default function Worlds({ id, nickname }: { id?: string; nickname?: string } = {}) {
  const { t, l } = useI18n()
  const href = useHref()
  const [rows, setRows] = useState<Map<string, Row> | null>(null)
  const [order, setOrder] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [flipped, setFlipped] = useState<string[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [aim, setAim] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLUListElement>(null)
  const lift = useRef<HTMLSpanElement | null>(null)
  const liftAt = useRef({ x: 0, y: 0 })
  const pop = useRef<string | null>(null)
  const held = useRef(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>(id ? `profile/summary?id=${id}` : 'profile/summary')
    if (!ok) return setFailed(true)
    const games = data.games ?? []
    const showcase = (data.showcase ?? []).filter((one) => games.some((row) => row.game === one)).slice(0, SHOWCASE_MAX)
    const seats = Array.from({ length: SHOWCASE_MAX }, (_, index) => showcase[index] ?? '')
    const list = [...seats, ...games.map((row) => row.game).filter((one) => !showcase.includes(one))]
    setRows(new Map(games.map((row) => [row.game, row])))
    setOrder(list)
    setSaved(list)
    setPending(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (aim === null) return
    const off = (event: KeyboardEvent) => event.key === 'Escape' && setAim(null)
    window.addEventListener('keydown', off)
    return () => window.removeEventListener('keydown', off)
  }, [aim])

  const keep = async () => {
    setBusy(true)
    const { ok } = await api('profile', { action: 'showcase', showcase: order.slice(0, SHOWCASE_MAX).filter(Boolean) })
    setBusy(false)
    if (!ok) return setFailed(true)
    setFailed(false)
    setSaved(order)
    setPending(false)
  }

  const fill = (slot: number, game: string) => {
    const from = order.indexOf(game)
    if (from < 0 || slot >= SHOWCASE_MAX) return
    const next = [...order]
    if (from < SHOWCASE_MAX) next[from] = ''
    else next.splice(from, 1)
    next[slot] = game
    pop.current = game
    setAim(null)
    setOrder(next)
    setPending(next.slice(0, SHOWCASE_MAX).join() !== saved.slice(0, SHOWCASE_MAX).join())
  }

  const free = (slot: number) => {
    const next = [...order]
    const game = next[slot]
    if (!game) return
    next[slot] = ''
    next.push(game)
    setAim(null)
    setOrder(next)
    setPending(next.slice(0, SHOWCASE_MAX).join() !== saved.slice(0, SHOWCASE_MAX).join())
  }

  const undo = () => {
    setOrder(saved)
    setPending(false)
  }

  useLayoutEffect(() => {
    const node = grid.current
    const name = pop.current
    if (!node || !name) return
    pop.current = null
    const tile = node.querySelector<HTMLElement>(`li[data-game="${name}"]`)
    if (!tile) return
    const face = tile.querySelector<HTMLElement>('.world-flip') ?? tile
    if (typeof face.animate !== 'function') return
    for (const old of face.getAnimations()) old.cancel()
    face.animate(
      [
        { transform: 'scale(0.955)', opacity: 0.7, offset: 0 },
        { transform: 'scale(1.012)', opacity: 1, offset: 0.6 },
        { transform: 'scale(0.998)', offset: 0.85 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: SETTLE, easing: 'cubic-bezier(0.16, 0.9, 0.2, 1)' },
    )
  })

  useEffect(() => {
    const node = grid.current
    if (!node) return
    const fit = () => {
      if (held.current) return
      const tiles = node.querySelectorAll<HTMLElement>('li[data-game]')
      const last = tiles[Math.min(SHOWCASE_MAX, tiles.length) - 1]
      if (last) node.style.setProperty('--seats', `${last.offsetTop + last.offsetHeight}px`)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(fit)
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [rows, order.length])

  const slotAt = (x: number, y: number) => {
    const node = grid.current
    if (!node) return -1
    const box = node.getBoundingClientRect()
    const px = x - box.left
    const py = y - box.top
    return [...node.querySelectorAll<HTMLElement>('li[data-game]')].findIndex(
      (tile) =>
        px >= tile.offsetLeft &&
        px <= tile.offsetLeft + tile.offsetWidth &&
        py >= tile.offsetTop &&
        py <= tile.offsetTop + tile.offsetHeight,
    )
  }

  const place = (home: string[], plan: string[], game: string, slot: number, swap: boolean) => {
    const from = home.indexOf(game)
    if (slot < 0 || from < 0 || slot > home.length) return plan
    if (slot === from) return home

    if (swap) {
      const next = [...home]
      if (slot < SHOWCASE_MAX && from >= SHOWCASE_MAX && !home[slot]) {
        next.splice(from, 1)
        next[slot] = game
        return next
      }
      next[from] = home[slot]
      next[slot] = game
      return next
    }

    const base = home.filter((one) => one !== game)
    return [...base.slice(0, slot), game, ...base.slice(slot)]
  }

  const grab = (row: Row) => (event: ReactPointer<HTMLButtonElement>) => {
    if (id || event.button !== 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const start = { x: event.clientX, y: event.clientY }
    const hold = { dx: event.clientX - box.left, dy: event.clientY - box.top }
    const home = order
    let moved = false
    let plan = order
    let frame = 0
    let marked: HTMLElement | null = null
    let swap = !(event.altKey || event.metaKey)
    let spot = { x: event.clientX, y: event.clientY }
    const touch = event.pointerType === 'touch'
    let ready = !touch
    let timer = touch
      ? window.setTimeout(() => {
          ready = true
          begin()
        }, HOLD)
      : 0

    const mark = (tile: HTMLElement | null) => {
      if (marked === tile) return
      marked?.classList.remove('is-swap')
      tile?.classList.add('is-swap')
      marked = tile
    }

    const paint = () => {
      frame = 0
      liftAt.current = { x: spot.x - hold.dx, y: spot.y - hold.dy }
      const node = lift.current
      if (node) node.style.transform = `translate3d(${liftAt.current.x}px, ${liftAt.current.y}px, 0)`

      const edge = 56
      const top = spot.y - edge
      const low = spot.y - (window.innerHeight - edge)
      const depth = top < 0 ? top : low > 0 ? low : 0
      const want = depth ? Math.sign(depth) * EDGE_STEP * Math.min(1, Math.abs(depth) / edge) : 0
      const box = grid.current?.getBoundingClientRect()
      const room = !box ? want : want < 0 ? Math.min(0, box.top - EDGE_GAP) : Math.max(0, box.bottom - (window.innerHeight - EDGE_GAP))
      const push = want < 0 ? Math.max(want, room) : Math.min(want, room)
      if (push) {
        window.scrollBy(0, push)
        frame = requestAnimationFrame(paint)
      }

      const slot = slotAt(spot.x, spot.y)
      const tiles = grid.current?.querySelectorAll<HTMLElement>('li[data-game]')
      const seat = slot >= 0 ? (tiles?.[slot] ?? null) : null

      mark(swap && seat?.dataset.game !== row.game ? seat : null)

      const next = place(home, plan, row.game, slot, swap)
      if (next.join() === plan.join()) return
      const seatBack = home.indexOf(row.game)
      const back = seatBack >= 0 && next[seatBack] === row.game
      const came = seatBack >= 0 && home[slot] ? next[seatBack] : null
      const went = back && plan[seatBack] !== row.game ? plan[seatBack] : null
      pop.current = (back ? went : came) || null
      plan = next
      setOrder(next)
    }

    const block = (step: Event) => moved && step.cancelable && step.preventDefault()

    const stop = (step: Event) => step.cancelable && step.preventDefault()

    const begin = () => {
      if (moved) return
      moved = true
      held.current = true
      setAim(null)
      liftAt.current = { x: spot.x - hold.dx, y: spot.y - hold.dy }
      setFlipped((open) => open.filter((one) => one !== row.game))
      setDrag({ game: row.game, w: box.width })
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const move = (step: PointerEvent) => {
      const far = Math.abs(step.clientX - start.x) > THRESHOLD || Math.abs(step.clientY - start.y) > THRESHOLD
      if (!ready) {
        if (far) quit()
        return
      }
      spot = { x: step.clientX, y: step.clientY }
      swap = !(step.altKey || step.metaKey)
      if (!moved && !far) return
      if (!moved) return begin()
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const quit = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
      window.removeEventListener('touchmove', block)
      window.removeEventListener('contextmenu', stop)
      if (timer) window.clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
      mark(null)
    }

    const drop = () => {
      quit()
      held.current = false
      setDrag(null)
      if (!moved) {
        if (aim !== null) return fill(aim, row.game)
        setFlipped((open) => (open.includes(row.game) ? open.filter((one) => one !== row.game) : [...open, row.game]))
        return
      }
      setPending(plan.slice(0, SHOWCASE_MAX).join() !== saved.slice(0, SHOWCASE_MAX).join())
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    if (touch) {
      window.addEventListener('touchmove', block, { passive: false })
      window.addEventListener('contextmenu', stop)
    }
  }

  const Tile = (game: string, index: number) => {
    const row = rows?.get(game)
    if (!row) return null
    const meta = GAMES.find((one) => one.id === game)
    const share = percent(row.solved, row.pool)
    const open = flipped.includes(game)
    const held = drag?.game === game

    return (
      <li
        key={game}
        data-game={game}
        className={`${open ? 'is-flipped' : ''} ${held ? 'is-held' : ''} ${index < SHOWCASE_MAX ? 'is-shown' : ''}`}
        style={{ '--world-accent': meta?.accent ?? 'var(--accent)' } as CSSProperties}
      >
        <button
          type="button"
          className="world-flip"
          aria-pressed={open}
          aria-label={meta ? l(meta.label) : game}
          onPointerDown={grab(row)}
        >
          <span className="world-face is-front">
            <img
              className="world-pic"
              src={`/worlds/big/${game}.webp`}
              alt=""
              width={448}
              height={448}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </span>
          <span className="world-face is-back">
            <b>{row.solved}</b>
            <em>/ {row.pool}</em>
          </span>
        </button>
        <span className="world-line">
          <b>{meta ? l(meta.label) : game}</b>
          <em>{share}%</em>
        </span>
        <span className="world-bar">
          <i style={{ width: `${Math.max(share, 2)}%`, background: meta?.accent ?? 'var(--accent)' }} />
        </span>
        {index < SHOWCASE_MAX && !id && (
          <button type="button" className="world-drop" title={t('worlds.remove')} aria-label={t('worlds.remove')} onClick={() => free(index)}>
            <CloseIcon />
          </button>
        )}
      </li>
    )
  }

  const lifted = drag ? rows?.get(drag.game) : undefined
  const dirty = pending

  return (
    <div className="worlds-page" ref={page}>
      <div className="worlds-top">
        <header className="lb-head">
          <BackButton href={id ? href.player(id) : href.profile}>{t(id ? 'profile.back' : 'nav.profile')}</BackButton>
          <h1>{id && nickname ? nickname : t('worlds.title')}</h1>
          <p className="muted">{id ? t('worlds.leadGuest') : t('worlds.lead', { count: SHOWCASE_MAX })}</p>
        </header>
        {!id && (
          <div className="worlds-acts">
            <span className={`worlds-save ${dirty ? '' : 'is-off'}`} aria-hidden={!dirty}>
              <button type="button" className="ghost" disabled={busy || !dirty} tabIndex={dirty ? 0 : -1} onClick={undo}>
                {t('worlds.undo')}
              </button>
              <button type="button" className="primary" disabled={busy || !dirty} tabIndex={dirty ? 0 : -1} onClick={() => void keep()}>
                {t('worlds.keep')}
              </button>
            </span>
          </div>
        )}
      </div>

      {failed && <p className="notice worlds-failed">{t('err.server')}</p>}

      {!rows && failed ? (
        <div className="card center muted">{t('err.server')}</div>
      ) : !rows ? (
        <ul className="world-shelf is-all">
          {Array.from({ length: 16 }, (_, index) => (
            <li key={`ghost-${index}`}>
              <span className="sk world-pic" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`world-shelf is-all is-board ${drag ? 'is-live' : ''} ${aim !== null ? 'is-aiming' : ''} ${id ? 'is-plain' : ''}`} ref={grid}>
          {order.map((game, index) =>
            game ? (
              Tile(game, index)
            ) : (
              <li key={`seat-${index}`} data-game={`seat-${index}`} className={`is-seat ${aim === index ? 'is-aim' : ''}`}>
                {id ? (
                  <span className="world-pic is-empty">
                    <PlusIcon />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="world-pic is-empty"
                    aria-label={t('worlds.pick')}
                    aria-pressed={aim === index}
                    onClick={() => setAim((one) => (one === index ? null : index))}
                  >
                    <PlusIcon />
                  </button>
                )}
                <span className="world-line">
                  <b>{t(aim === index ? 'worlds.aim' : 'worlds.empty')}</b>
                </span>
                <span className="world-bar" />
              </li>
            ),
          )}
        </ul>
      )}

      {!!lifted && !!drag && (
        <span
          className="world-lift"
          aria-hidden
          ref={(node) => {
            lift.current = node
            if (node) node.style.transform = `translate3d(${liftAt.current.x}px, ${liftAt.current.y}px, 0)`
          }}
          style={
            {
              width: drag.w,
              '--world-accent': GAMES.find((one) => one.id === drag.game)?.accent ?? 'var(--accent)',
            } as CSSProperties
          }
        >
          <img className="world-pic" src={`/worlds/big/${drag.game}.webp`} alt="" draggable={false} />
        </span>
      )}
    </div>
  )
}
