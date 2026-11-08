'use client'

import Link from 'next/link'
import { Fragment, memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import BackButton from './BackButton'
import { api } from './api'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { Entity, GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { CloseIcon, FilterIcon, PinIcon, SearchIcon } from './icons'
import { MODES } from './modes'
import { CARD_DAILY_FACTOR, CARD_MAX_LEVEL, CARD_PINS_MAX, CARD_POINTS, CARD_RARITIES, CARD_STEPS, cardRank, type ModeId } from '@nanda/game'
import { PICTURELESS, cardUrl, hdUrl, miniUrl } from './pics'
import { entityTerms, matchTier, searchKey } from './entity-match'
import { useHref } from './router'
import { random, torn, tornPoints } from './torn'

const SHORT: Record<string, { ru: string; uk: string; en: string }> = {
  'naruto:195': { ru: 'Демон. Статуя Внешнего Пути', uk: 'Демон. Статуя Зовнішнього Шляху', en: 'Statue of the Outer Path' },
}

const lengthOf = (label: string) => (label.length > 26 ? 'is-longer' : label.length > 16 ? 'is-long' : '')

const tilt = (id: number) => (((id * 7919) % 9) - 4) * 0.55

type Point = [number, number]
type Shape = Point[]

const cubic = (a: Point, b: Point, c: Point, d: Point, steps = 48): Point[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const u = 1 - t
    return [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]
  })

const quad = (a: Point, b: Point, c: Point, steps = 8): Point[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const u = 1 - t
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]
  })

const tangent = (points: Point[], index: number): Point => {
  const ahead = points[Math.min(index + 1, points.length - 1)]
  const behind = points[Math.max(index - 1, 0)]
  const length = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]) || 1
  return [(ahead[0] - behind[0]) / length, (ahead[1] - behind[1]) / length]
}

const wave = (next: () => number) => {
  const slow = next() * Math.PI * 2
  const fast = next() * Math.PI * 2
  const slowRate = 2 + next() * 2
  const fastRate = 7 + next() * 5
  return (t: number) => 0.84 + 0.11 * Math.sin(t * slowRate * Math.PI * 2 + slow) + 0.07 * Math.sin(t * fastRate * Math.PI * 2 + fast)
}

const breaks = (spots: [number, number][]) => (t: number) =>
  spots.reduce((left, [at, radius]) => {
    const distance = Math.abs(t - at)
    return distance < radius ? 0 : left * Math.pow(Math.min(1, (distance - radius) / radius), 0.3)
  }, 1)

const drift = (count: number, rough: number, next: () => number) => {
  const knots = Math.max(2, Math.ceil(count / 7))
  const marks = Array.from({ length: knots + 1 }, () => (next() - 0.5) * rough * 2)
  return (index: number) => {
    const at = (index / Math.max(1, count - 1)) * knots
    const low = Math.min(knots - 1, Math.floor(at))
    const blend = at - low
    const ease = blend * blend * (3 - 2 * blend)
    return marks[low] + (marks[low + 1] - marks[low]) * ease
  }
}

const ribbon = (points: Point[], width: (t: number) => number, next: () => number, rough = 0.22): Shape => {
  const shape = wave(next)
  const nearSide = drift(points.length, rough, next)
  const farSide = drift(points.length, rough, next)
  const left: Point[] = []
  const right: Point[] = []
  points.forEach((point, index) => {
    const [dx, dy] = tangent(points, index)
    const t = index / (points.length - 1)
    const half = width(t) * shape(t)
    const nick = next() < 0.02 ? 0.6 : 1
    const near = half * (1 + nearSide(index)) * nick
    const far = half * (1 + farSide(index)) * (nick < 1 ? 1 : next() < 0.02 ? 0.6 : 1)
    left.push([point[0] - dy * near, point[1] + dx * near])
    right.push([point[0] + dy * far, point[1] - dx * far])
  })
  return [...left, ...right.reverse()]
}

const bristles = (points: Point[], upto: number, gap: number, width: number, next: () => number): Shape[] => {
  const part = points.slice(0, Math.max(3, Math.round(points.length * upto)))
  return [1, -1].map((side) => {
    const shifted = part.map((point, index): Point => {
      const [dx, dy] = tangent(part, index)
      const push = gap * side * (1 - (index / (part.length - 1)) * 0.6)
      return [point[0] - dy * push, point[1] + dx * push]
    })
    return ribbon(shifted, (t) => width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.5), next, 0.35)
  })
}

const thorn = (points: Point[], at: number, size: number, side: 1 | -1, next: () => number): Shape => {
  const index = Math.round(at * (points.length - 1))
  const [px, py] = points[index]
  const [ux, uy] = tangent(points, index)
  const nx = -uy * side
  const ny = ux * side
  const length = size * (0.85 + next() * 0.3)
  const hook = 0.38 + next() * 0.22
  const spot = (along: number, out: number): Point => [px + ux * along * length + nx * out * length, py + uy * along * length + ny * out * length]
  const back = spot(-0.62, -0.02)
  const tip = spot(hook, 1)
  const front = spot(0.24, -0.02)
  return [...cubic(back, spot(-0.2, 0.04), spot(0.02, 0.5), tip, 14), ...cubic(tip, spot(hook - 0.06, 0.62), spot(0.22, 0.2), front, 12).slice(1)]
}

const blot = (cx: number, cy: number, radius: number, next: () => number): Shape =>
  Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 9) * Math.PI * 2
    const r = radius * (0.7 + next() * 0.5)
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
  })

const fade =
  (start: number, end: number, power = 1.1) =>
  (t: number) =>
    end + (start - end) * Math.pow(1 - t, power)
const swell =
  (peak: number, floor = 0.2, power = 0.7) =>
  (t: number) =>
    floor + peak * Math.pow(Math.sin(Math.PI * t), power)

