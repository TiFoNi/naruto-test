'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import BackButton from './BackButton'
import { api } from './api'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { cardUrl, miniUrl } from './pics'
import { useHref } from './router'
import { random, torn } from './torn'

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
  return [
    ...cubic(back, spot(-0.2, 0.04), spot(0.02, 0.5), tip, 14),
    ...cubic(tip, spot(hook - 0.06, 0.62), spot(0.22, 0.2), front, 12).slice(1),
  ]
}

const blot = (cx: number, cy: number, radius: number, next: () => number): Shape =>
  Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 9) * Math.PI * 2
    const r = radius * (0.7 + next() * 0.5)
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
  })

const fade = (start: number, end: number, power = 1.1) => (t: number) => end + (start - end) * Math.pow(1 - t, power)
const swell = (peak: number, floor = 0.2, power = 0.7) => (t: number) => floor + peak * Math.pow(Math.sin(Math.PI * t), power)

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
    for (let spot = begin + 20 + next() * 50; spot < end - 12; ) {
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
  const { t, l, name } = useI18n()
  const href = useHref()
  const { user, loading: checking } = useAuth()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  const ready = useEntities(game)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [nickname, setNickname] = useState<string | null>(null)
  const remembered = useRemembered(gameId)

  useEffect(() => {
    if (!game || !user) return
    let alive = true
    const query = owner ? `dex?game=${game.id}&user=${encodeURIComponent(owner)}` : `dex?game=${game.id}`
    void api<{ ids?: number[]; nickname?: string | null }>(query).then(({ ok, data }) => {
      if (!alive || !ok) return
      setOpen(new Set(data.ids ?? []))
      setNickname(data.nickname ?? null)
    })
    return () => {
      alive = false
    }
  }, [game, user, owner])

  const cast = useMemo(() => (game?.entities ?? []).filter((one) => one.answer), [game, ready])

  useEffect(() => {
    if (!cast.length) return
    try {
      localStorage.setItem(SIZE_KEY + gameId, String(cast.length))
    } catch {}
  }, [cast.length, gameId])

  if (!game) return <div className="card center muted">{t('err.not_found')}</div>

  const accent = game.accent && /^#[0-9a-f]{3,8}$/i.test(game.accent) ? game.accent : '#ff8a1f'
  const total = cast.length
  const got = cast.filter((one) => open.has(one.id)).length
  const loading = cast.length === 0

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
        <h1>{owner ? t('dex.titleOf', { world: l(game.label) }) : t('dex.title')}</h1>
        <p className="dex-count">
          <span>{loading ? ' ' : t('dex.count', { got, total })}</span>
          {!owner && !user && !checking && (
            <Link href={href.login} prefetch={false} className="dex-guest">
              {t('dex.login')}
            </Link>
          )}
        </p>
      </header>

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
                <li key={entity.id} style={{ '--tilt': `${tilt(entity.id)}deg` } as CSSProperties}>
                  {open.has(entity.id) ? (
                    <span className="dex-scrap">
                      <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
                      <span className="dex-pic" style={{ clipPath: torn(entity.id * 3 + 1, 3, 7) }}>
                        <img src={cardUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" decoding="async" draggable={false} />
                      </span>
                      <b>{name(entity)}</b>
                    </span>
                  ) : (
                    <span className="dex-scrap is-locked" aria-label={t('dex.locked')}>
                      <i className="dex-paper" style={{ clipPath: torn(entity.id, 4) }} />
                      <span className="dex-pic is-fog" style={{ clipPath: torn(entity.id * 3 + 1, 3, 7) }}>
                        <img src={miniUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" decoding="async" draggable={false} />
                      </span>
                      <em aria-hidden>?</em>
                      <small>№ {place + 1}</small>
                    </span>
                  )}
                </li>
              ))}
        </ol>
      </div>
    </div>
  )
}
