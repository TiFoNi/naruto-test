'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { levelAt } from '@nanda/game'
import { api } from './api'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { useHref } from './router'
import { CHAPTER, CHAPTERS, chapterOf, type Reward, type RewardKind } from './levelPlan'
import GemIcon from './GemIcon'
import { CheckIcon } from './icons'

type Claims = { taken: Set<number> | null; busy: number | null; claim: (level: number) => void }

const ClaimsContext = createContext<Claims>({ taken: null, busy: null, claim: () => {} })

const NARROW = 560

type Layout = { columns: number; gap: number; unit: number }

const layoutOf = (width: number): Layout => {
  const columns = width < NARROW ? 3 : 7
  const gap = width < NARROW ? 14 : 22
  return { columns, gap, unit: Math.floor((width - gap * (columns - 1)) / columns) }
}

const SPAN: Partial<Record<RewardKind, number>> = { title: 2, banner: 3 }

const WIDE = 2

type Seat = { reward: Reward; span: number }

type Box = { x: number; y: number; left: number; right: number; top: number; bottom: number }

type Bounds = Map<number, { top: number; bottom: number }>

function rowsFor(rewards: Reward[], { columns }: Layout) {
  const rows: Seat[][] = [[]]
  let used = 0
  rewards.forEach((reward, place) => {
    const want = Math.min(columns, SPAN[reward.kind] ?? 1)
    const left = columns - used
    const last = place === rewards.length - 1
    let span = want
    if (reward.kind === 'chest' && last) span = left > 0 ? left : columns
    else if (want >= WIDE && left >= WIDE && left < want) span = left
    if (rows[rows.length - 1]!.length && span > left) {
      rows.push([])
      used = 0
      if (reward.kind === 'chest' && last) span = columns
    }
    rows[rows.length - 1]!.push({ reward, span })
    used += span
  })
  return rows
}

const EDGE = 14

function trail(boxes: Box[], rows: number[], bounds: Bounds) {
  if (boxes.length < 2) return ''
  let path = `M ${boxes[0]!.x} ${boxes[0]!.y}`
  for (let index = 1; index < boxes.length; index++) {
    const from = boxes[index - 1]!
    const to = boxes[index]!
    if (rows[index] === rows[index - 1]) {
      path += ` L ${to.x} ${to.y}`
      continue
    }
    const low = Math.max(from.left, to.left) + EDGE
    const high = Math.min(from.right, to.right) - EDGE
    if (low <= high) {
      const inside = (one: number) => one >= low && one <= high
      const x = inside(to.x) ? to.x : inside(from.x) ? from.x : Math.min(Math.max(to.x, low), high)
      path += ` M ${x} ${from.y} L ${x} ${to.y} M ${to.x} ${to.y}`
    } else {
      const above = bounds.get(rows[index - 1]!)
      const below = bounds.get(rows[index]!)
      const middle = above && below ? (above.bottom + below.top) / 2 : (from.y + to.y) / 2
      path += ` L ${from.x} ${middle} L ${to.x} ${middle} L ${to.x} ${to.y}`
    }
  }
  return path
}