const CORNER = (() => {
  const next = random(41)
  const across = cubic([12, 14], [70, 9], [140, 17], [200, 15], 180)
  const down = cubic([14, 12], [9, 60], [17, 110], [15, 160], 150)
  const curl = [...cubic([16, 16], [64, 22], [68, 68], [42, 66], 90), ...cubic([42, 66], [24, 65], [26, 42], [43, 45], 60).slice(1)]
  const innerAcross = cubic([36, 32], [70, 30], [110, 35], [152, 33], 110)
  const innerDown = cubic([32, 36], [30, 70], [35, 100], [33, 126], 90)
  const main = fade(5.6, 0.4)
  const ink: Shape[] = [
    ribbon(across, main, next),
    ribbon(down, main, next),
    ...bristles(across.slice(46), 0.4, 6.5, 0.9, next),
    ...bristles(down.slice(38), 0.4, 6.5, 0.9, next),
    ribbon(curl, (t) => fade(3.6, 0.4, 0.9)(t) * breaks([[0.55, 0.035]])(t), next),
    ribbon(innerAcross, (t) => swell(1.6)(t) * breaks([[0.6, 0.06]])(t), next),
    ribbon(innerDown, (t) => swell(1.6)(t) * breaks([[0.5, 0.07]])(t), next),
    thorn(across, 0.15, 18, -1, next),
    thorn(across, 0.31, 14, -1, next),
    thorn(across, 0.47, 10, -1, next),
    thorn(across, 0.6, 7.5, -1, next),
    thorn(across, 0.76, 5, -1, next),
    thorn(down, 0.17, 18, 1, next),
    thorn(down, 0.34, 14, 1, next),
    thorn(down, 0.5, 10, 1, next),
    thorn(down, 0.64, 7.5, 1, next),
    thorn(down, 0.8, 5, 1, next),
    thorn(innerAcross, 0.32, 6.5, 1, next),
    thorn(innerDown, 0.76, 6.5, -1, next),
    [...quad([9, 22], [3, 3], [-2, -2]), ...quad([-2, -2], [3, 3], [22, 9]).slice(1)],
    blot(84, 46, 2.2, next),
    blot(96, 54, 1.2, next),
    blot(58, 92, 1.6, next),
  ]
  const seat: Shape[] = [
    [
      [44.5, 44.6],
      [51.4, 53],
      [44.5, 61.4],
      [37.6, 53],
    ],
  ]
  const accent: Shape[] = [
    [
      [44.5, 46.5],
      [49.5, 53],
      [44.5, 59.5],
      [39.5, 53],
    ],
    blot(70, 66, 2, next),
  ]
  const shine: Shape[] = [
    [
      [44.5, 46.5],
      [44.5, 53],
      [39.5, 53],
    ],
  ]
  return { ink, seat, accent, shine }
})()

const KNOT = (() => {
  const next = random(7)
  const flick = (points: Point[], start: number) => ribbon(points, fade(start, 0.25), next, 0.3)
  return {
    ink: [
      flick(cubic([31, 12], [24, 3], [12, 3], [1, 12]), 2.4),
      flick(cubic([49, 12], [56, 3], [68, 3], [79, 12]), 2.4),
      flick(cubic([31, 12], [24, 20], [16, 20], [9, 15]), 1.6),
      flick(cubic([49, 12], [56, 20], [64, 20], [71, 15]), 1.6),
      [
        [40, 1.5],
        [49.5, 12],
        [40, 22.5],
        [30.5, 12],
      ] as Shape,
    ],
    seat: [
      [
        [40, 5.4],
        [46.6, 12],
        [40, 18.6],
        [33.4, 12],
      ] as Shape,
    ],
    accent: [
      [
        [40, 7],
        [45, 12],
        [40, 17],
        [35, 12],
      ] as Shape,
    ],
    shine: [
      [
        [40, 7],
        [40, 12],
        [35, 12],
      ] as Shape,
    ],
  }
})()

const fiber = (tip: Point, along: Point, side: Point, next: () => number): Shape => {
  const reach = 3 + next() * 7
  const lean = (next() - 0.5) * 2.4
  const points = Array.from({ length: 7 }, (_, step): Point => {
    const t = step / 6
    return [tip[0] + along[0] * reach * t + side[0] * lean * t, tip[1] + along[1] * reach * t + side[1] * lean * t]
  })
  return ribbon(points, (t) => (0.35 + next() * 0.45) * (1 - t * 0.85), next, 0.2)
}

const line = (from: Point, to: Point, seed: number, outward: 1 | -1, most: number, gap: [number, number]) => {
  const next = random(seed)
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  const ux = (to[0] - from[0]) / length
  const uy = (to[1] - from[1]) / length
  const half = length / 2
  const lanes = most > 1 && length > 700 ? [0, 1] : length > 360 ? [next() < 0.5 ? 0 : 1] : []
  const holes = lanes
    .map((lane) => {
      const low = lane ? half + 100 : 90
      const high = lane ? length - 90 : half - 100
      return high > low ? { at: low + next() * (high - low), gap: gap[0] + next() * (gap[1] - gap[0]) } : null
    })
    .filter((hole): hole is { at: number; gap: number } => hole !== null)
  const pieces: [number, number][] = []
  let start = 0
  holes.forEach((hole) => {
    pieces.push([start, hole.at - hole.gap / 2])
    start = hole.at + hole.gap / 2
  })
  pieces.push([start, length])
  const phase = next() * 6
  const shapes: Shape[] = []
  let shift = 0
  const quiet = [half - 70, half + 70]
  pieces.forEach(([begin, end], index) => {
    if (index) shift = (next() - 0.5) * 2.4
    const steps = Math.max(4, Math.round((end - begin) / 3))
    const at = (along: number): Point => {
      const sway = Math.sin(along * 0.012 + phase) * 0.7 + shift
      return [from[0] + ux * along - uy * sway, from[1] + uy * along + ux * sway]
    }
    const points = Array.from({ length: steps + 1 }, (_, step) => at(begin + ((end - begin) * step) / steps))
    const span = end - begin
    const tornStart = index > 0
    const tornEnd = index < pieces.length - 1
    const width = (t: number) => {
      const along = begin + t * span
      const outer = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, along / length))), 0.22)
      const head = tornStart ? Math.min(1, (t * span) / 1.6) : 1
      const tail = tornEnd ? Math.min(1, ((1 - t) * span) / 1.6) : 1
      return 2.3 * outer * Math.max(0.35, Math.min(head, tail)) * (head < 1 || tail < 1 ? 0.6 + next() * 0.8 : 1)
    }
    shapes.push(ribbon(points, width, next, 0.3))
    const side: Point = [-uy, ux]
    if (tornStart) for (let i = 0; i < 3; i++) shapes.push(fiber(at(begin + 0.5), [-ux, -uy], side, next))
    if (tornEnd) for (let i = 0; i < 3; i++) shapes.push(fiber(at(end - 0.5), [ux, uy], side, next))
    const grow = (spot: number, size: number, side: 1 | -1) => {
      if (spot < begin + 12 || spot > end - 12 || (spot > quiet[0] - 24 && spot < quiet[1] + 24)) return
      shapes.push(thorn(points, (spot - begin) / span, size, side, next))
    }
    for (let spot = begin + 20 + next() * 50; spot < end - 12;) {
      const roll = next()
      const count = roll < 0.45 ? 1 : roll < 0.82 ? 2 : 3
      let side: 1 | -1 = next() < 0.68 ? outward : outward === 1 ? -1 : 1
      let reach = spot
      for (let i = 0; i < count; i++) {
        grow(reach, (i ? 6.5 : 9) + next() * 6, side)
        side = side === 1 ? -1 : 1
        reach += 7 + next() * 9
      }
      const rest = 60 + next() * 120
      if (next() < 0.5) grow(reach + rest * (0.35 + next() * 0.3), 3.5 + next() * 2, next() < 0.5 ? 1 : -1)
      spot = reach + rest
    }
  })
  return shapes
}

const svgPath = (shape: Shape) => `M${shape.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`

const drawFrame = (width: number, height: number) => {
  const inset = 6
  const size = Math.min(220, Math.max(120, width * 0.19))
  const k = size / 200
  const ink: string[] = []
  const seat: string[] = []
  const accent: string[] = []
  const shine: string[] = []
  const place = (shapes: Shape[], into: string[], map: (point: Point) => Point) => shapes.forEach((shape) => into.push(svgPath(shape.map(map))))
  const corners: [boolean, boolean][] = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]
  corners.forEach(([right, bottom]) => {
    const map = ([x, y]: Point): Point => [right ? width - inset - x * k : inset + x * k, bottom ? height - inset - y * k : inset + y * k]
    place(CORNER.ink, ink, map)
    place(CORNER.seat, seat, map)
    place(CORNER.accent, accent, map)
    place(CORNER.shine, shine, map)
  })
  const rail = inset + 15 * k
  const startX = inset + size * 0.78
  const startY = inset + size * 0.64
  if (width - startX * 2 > 60) {
    line([startX, rail], [width - startX, rail], 11, -1, 1, [24, 36]).forEach((shape) => ink.push(svgPath(shape)))
    line([width - startX, height - rail], [startX, height - rail], 13, -1, 1, [24, 36]).forEach((shape) => ink.push(svgPath(shape)))
  }
  if (height - startY * 2 > 60) {
    line([rail, height - startY], [rail, startY], 17, -1, 2, [40, 60]).forEach((shape) => ink.push(svgPath(shape)))
    line([width - rail, startY], [width - rail, height - startY], 19, -1, 2, [40, 60]).forEach((shape) => ink.push(svgPath(shape)))
  }
  const knots: [number, number, boolean][] = [
    [width / 2, rail, false],
    [width / 2, height - rail, false],
    [rail, height / 2, true],
    [width - rail, height / 2, true],
  ]
  knots.forEach(([cx, cy, upright]) => {
    const map = ([x, y]: Point): Point => (upright ? [cx + (y - 12), cy + (x - 40)] : [cx + (x - 40), cy + (y - 12)])
    place(KNOT.ink, ink, map)
    place(KNOT.seat, seat, map)
    place(KNOT.accent, accent, map)
    place(KNOT.shine, shine, map)
  })
  return { ink, seat, accent, shine }
}

const InkFrame = () => {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number] | null>(null)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const watch = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((last) => (last && last[0] === Math.round(width) && last[1] === Math.round(height) ? last : [Math.round(width), Math.round(height)]))
    })
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  const art = useMemo(() => (size ? drawFrame(size[0], size[1]) : null), [size])

  return (
    <div ref={box} className="dex-ink" aria-hidden>
      {art && size && (
        <svg viewBox={`0 0 ${size[0]} ${size[1]}`} width={size[0]} height={size[1]}>
          {art.ink.map((d, index) => (
            <path key={index} d={d} />
          ))}
          {art.seat.map((d, index) => (
            <path key={`s${index}`} d={d} className="is-seat" />
          ))}
          {art.accent.map((d, index) => (
            <path key={`a${index}`} d={d} className="is-accent" />
          ))}
          {art.shine.map((d, index) => (
            <path key={`h${index}`} d={d} className="is-shine" />
          ))}
        </svg>
      )}
    </div>
  )
}

type Focus = { entity: Entity; node: HTMLElement; from: DOMRect; hovered: boolean; tilt: number; type: number; lines: string[] }

const linesOf = (span: HTMLElement | null) => {
  const text = span?.firstChild
  if (!span || !text || text.nodeType !== Node.TEXT_NODE) return []
  const value = text.textContent ?? ''
  const range = document.createRange()
  const lines: string[] = []
  let top = Number.NaN
  let from = 0
  value.split(' ').forEach((word, index, all) => {
    const at = all.slice(0, index).join(' ').length + (index ? 1 : 0)
    range.setStart(text, at)
    range.setEnd(text, at + Math.max(1, word.length))
    const y = range.getBoundingClientRect().top
    if (index && Math.abs(y - top) > 2) {
      lines.push(value.slice(from, at).trim())
      from = at
    }
    top = index ? (Math.abs(y - top) > 2 ? y : top) : y
  })
  lines.push(value.slice(from).trim())
  return lines
}

const lift = (entity: Entity, node: HTMLElement): Focus => {
  const from = node.getBoundingClientRect()
  const name = node.querySelector('b')
  const size = name ? parseFloat(getComputedStyle(name).fontSize) : 13
  return {
    entity,
    node,
    from,
    hovered: node.matches(':hover'),
    tilt: tilt(entity.id),
    type: (size / Math.max(1, node.offsetWidth)) * 100,
    lines: linesOf(node.querySelector('b span')),
  }
}

const BACK_POINTS = tornPoints(24, 5)
  .map(([x, y]) => `${(x * 3).toFixed(1)},${(y * 4).toFixed(1)}`)
  .join(' ')

const BACK_CLIP = torn(24, 5)

const HALO_PX = [0, 0, 5, 6.5, 8, 10.5, 12]

const UNIT = 2.4

const CardGlow = ({ seed, tier, turn }: { seed: number; tier?: number; turn: number }) => {
  const id = useId()
  const paper = tornPoints(seed, 4)
    .map(([x, y]) => `${(x * 3).toFixed(1)},${(y * 4).toFixed(1)}`)
    .join(' ')
  const halo = (tier ? HALO_PX[tier]! : 0) * UNIT
  const drop = 6 * UNIT
  const shapes = (
    <>
      {tier && tier > 1 && <polygon points={BACK_POINTS} transform={`rotate(${turn} 150 200) translate(12 8)`} />}
      <polygon points={paper} />
    </>
  )
  return (
    <svg className="card-glow" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
      <defs>
        <filter id={`${id}halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={halo / 2} />
        </filter>
        <filter id={`${id}shade`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={4 * UNIT} />
        </filter>
      </defs>
      {halo > 0 && (
        <g className="card-glow-halo" filter={`url(#${id}halo)`}>
          {shapes}
          <g transform={`translate(0 ${drop})`} opacity={0.55}>
            {shapes}
          </g>
        </g>
      )}
      <g className="card-glow-shade" filter={`url(#${id}shade)`} transform={`translate(0 ${drop})`}>
        {shapes}
      </g>
    </svg>
  )
}