function Chapter({ index, level }: { index: number; level: number }) {
  const { t } = useI18n()
  const chapter = chapterOf(index)
  const { taken, busy, claim } = useContext(ClaimsContext)
  const [deny, setDeny] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [line, setLine] = useState<{ all: string; done: string; w: number; h: number }>({ all: '', done: '', w: 0, h: 0 })

  useLayoutEffect(() => {
    const node = box.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setWidth(node.clientWidth))
    setWidth(node.clientWidth)
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  const layout = layoutOf(width || 1)
  const { gap, unit } = layout
  const rows = width ? rowsFor(chapter.rewards, layout) : []

  useLayoutEffect(() => {
    const node = box.current
    if (!node || !width) return
    const blocks = [...node.querySelectorAll<HTMLElement>('[data-level]')]
    const centers = blocks
      .map((block) => {
        const row = block.parentElement!
        const left = row.offsetLeft + block.offsetLeft
        const top = row.offsetTop + block.offsetTop
        return { level: Number(block.dataset.level), row: Number(block.dataset.row), left, top, w: block.offsetWidth, h: block.offsetHeight }
      })
      .sort((one, two) => one.level - two.level)
    const points = centers.map((one) => ({
      x: one.left + one.w / 2,
      y: one.top + one.h / 2,
      left: one.left,
      right: one.left + one.w,
      top: one.top,
      bottom: one.top + one.h,
    }))
    const rowsOf = centers.map((one) => one.row)
    const bounds: Bounds = new Map()
    points.forEach((point, place) => {
      const row = rowsOf[place]!
      const known = bounds.get(row)
      bounds.set(row, known ? { top: Math.min(known.top, point.top), bottom: Math.max(known.bottom, point.bottom) } : { top: point.top, bottom: point.bottom })
    })
    const reached = centers.filter((one) => one.level <= level).length
    setLine({
      all: trail(points, rowsOf, bounds),
      done: reached > 1 ? trail(points.slice(0, reached), rowsOf.slice(0, reached), bounds) : '',
      w: node.offsetWidth,
      h: node.offsetHeight,
    })
  }, [width, level, rows.length])

  return (
    <section className={`lvmap-chapter tier-${chapter.tier}`}>
      <div className="lvmap-field" ref={box} style={{ '--unit': `${unit}px`, '--gap': `${gap}px` } as CSSProperties}>
        <svg className="lvmap-line" width={line.w} height={line.h} aria-hidden>
          <path className="is-all" d={line.all} />
          {line.done && <path className="is-done" d={line.done} />}
        </svg>
        {rows.map((row, place) => (
          <div key={place} className={`lvmap-row ${place % 2 ? 'is-back' : ''} ${place === rows.length - 1 ? 'is-last' : ''}`}>
            {row.map(({ reward, span }) => {
              const size = { w: span * unit + (span - 1) * gap, h: unit }
              const state = reward.level <= level ? 'is-open' : reward.level === level + 1 ? 'is-next' : ''
              const paid = reward.coins > 0 && reward.level <= level && taken !== null
              const got = paid && taken.has(reward.level)
              const ready = paid && !got
              return (
                <div
                  key={reward.level}
                  data-level={reward.level}
                  data-row={place}
                  className={`lvmap-block kind-${reward.kind} ${state} ${got ? 'is-taken' : ''} ${ready ? 'is-ready' : ''} ${busy === reward.level ? 'is-busy' : ''} ${deny === reward.level ? 'is-deny' : ''}`}
                  style={{ width: size.w, height: size.h } as CSSProperties}
                  title={ready ? t('levels.take') : got ? t('levels.gotIt') : t(`levels.kind.${reward.kind}` as UiKey)}
                  role={ready ? 'button' : undefined}
                  tabIndex={ready ? 0 : undefined}
                  onClick={() => (ready ? claim(reward.level) : setDeny(reward.level))}
                  onAnimationEnd={(event) => event.animationName === 'lvmap-deny' && setDeny(null)}
                  onKeyDown={ready ? (event) => (event.key === 'Enter' || event.key === ' ') && claim(reward.level) : undefined}
                >
                  {(reward.kind === 'coins' || reward.kind === 'pile') && (
                    <span className="lvmap-gold">
                      <GemIcon count={reward.kind === 'pile' ? 3 : 1} />
                      <b>{reward.coins}</b>
                    </span>
                  )}
                  <i className="lvmap-level">{reward.level}</i>
                  {state === 'is-next' && <em className="lvmap-here">{t('levels.here')}</em>}
                  {ready && <em className="lvmap-here is-take">{t('levels.take')}</em>}
                  {got && (
                    <span className="lvmap-got" aria-label={t('levels.gotIt')}>
                      <CheckIcon />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

const TURN = 360 / CHAPTERS
const SWIPE = 45
const SPREAD = 0.05
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const spin = (at: number) => ((at % CHAPTERS) + CHAPTERS) % CHAPTERS

function Door({ start, level }: { start: number; level: number }) {
  const { t } = useI18n()
  const [at, setAt] = useState(start)
  const touched = useRef(false)
  const [still, setStill] = useState(false)

  useEffect(() => {
    if (touched.current) return
    setStill(true)
    setAt(start)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setStill(false))
    })
    return () => cancelAnimationFrame(frame)
  }, [start])

  const turn = (next: (one: number) => number) => {
    touched.current = true
    setAt(next)
  }
  const [wide, setWide] = useState(0)
  const [tall, setTall] = useState(0)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!tall || settled) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setSettled(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [tall, settled])
  const stage = useRef<HTMLDivElement>(null)
  const door = useRef<HTMLDivElement>(null)
  const faces = useRef<(HTMLDivElement | null)[]>([])
  const grab = useRef<{ x: number; y: number } | null>(null)
  const current = spin(at)

  useLayoutEffect(() => {
    const node = door.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setWide(node.clientWidth))
    setWide(node.clientWidth)
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  useLayoutEffect(() => {
    const face = faces.current[current]
    if (!face || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setTall(face.offsetHeight))
    setTall(face.offsetHeight)
    watch.observe(face)
    return () => watch.disconnect()
  }, [current, wide])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft') turn((one) => one - 1)
      if (event.key === 'ArrowRight') turn((one) => one + 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const face = Math.round(wide * (wide < NARROW ? 0.92 : 0.8))
  const radius = face / 2 / Math.tan(Math.PI / CHAPTERS) + face * SPREAD
  const round = Math.round(Math.min(22, Math.max(12, layoutOf(Math.max(1, face - 40)).unit * 0.16)))

  const swipe = (x: number, y: number) => {
    const from = grab.current
    grab.current = null
    if (!from) return
    const dx = x - from.x
    const dy = y - from.y
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.2) turn((one) => one + (dx < 0 ? 1 : -1))
  }

  const swipeRef = useRef(swipe)
  swipeRef.current = swipe

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const start = (event: TouchEvent) => {
      const touch = event.touches[0]
      grab.current = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null
    }
    const end = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (touch) swipeRef.current(touch.clientX, touch.clientY)
    }
    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchend', end, { passive: true })
    return () => {
      node.removeEventListener('touchstart', start)
      node.removeEventListener('touchend', end)
    }
  }, [])

  const jump = (index: number) => {
    let step = index - current
    if (step > CHAPTERS / 2) step -= CHAPTERS
    if (step < -CHAPTERS / 2) step += CHAPTERS
    turn((one) => one + step)
  }

  return (
    <div className="lvmap-door" ref={door} style={{ '--round': `${round}px`, '--face': `${face}px` } as CSSProperties}>
      <div className={`lvmap-strip tier-${chapterOf(current).tier}`}>
        <div className="lvmap-nums" role="tablist">
          {Array.from({ length: CHAPTERS }, (_, index) => {
            const part = chapterOf(index)
            return [
              index > 0 && <i key={`link-${index}`} className={`lvmap-link tier-${chapterOf(index - 1).tier} ${level >= part.from ? 'is-done' : ''}`} aria-hidden />,
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === current}
                className={`lvmap-num tier-${part.tier} ${index === current ? 'is-on' : ''} ${level >= part.to ? 'is-done' : ''}`}
                aria-label={t('levels.chapter', { n: index + 1 })}
                onClick={() => jump(index)}
              >
                {ROMAN[index]}
              </button>,
            ]
          })}
        </div>
        <p className="lvmap-caption" aria-live="polite">
          <b>{t('levels.chapter', { n: current + 1 })}</b> · {t('levels.range', { from: chapterOf(current).from, to: chapterOf(current).to })}
        </p>
      </div>
      <div
        className={`lvmap-stage ${settled ? 'is-settled' : ''}`}
        ref={stage}
        style={{ height: tall || undefined } as CSSProperties}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') grab.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') swipe(event.clientX, event.clientY)
        }}
        onPointerCancel={() => {
          grab.current = null
        }}
      >
        {wide > 0 && (
          <div
            className={`lvmap-ring ${still ? 'is-still' : ''}`}
            style={{ width: face, marginLeft: -face / 2, transform: `translateZ(${-radius}px) rotateY(${-at * TURN}deg)` }}
          >
            {Array.from({ length: CHAPTERS }, (_, index) => {
              const away = Math.min((index - current + CHAPTERS) % CHAPTERS, (current - index + CHAPTERS) % CHAPTERS)
              return (
                <div
                  key={index}
                  ref={(node) => {
                    faces.current[index] = node
                  }}
                  className={`lvmap-face ${away === 0 ? 'is-on' : away === 1 ? 'is-near' : 'is-far'} ${(index - current + CHAPTERS) % CHAPTERS === 1 ? 'is-right' : (current - index + CHAPTERS) % CHAPTERS === 1 ? 'is-left' : ''}`}
                  style={{ transform: `rotateY(${index * TURN}deg) translateZ(${radius}px)`, height: away === 0 ? undefined : tall || undefined }}
                  aria-hidden={away !== 0}
                  onClick={away === 1 ? () => jump(index) : undefined}
                >
                  <span className={`lvmap-glass tier-${chapterOf(index).tier}`} aria-hidden />
                  <div className="lvmap-face-real">
                    <Chapter index={index} level={level} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Levels() {
  const { t } = useI18n()
  const href = useHref()
  const { user, refresh } = useAuth()
  const now = levelAt(user?.xp ?? 0)
  const [taken, setTaken] = useState<Set<number> | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    void api<{ taken: number[] }>('levels').then(({ ok, data }) => ok && setTaken(new Set(data.taken)))
  }, [user?.id])

  const take = useCallback(
    async (body: { level: number }, mark: number) => {
      if (busy !== null) return
      setBusy(mark)
      const { ok, data } = await api<{ taken: number[] }>('levels/claim', body)
      setBusy(null)
      if (!ok) return
      setTaken(new Set(data.taken))
      void refresh()
    },
    [busy, refresh],
  )

  const claim = useCallback((level: number) => void take({ level }, level), [take])


  return (
    <div className="lvmap">
      <div className="lvmap-top">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      </div>
      <header className="lvmap-title">
        <h1>{t('levels.title')}</h1>
        <p className="muted">{t('levels.toNext', { into: now.into, need: now.need, level: now.level + 1 })}</p>
      </header>
      <ClaimsContext.Provider value={{ taken, busy, claim }}>
        <Door start={Math.min(CHAPTERS - 1, Math.floor((now.level - 1) / CHAPTER))} level={now.level} />
      </ClaimsContext.Provider>
    </div>
  )
}