const CHIP_POINTS = tornPoints(24, 7, 6)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

const SEARCH_POINTS = tornPoints(57, 3, 9)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

type TileProps = {
  entity: Entity
  game: GameId
  place: number
  state: 'open' | 'text' | 'locked'
  pictures: boolean
  label: string
  tier: number
  lifted: boolean
  lockedLabel: string
  onOpen: (focus: Focus) => void
}

const DexTile = memo(function DexTile({ entity, game, place, state, pictures, label, tier, lifted, lockedLabel, onOpen }: TileProps) {
  if (state === 'text')
    return (
      <span className="dex-scrap is-text">
        <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
        <b>
          <span>{label}</span>
        </b>
      </span>
    )
  if (state === 'locked')
    return (
      <span className="dex-scrap is-locked" aria-label={lockedLabel}>
        <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
        {pictures && (
          <span className="dex-pic is-fog" style={{ clipPath: torn(entity.id * 3 + 1, 3, 7) }}>
            <DexImg src={miniUrl(game, entity.id, entity.image)} />
          </span>
        )}
        <em aria-hidden>?</em>
        <small>№ {place + 1}</small>
      </span>
    )
  return (
    <button
      type="button"
      className={`dex-scrap ${lifted ? 'is-lifted' : ''} ${tier ? `lv-${tier + 1}` : ''}`}
      onPointerDown={() => {
        new Image().src = hdUrl(game, entity.id, entity.image)
      }}
      onClick={(event) => onOpen(lift(entity, event.currentTarget))}
    >
      {tier > 0 && <CardGlow seed={entity.id} tier={tier + 1} turn={BACK_TURN} />}
      {tier > 0 && <BackSheet />}
      <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
      <span className="dex-pic" style={{ clipPath: torn(entity.id * 3 + 1, 3, 7) }}>
        <DexImg src={cardUrl(game, entity.id, entity.image)} />
        <PicEdge seed={entity.id * 3 + 1} />
      </span>
      <b className={lengthOf(label)}>
        <span>{label}</span>
      </b>
    </button>
  )
})

const RarityChip = ({ tier, count, on, step, onToggle }: { tier: number; count: number; on: boolean; step: number; onToggle: () => void }) => {
  const { t } = useI18n()
  const id = useId()
  const name = t(`card.rarity.${CARD_RARITIES[tier]}` as UiKey)
  return (
    <button
      type="button"
      className={`dex-rarity lv-${tier + 1} ${on ? 'is-on' : ''}`}
      style={{ '--step': step } as CSSProperties}
      aria-pressed={on}
      aria-label={`${name} ${count}`}
      title={name}
      onClick={onToggle}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="dex-rarity-top" />
            <stop offset="100%" className="dex-rarity-bottom" />
          </linearGradient>
        </defs>
        <polygon points={CHIP_POINTS} fill={`url(#${id})`} vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden>{name}</span>
      <b aria-hidden>{count}</b>
    </button>
  )
}

const DexImg = ({ src }: { src: string }) => {
  const [shown, setShown] = useState(false)
  const check = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth) setShown(true)
  }, [])
  return <img ref={check} className={shown ? 'is-in' : ''} src={src} alt="" loading="lazy" decoding="async" draggable={false} onLoad={() => setShown(true)} />
}

const PicEdge = ({ seed }: { seed: number }) => {
  const points = tornPoints(seed, 3, 7)
    .map(([x, y]) => `${(x * 2.58).toFixed(1)},${(y * 2.88).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="dex-pic-edge" viewBox="0 0 258 288" preserveAspectRatio="none" aria-hidden>
      <polygon points={points} className="is-soft" />
      <polygon points={points} />
    </svg>
  )
}

const SHEET_POINTS = tornPoints(31, 2.5, 8)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

const BADGE_POINTS = tornPoints(7, 9, 5)
  .map(([x, y]) => `${(x * 1.3).toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

const BACK_TURN = 7

const BackSheet = ({ turn = BACK_TURN }: { turn?: number }) => {
  const id = useId()
  const points = BACK_POINTS
  return (
    <i className="lv-back" style={{ '--turn': `${turn}deg` } as CSSProperties}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id={id} cx="50%" cy="0%" r="110%">
            <stop offset="0%" className="lv-back-top" />
            <stop offset="78%" className="lv-back-bottom" />
          </radialGradient>
          <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={3 * UNIT} />
          </filter>
        </defs>
        <polygon className="lv-back-glow" points={points} filter={`url(#${id}glow)`} />
        <polygon points={points} fill={`url(#${id})`} />
      </svg>
      <i className="lv-back-light" style={{ clipPath: BACK_CLIP }} />
    </i>
  )
}

const MOVE_MS = 480
const MOVE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TILT_X = 22
const TILT_Y = 28
const DRAG_PX = 6

type Tilt = { x: number; y: number; vx: number; vy: number }

const useTilt = (face: React.RefObject<HTMLDivElement | null>, ready: () => boolean) => {
  const aim = useRef({ x: 0, y: 0 })
  const state = useRef<Tilt>({ x: 0, y: 0, vx: 0, vy: 0 })
  const dragged = useRef(false)
  const wake = useRef(() => {})

  useEffect(() => {
    const node = face.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let last = 0
    let grab: { id: number; x: number; y: number; width: number; height: number } | null = null

    const paint = (one: Tilt) => {
      const reach = Math.min(1, Math.hypot(one.x / TILT_X, one.y / TILT_Y))
      node.style.setProperty('--rx', `${one.x.toFixed(2)}deg`)
      node.style.setProperty('--ry', `${one.y.toFixed(2)}deg`)
      node.style.setProperty('--gx', `${(50 + (one.y / TILT_Y) * 45).toFixed(1)}%`)
      node.style.setProperty('--gy', `${(50 - (one.x / TILT_X) * 45).toFixed(1)}%`)
      node.style.setProperty('--glow', (reach * 0.75).toFixed(3))
      node.style.setProperty('--sx', (one.y / TILT_Y).toFixed(3))
      node.style.setProperty('--sy', (one.x / TILT_X).toFixed(3))
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const one = state.current
      const stiff = grab ? 260 : 90
      const damp = grab ? 24 : 9
      one.vx += ((aim.current.x - one.x) * stiff - one.vx * damp) * dt
      one.vy += ((aim.current.y - one.y) * stiff - one.vy * damp) * dt
      one.x += one.vx * dt
      one.y += one.vy * dt
      const settled = !grab && Math.abs(one.x - aim.current.x) + Math.abs(one.y - aim.current.y) < 0.02 && Math.abs(one.vx) + Math.abs(one.vy) < 0.05
      if (settled) {
        state.current = { x: aim.current.x, y: aim.current.y, vx: 0, vy: 0 }
        paint(state.current)
        frame = 0
        return
      }
      paint(one)
      frame = requestAnimationFrame(step)
    }

    wake.current = () => {
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(step)
    }

    const down = (event: PointerEvent) => {
      if (!ready() || (event.target as Element).closest('.lv-badge, .dex-zoom-pin')) return
      const box = node.getBoundingClientRect()
      grab = { id: event.pointerId, x: event.clientX, y: event.clientY, width: box.width, height: box.height }
      dragged.current = false
      node.setPointerCapture(event.pointerId)
      node.classList.add('is-held')
      wake.current()
    }
    const move = (event: PointerEvent) => {
      if (!grab || event.pointerId !== grab.id) return
      const dx = event.clientX - grab.x
      const dy = event.clientY - grab.y
      if (Math.hypot(dx, dy) > DRAG_PX) dragged.current = true
      const nx = Math.max(-1, Math.min(1, dx / (grab.width * 0.6)))
      const ny = Math.max(-1, Math.min(1, dy / (grab.height * 0.6)))
      aim.current = { x: -ny * TILT_X, y: nx * TILT_Y }
    }
    const up = (event: PointerEvent) => {
      if (!grab || event.pointerId !== grab.id) return
      grab = null
      aim.current = { x: 0, y: 0 }
      node.classList.remove('is-held')
      wake.current()
      window.setTimeout(() => {
        dragged.current = false
      }, 0)
    }

    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(frame)
      wake.current = () => {}
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
  }, [face, ready])

  const rest = useCallback(() => {
    aim.current = { x: 0, y: 0 }
    wake.current()
  }, [])

  return { dragged, rest }
}

type CardStats = { xp: number; modes: Record<string, { n: number; xp: number }> }

type Rank = ReturnType<typeof cardRank> & { modes: CardStats['modes'] }

const rankOf = (stats?: CardStats): Rank => ({ ...cardRank(stats?.xp ?? 0), modes: stats?.modes ?? {} })

const DexTip = ({ glyph, label, tone, children }: { glyph: string; label: string; tone?: string; children: ReactNode }) => {
  const { t } = useI18n()
  const [state, setState] = useState<'in' | 'out' | null>(null)
  const [spot, setSpot] = useState({ left: 0, origin: 20, width: 360 })
  const box = useRef<HTMLDivElement>(null)
  const hide = useCallback(() => setState((was) => (was ? 'out' : null)), [])

  const show = () => {
    const button = box.current?.firstElementChild?.getBoundingClientRect()
    const frame = box.current?.parentElement?.getBoundingClientRect()
    const page = box.current?.closest('.dex-head')?.getBoundingClientRect()
    if (button && frame && page) {
      const inset = frame.left - page.left
      const width = Math.min(360, page.width - inset * 2)
      const wanted = button.left - frame.left - 18
      const left = Math.max(0, Math.min(wanted, page.right - inset - width - frame.left))
      setSpot({ left, origin: button.left - frame.left + button.width / 2 - left, width })
    }
    setState('in')
  }

  useEffect(() => {
    if (state !== 'in') return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) hide()
    }
    const key = (event: KeyboardEvent) => event.key === 'Escape' && hide()
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [state, hide])

  useEffect(() => {
    if (state !== 'out') return
    const timer = window.setTimeout(() => setState(null), 240)
    return () => window.clearTimeout(timer)
  }, [state])

  return (
    <div ref={box} className={`dex-help-box ${tone ?? ''}`}>
      <button
        type="button"
        className={`dex-help-toggle ${state === 'in' ? 'is-open' : ''}`}
        aria-expanded={state === 'in'}
        aria-label={label}
        title={label}
        onClick={() => (state === 'in' ? hide() : show())}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={CHIP_POINTS} vectorEffect="non-scaling-stroke" />
        </svg>
        <b aria-hidden>{glyph}</b>
      </button>
      {state && (
        <div
          className={`dex-help ${state === 'out' ? 'is-out' : ''}`}
          role="dialog"
          aria-label={label}
          style={{ left: spot.left, width: spot.width, transformOrigin: `${spot.origin}px -12px` } as CSSProperties}
        >
          <svg className="dex-help-paper" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={SHEET_POINTS} vectorEffect="non-scaling-stroke" />
          </svg>
          <button type="button" className="lv-sheet-x" aria-label={t('dex.close')} onClick={hide}>
            <CloseIcon />
          </button>
          <b className="dex-help-title">{label}</b>
          {children}
        </div>
      )}
    </div>
  )
}

const DexSoon = () => {
  const { t } = useI18n()
  return (
    <DexTip glyph="!" label={t('dex.soonTitle')} tone="is-soon">
      <p>{t('dex.soon', { max: CARD_MAX_LEVEL })}</p>
    </DexTip>
  )
}

const DexHelp = ({ modes }: { modes: ModeId[] }) => {
  const { t } = useI18n()
  const groups = [...new Set(modes.map((mode) => CARD_POINTS[mode] ?? 0))]
    .filter((points) => points > 0)
    .sort((a, b) => b - a)
    .map((points) => ({
      points,
      names: MODES.filter((mode) => modes.includes(mode.id) && CARD_POINTS[mode.id] === points).map((mode) => t(mode.label)),
    }))

  return (
    <DexTip glyph="?" label={t('dex.help')}>
          <p>{t('dex.help.open')}</p>
          <span className="dex-help-label">{t('dex.help.points')}</span>
          <ul className="dex-help-points">
            {groups.map((group) => (
              <li key={group.points}>
                <b>{group.points}</b>
                <span>{group.names.join(', ')}</span>
              </li>
            ))}
          </ul>
          <p className="dex-help-note">{t('dex.help.daily', { factor: CARD_DAILY_FACTOR })}</p>
          <span className="dex-help-label">{t('dex.help.rarity', { max: CARD_MAX_LEVEL })}</span>
          <ul className="dex-help-rarities">
            {CARD_STEPS.map((step, tier) => (
              <li key={tier} className={`lv-${tier + 1}`}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polygon points={CHIP_POINTS} vectorEffect="non-scaling-stroke" />
                </svg>
                <span>{t(`card.rarity.${CARD_RARITIES[tier]}` as UiKey)}</span>
                <em>{step.level}</em>
              </li>
            ))}
          </ul>
          <p className="dex-help-note">{t('dex.help.tap')}</p>
    </DexTip>
  )
}

export const ShowcaseCard = memo(function ShowcaseCard({
  game,
  id,
  image,
  label,
  xp,
  level,
}: {
  game: GameId
  id: number
  image?: string
  label: string
  xp: number
  level?: number
}) {
  const rank = cardRank(xp)
  const tier = level === 0 ? 0 : rank.tier
  return (
    <span className={`dex-scrap ${tier ? `lv-${tier + 1}` : ''} ${level === 0 ? 'is-closed' : ''}`}>
      {tier > 0 && <CardGlow seed={id} tier={tier + 1} turn={BACK_TURN} />}
      {tier > 0 && <BackSheet />}
      <i className="dex-paper" style={{ clipPath: torn(id, 4) }} />
      <span className="dex-pic" style={{ clipPath: torn(id * 3 + 1, 3, 7) }}>
        <DexImg src={cardUrl(game, id, image)} />
        <PicEdge seed={id * 3 + 1} />
      </span>
      <b className={lengthOf(label)}>
        <span>{label}</span>
      </b>
      <span className="lv-badge" aria-hidden>
        <svg viewBox="0 0 130 100" preserveAspectRatio="none">
          <polygon points={BADGE_POINTS} />
        </svg>
        <b>{level ?? rank.level}</b>
      </span>
    </span>
  )
})

const CardSheet = ({
  rank,
  out,
  onClose,
  onGone,
}: {
  rank: Rank
  out: boolean
  onClose: () => void
  onGone: () => void
}) => {
  const { t } = useI18n()
  const finds = Object.entries(rank.modes)
    .map(([mode, one]) => ({ mode: MODES.find((item) => item.id === mode), ...one }))
    .filter((one) => one.mode && one.xp > 0)
    .sort((a, b) => b.xp - a.xp)
  const from = CARD_STEPS[rank.tier]!.xp
  const share = rank.next ? Math.min(1, (rank.xp - from) / (rank.next.xp - from)) : 1
  useEffect(() => {
    if (!out) return
    const timer = window.setTimeout(onGone, 320)
    return () => window.clearTimeout(timer)
  }, [out, onGone])
  return (
    <div className={`lv-sheet ${out ? 'is-out' : ''}`} role="dialog" aria-label={t('card.stats')} onPointerDown={(event) => event.stopPropagation()}>
      <svg className="lv-sheet-paper" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points={SHEET_POINTS} vectorEffect="non-scaling-stroke" />
      </svg>
      <button type="button" className="lv-sheet-x" aria-label={t('dex.close')} onClick={onClose}>
        <CloseIcon />
      </button>
      <small className="lv-sheet-kicker">{t(`card.rarity.${rank.rarity}` as UiKey)}</small>
      <b className="lv-sheet-level">{t('card.level', { level: rank.level })}</b>
      <div className="lv-sheet-xp">
        <span>{t('card.xp')}</span>
        <em>
          {rank.xp}
          {rank.next && <i> / {rank.next.xp}</i>}
        </em>
      </div>
      <span className="lv-sheet-bar" aria-hidden>
        <i style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
      <small className="lv-sheet-next">
        {rank.next ? t('card.toNext', { xp: rank.next.xp - rank.xp, name: t(`card.rarity.${rank.next.rarity}` as UiKey) }) : t('card.max')}
      </small>
      <div className="lv-sheet-where">
        <span>{t('card.where')}</span>
        {finds.length ? (
          <ul>
            {finds.map((one) => (
              <li key={one.mode!.id}>
                <i aria-hidden>{one.mode!.icon}</i>
                <span>{t(one.mode!.label)}</span>
                <em>{one.xp}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('card.never')}</p>
        )}
      </div>
    </div>
  )
}

const DexZoom = ({
  focus,
  game,
  label,
  accent,
  rank,
  pin,
  onClosed,
}: {
  focus: Focus
  game: GameId
  label: string
  accent: string
  rank?: Rank
  pin?: { on: boolean; toggle: () => void }
  onClosed: () => void
}) => {
  const { t } = useI18n()
  const [sheet, setSheet] = useState<'in' | 'out' | null>(null)
  const [seen, setSeen] = useState(false)
  const hide = () => setSheet((was) => (was ? 'out' : null))
  const gone = useCallback(() => setSheet(null), [])
  const [away, setAway] = useState(false)
  const tier = rank ? rank.tier + 1 : undefined
  const level = rank?.level
  const card = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const shut = useRef<HTMLButtonElement>(null)
  const face = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const opened = useRef(0)
  const ready = useCallback(() => !leaving.current && performance.now() - opened.current > MOVE_MS, [])
  const { dragged, rest } = useTilt(face, ready)

  const travel = useCallback(
    (back: boolean) => {
      const node = card.current
      if (!node) return 'none'
      node.getAnimations().forEach((motion) => motion.cancel())
      const to = node.getBoundingClientRect()
      const home = back ? (focus.node.parentElement ?? focus.node).getBoundingClientRect() : focus.from
      const turn = back || !focus.hovered ? focus.tilt : 0
      const dx = home.left + home.width / 2 - (to.left + to.width / 2)
      const dy = home.top + home.height / 2 - (to.top + to.height / 2)
      return `translate(${dx}px, ${dy}px) scale(${focus.node.offsetWidth / node.offsetWidth}) rotate(${turn}deg)`
    },
    [focus],
  )

  const close = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    setSheet(null)
    setAway(true)
    rest()
    const motion = { duration: MOVE_MS, easing: MOVE_EASE, fill: 'forwards' as const }
    shade.current?.animate([{ opacity: 1 }, { opacity: 0 }], motion)
    card.current?.querySelector('.lv-back')?.animate([{ '--turn': `${BACK_TURN + focus.tilt}deg` }, { '--turn': `${BACK_TURN}deg` }], motion)
    const back = card.current?.animate([{ transform: 'none' }, { transform: travel(true) }], motion)
    if (back) back.onfinish = onClosed
    else onClosed()
  }, [travel, onClosed, rest, focus.tilt])

  useEffect(() => {
    const motion = { duration: MOVE_MS, easing: MOVE_EASE }
    opened.current = performance.now()
    shade.current?.getAnimations().forEach((running) => running.cancel())
    shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], motion)
    card.current?.animate([{ transform: travel(false) }, { transform: 'none' }], motion)
    card.current?.querySelector('.lv-back')?.animate([{ '--turn': `${BACK_TURN}deg` }, { '--turn': `${BACK_TURN + focus.tilt}deg` }], motion)
    shut.current?.focus({ preventScroll: true })
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    const key = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      root.style.overflow = before
    }
  }, [travel, close, focus.tilt])

  const { entity } = focus

  return createPortal(
    <div className="dex-zoom" role="dialog" aria-modal="true" aria-label={label} style={{ '--dex': accent } as CSSProperties}>
      <div ref={shade} className="dex-zoom-shade" onClick={() => !dragged.current && close()} />
      <div ref={card} className={`dex-zoom-card ${tier ? `lv-${tier}` : ''} ${away ? 'is-leaving' : ''}`}>
        <CardGlow seed={entity.id} tier={tier} turn={BACK_TURN + focus.tilt} />
        <div ref={face} className="dex-zoom-face">
          {tier && tier > 1 && <BackSheet turn={BACK_TURN + focus.tilt} />}
          {tier && tier > 1 && <i className="dex-zoom-drop" />}
          {pin && (
            <button
              type="button"
              className={`dex-zoom-pin ${pin.on ? 'is-on' : ''}`}
              aria-pressed={pin.on}
              aria-label={t(pin.on ? 'card.pinned' : 'card.pin')}
              title={t(pin.on ? 'card.pinned' : 'card.pin')}
              onClick={pin.toggle}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polygon points={CHIP_POINTS} vectorEffect="non-scaling-stroke" />
              </svg>
              <PinIcon />
            </button>
          )}
          {level !== undefined && (
            <button
              type="button"
              className={`lv-badge ${sheet === 'in' ? 'is-on' : ''} ${seen ? '' : 'is-calling'}`}
              aria-label={t('card.stats')}
              aria-expanded={sheet === 'in'}
              onClick={() => {
                setSeen(true)
                if (sheet === 'in') hide()
                else setSheet('in')
              }}
            >
              <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
                <polygon points={BADGE_POINTS} />
              </svg>
              <b>{level}</b>
            </button>
          )}
          <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
          <i className="dex-zoom-glare" style={{ clipPath: torn(entity.id, 4) }} />
          <span className="dex-zoom-pic" style={{ clipPath: torn(entity.id * 3 + 1, 3, 7) }}>
            <img src={cardUrl(game, entity.id, entity.image)} alt="" draggable={false} />
            <img
              className="dex-zoom-hd"
              decoding="async"
              src={hdUrl(game, entity.id, entity.image)}
              alt=""
              draggable={false}
              onLoad={(event) => event.currentTarget.classList.add('is-ready')}
              onError={(event) => event.currentTarget.classList.remove('is-ready')}
            />
            <PicEdge seed={entity.id * 3 + 1} />
            <i className="dex-zoom-shine" />
          </span>
          <b className="dex-zoom-name" style={{ fontSize: `${focus.type}cqw` }}>
            <span>
              {(focus.lines.length ? focus.lines : [label]).map((line, index) => (
                <Fragment key={index}>
                  {index > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </span>
          </b>
        </div>
        {sheet && rank && <CardSheet rank={rank} out={sheet === 'out'} onClose={hide} onGone={gone} />}
      </div>
      <button ref={shut} type="button" className={`dex-zoom-close ${away ? 'is-leaving' : ''}`} onClick={close} aria-label={t('dex.close')}>
        <CloseIcon />
      </button>
    </div>,
    document.body,
  )
}

const SIZE_KEY = 'dex-size:'
const noop = () => () => {}
const useRemembered = (game: string) =>
  useSyncExternalStore(
    noop,
    () => {
      try {
        return Number(localStorage.getItem(SIZE_KEY + game)) || 0
      } catch {
        return 0
      }
    },
    () => 0,
  )

export default function Bestiary({ game: gameId, owner }: { game: string; owner?: string }) {
  const { t, l, name, lang } = useI18n()
  const href = useHref()
  const { user, loading: checking } = useAuth()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  const ready = useEntities(game)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [nickname, setNickname] = useState<string | null>(null)
  const remembered = useRemembered(gameId)
  const [focus, setFocus] = useState<Focus | null>(null)
  const release = useCallback(() => setFocus(null), [])

  const [cards, setCards] = useState<Record<number, CardStats>>({})
  const [pins, setPins] = useState<Set<number> | null>(null)
  const [pinCount, setPinCount] = useState(0)

  const togglePin = async (id: number) => {
    if (!pins || !game) return
    const on = !pins.has(id)
    const flip = (value: boolean) => {
      setPins((was) => {
        const next = new Set(was ?? [])
        if (value) next.add(id)
        else next.delete(id)
        return next
      })
      setPinCount((was) => Math.max(0, was + (value ? 1 : -1)))
    }
    flip(on)
    const { ok } = await api('profile', { action: 'cardPin', game: game.id, id, on })
    if (!ok) flip(!on)
  }

  useEffect(() => {
    if (!game || !user) return
    let alive = true
    const query = owner ? `dex?game=${game.id}&user=${encodeURIComponent(owner)}` : `dex?game=${game.id}`
    void api<{ ids?: number[]; cards?: Record<number, CardStats>; pins?: number[]; pinCount?: number; nickname?: string | null }>(query).then(({ ok, data }) => {
      if (!alive || !ok) return
      setOpen(new Set(data.ids ?? []))
      setCards(data.cards ?? {})
      setPins(owner ? null : new Set(data.pins ?? []))
      setPinCount(data.pinCount ?? 0)
      setNickname(data.nickname ?? null)
    })
    return () => {
      alive = false
    }
  }, [game, user, owner])

  const tierOf = (entity: Entity) => cardRank(cards[entity.id]?.xp ?? 0).tier
  const [only, setOnly] = useState<Set<number>>(new Set())
  const [panel, setPanel] = useState<'filter' | 'search' | null>(null)
  const [touched, setTouched] = useState(false)
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const searchBox = useRef<HTMLInputElement>(null)
  const filtering = panel === 'filter'
  const searching = panel === 'search'

  useEffect(() => {
    if (searching) searchBox.current?.focus({ preventScroll: true })
  }, [searching])
  const toggle = (tier: number) =>
    setOnly((was) => {
      const next = new Set(was)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  const cast = useMemo(() => (game?.entities ?? []).filter((one) => one.answer), [game, ready])
  const terms = useMemo(() => new Map(cast.map((entity) => [entity.id, entityTerms(entity)])), [cast])
  const pictures = !PICTURELESS.has(gameId)
  const label = (entity: Entity) => SHORT[`${gameId}:${entity.id}`]?.[lang] ?? name(entity)

  useEffect(() => {
    if (!cast.length) return
    try {
      localStorage.setItem(SIZE_KEY + gameId, String(cast.length))
    } catch {}
  }, [cast.length, gameId])

  if (!game) return <div className="card center muted">{t('err.not_found')}</div>

  const accent = game.accent && /^#[0-9a-f]{3,8}$/i.test(game.accent) ? game.accent : '#ff8a1f'
  const loading = cast.length === 0
  const counts = CARD_RARITIES.map(() => 0)
  if (Object.keys(cards).length) for (const entity of cast) if (open.has(entity.id)) counts[tierOf(entity)]!++
  const key = searchKey(deferred)
  const needle = key.q
  const tiers = needle ? new Map(cast.map((entity) => [entity.id, open.has(entity.id) ? matchTier(terms.get(entity.id)!, key) : -1])) : null
  const matches = (entity: Entity) => !tiers || tiers.get(entity.id)! >= 0
  const dimmed = (entity: Entity) => (only.size > 0 && !(open.has(entity.id) && only.has(tierOf(entity)))) || !matches(entity)
  const hasRarity = counts.some((count, tier) => tier > 0 && count > 0)
  const jump = () => {
    const visible = cast.filter((entity) => !dimmed(entity))
    const first = tiers ? [...visible].sort((a, b) => tiers.get(a.id)! - tiers.get(b.id)!)[0] : visible[0]
    if (first) document.querySelector(`[data-dex="${first.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="dex" style={{ '--dex': accent } as CSSProperties}>
      <div className="play-nav">
        {owner ? (
          <BackButton href={href.player(owner)}>{nickname ?? t('profile.back')}</BackButton>
        ) : (
          <BackButton href={href.world(game.id)}>{l(game.label)}</BackButton>
        )}
      </div>

      <header className="dex-head">
        <div className="dex-title">
          <h1>{owner ? t('dex.titleOf', { world: l(game.label) }) : t('dex.title')}</h1>
          <DexHelp modes={game.modes} />
          <DexSoon />
        </div>
        {!owner && !user && !checking && (
          <p className="dex-count">
            <Link href={href.login} prefetch={false} className="dex-guest">
              {t('dex.login')}
            </Link>
          </p>
        )}
      </header>

      {(checking || user || owner) && (
        <div className={`dex-filter ${filtering ? 'is-filtering' : ''}`}>
          {open.size > 0 && (
            <>
              <div className="dex-filter-stage">
                {hasRarity && (
                  <div
                    className={`dex-rarities ${filtering ? 'is-open' : ''} ${only.size ? 'has-on' : ''}`}
                    role="group"
                    aria-label={t('dex.rarityFilter')}
                    inert={!filtering}
                  >
                    {touched &&
                      counts.map((count, tier) =>
                        count > 0 ? (
                          <RarityChip
                            key={tier}
                            tier={tier}
                            count={count}
                            on={only.has(tier)}
                            step={counts.slice(tier + 1).filter(Boolean).length}
                            onToggle={() => toggle(tier)}
                          />
                        ) : null,
                      )}
                  </div>
                )}
                <label className={`dex-search ${searching ? 'is-open' : ''}`} inert={!searching}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    <polygon points={SEARCH_POINTS} vectorEffect="non-scaling-stroke" />
                  </svg>
                  <input
                    ref={searchBox}
                    type="search"
                    value={query}
                    placeholder={t('dex.search')}
                    aria-label={t('dex.search')}
                    enterKeyHint="search"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') jump()
                      if (event.key === 'Escape') setPanel(null)
                    }}
                  />
                  {query && (
                    <button type="button" aria-label={t('dex.searchClear')} onClick={() => setQuery('')}>
                      <CloseIcon />
                    </button>
                  )}
                </label>
              </div>
              <button
                type="button"
                className={`dex-filter-toggle is-search ${searching ? 'is-open' : ''} ${needle ? 'is-active' : ''}`}
            inert={filtering}
                aria-expanded={searching}
                aria-label={t('dex.search')}
                title={t('dex.search')}
                onClick={() => setPanel((was) => (was === 'search' ? null : 'search'))}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polygon points={CHIP_POINTS} vectorEffect="non-scaling-stroke" />
                </svg>
                <SearchIcon />
              </button>
              {hasRarity && (
                <button
                  type="button"
                  className={`dex-filter-toggle ${filtering ? 'is-open' : ''} ${only.size ? 'is-active' : ''}`}
                  aria-expanded={filtering}
                  aria-label={t('dex.rarityFilter')}
                  title={t('dex.rarityFilter')}
                  onClick={() => {
                    setTouched(true)
                    setPanel((was) => (was === 'filter' ? null : 'filter'))
                  }}
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    <polygon points={CHIP_POINTS} vectorEffect="non-scaling-stroke" />
                  </svg>
                  <FilterIcon />
                  {only.size > 0 && <i>{only.size}</i>}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="dex-board">
        <InkFrame />
        <ol className="dex-grid" aria-busy={loading || undefined}>
          {loading
            ? Array.from({ length: remembered || 24 }, (_, slot) => (
                <li key={slot} style={{ '--tilt': `${tilt(slot + 1)}deg` } as CSSProperties}>
                  <span className="dex-scrap is-locked is-ghost">
                    <i className="dex-paper" style={{ clipPath: torn(slot + 1, 4) }} />
                  </span>
                </li>
              ))
            : cast.map((entity, place) => (
                <li
                  key={entity.id}
                  data-dex={entity.id}
                  className={dimmed(entity) ? 'is-dim' : undefined}
                  style={{ '--tilt': `${tilt(entity.id)}deg` } as CSSProperties}
                >
                  <DexTile
                    entity={entity}
                    game={game.id}
                    place={place}
                    state={open.has(entity.id) ? (pictures ? 'open' : 'text') : 'locked'}
                    pictures={pictures}
                    label={label(entity)}
                    tier={open.has(entity.id) ? tierOf(entity) : 0}
                    lifted={focus?.entity.id === entity.id}
                    lockedLabel={t('dex.locked')}
                    onOpen={setFocus}
                  />
                </li>
              ))}
        </ol>
      </div>
      {focus && (
        <DexZoom
          key={focus.entity.id}
          focus={focus}
          game={game.id}
          label={label(focus.entity)}
          accent={accent}
          rank={rankOf(cards[focus.entity.id])}
          pin={
            pins && open.has(focus.entity.id) && (pins.has(focus.entity.id) || pinCount < CARD_PINS_MAX)
              ? { on: pins.has(focus.entity.id), toggle: () => void togglePin(focus.entity.id) }
              : undefined
          }
          onClosed={release}
        />
      )}
    </div>
  )
}
