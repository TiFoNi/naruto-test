'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { type CardRarity, ARENA_CLANS, ARENA_FULL_BONUS, ARENA_SKILL_CAP, ARENA_CARD_COST, ARENA_HAND, ARENA_COIN_MAX, ARENA_HERO_SLOTS, ARENA_SELL_BACK, ARENA_SUMMON_SLOTS, ARENA_TIERS } from '@nanda/game'
import { api } from './api'
import { AmaterasuFx } from './AmaterasuFx'
import { IzanagiFx } from './ArenaElementFx'
import { ArenaFace, SpellFace, Ward, tierOf, type ArenaView, type Card, type Side, type Step } from './ArenaCard'
import { BADGE_POINTS, SHEET_POINTS } from './DexCard'
import Avatar from './Avatar'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { BookIcon, ClockIcon, CloseIcon, HeartIcon, RefreshIcon, SnowIcon, UpIcon } from './icons'
import BackButton from './BackButton'
import { tornPoints } from './torn'
import { useHref, useNavigate } from './router'

const GRAB_PX = 5

const CHIP = tornPoints(24, 7, 6)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

const FLY_MS = 1100
const IMPACT_MS = 470
const GAP_MS = 260
const DEATH_MS = 1100
const SHOT_MS = 380
const HEAL_DELAY_MS = 520
const HEAL_HOLD_MS = 650
const GEN_HOLD_MS = 700
const CLAY_FLY_MS = 820
const CLAY_GAP_MS = 150
const CLAY_HOLD_MS = 450

const CLAY_BIRD =
  '<svg viewBox="0 0 64 40"><path class="is-wing is-back" d="M26 17 C 24 8, 18 3, 8 1.5 C 12 4, 14 7, 15 10 C 12 9.5, 10 10, 9 11 C 13 12, 16 13.5, 18 15 C 21 14, 24 15, 26 17 Z"/><path class="is-tail" d="M3 19 L 12 16 L 11 19.5 L 16 18.5 L 13 22 L 15 26 L 3 22.5 Z"/><path class="is-body" d="M11 22 C 17 13.5, 33 11, 45 15 C 49 13.5, 53 13, 57 14.6 L 63.5 16.6 L 57 18.6 C 53.5 23.5, 43 27.5, 29.5 27.5 C 21 27.5, 15 25.5, 11 22 Z"/><path class="is-belly" d="M16 23.5 C 24 26, 36 26, 46 22.5 C 40 26.5, 25 27.5, 16 23.5 Z"/><path class="is-seam" d="M33 13.5 C 34 17, 34 21, 32.5 26 M 44 15 C 45 18, 45 21, 44 24"/><path class="is-wing" d="M29 18 C 32 7, 41 1, 54 0.5 C 50 2.5, 48 4.5, 46.5 7 C 49 6.5, 51 6.8, 52.5 7.5 C 48 9, 45 11, 43.5 13 C 46 13, 47.5 13.5, 48.5 14.2 C 43 15, 39 17, 35.5 20.5 Z"/><circle class="is-eye" cx="52.5" cy="15.8" r="1.4"/></svg>'

const BURST = Array.from({ length: 18 }, (_, i) => {
  const r = i % 2 ? 24 : 48 - ((i * 7) % 3) * 7
  const a = (i / 18) * Math.PI * 2
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`
}).join(' ')

const BlastFx = () => (
  <span className="ar-blast" aria-hidden>
    <i className="ar-blast-flash" />
    <svg className="ar-blast-star" viewBox="-50 -50 100 100">
      <polygon points={BURST} />
    </svg>
    <b className="ar-blast-word">БУМ!</b>
    {Array.from({ length: 7 }, (_, i) => (
      <i key={i} className="ar-blast-puff" style={{ '--a': `${i * 51 + 20}deg`, '--s': `${0.7 + (i % 3) * 0.2}` } as CSSProperties} />
    ))}
  </span>
)

type TipInfo = { id: number; rarity?: CardRarity; shot?: string | null; dodge?: number }

type TipLine = { kind: string; head: string; text: string; cost?: number; need?: CardRarity; on?: boolean }

const SCENES: [string, UiKey][] = [
  ['amaterasu', 'arena.skill.amaterasu'],
  ['meteor', 'arena.myth.meteor'],
  ['blast', 'arena.myth.blast'],
  ['clay', 'arena.skill.clay'],
  ['seal', 'arena.myth.seal'],
  ['katsuyu', 'arena.medic'],
  ['summon', 'arena.skill.summon'],
  ['limbo', 'arena.skill.limbo'],
  ['mirror', 'arena.myth.mirror'],
  ['raikiri', 'arena.myth.raikiri'],
  ['gates', 'arena.myth.gates'],
  ['rasen', 'arena.myth.rasen'],
  ['flash', 'arena.myth.flash'],
  ['reaper', 'arena.myth.reaper'],
  ['jashin', 'arena.myth.jashin'],
  ['kamui', 'arena.myth.kamui'],
  ['rebirth', 'arena.myth.rebirth'],
  ['sacrifice', 'arena.skill.sacrifice'],
  ['revive', 'arena.skill.revive'],
  ['genjutsu', 'arena.skill.genjutsu'],
  ['mind', 'arena.skill.mind'],
  ['counter', 'arena.counter'],
  ['curse', 'arena.clan.oto'],
  ['ward', 'arena.guard'],
  ['poison', 'arena.poison'],
  ['sound', 'arena.sound'],
  ['medic', 'arena.medic'],
  ['fury', 'arena.fury'],
  ['cleave', 'arena.myth.cleave'],
  ['shots', 'arena.ranged'],
  ['dimension', 'arena.myth.dimension'],
  ['sixpaths', 'arena.myth.sixpaths'],
  ['tenseigan', 'arena.myth.tenseigan'],
  ['shed', 'arena.myth.shed'],
  ['lava', 'arena.myth.lava'],
  ['coffin', 'arena.myth.coffin'],
  ['hellfist', 'arena.myth.hellfist'],
  ['paperbomb', 'arena.myth.paperbomb'],
  ['puppet', 'arena.myth.puppet'],
  ['gates2', 'arena.myth.gates2'],
  ['salamander', 'arena.myth.salamander'],
  ['jugo', 'arena.myth.curse'],
  ['benihisago', 'arena.myth.benihisago'],
  ['izanagi', 'arena.myth.izanagi'],
  ['wind', 'arena.myth.wind'],
  ['chains', 'arena.myth.chains'],
  ['edo', 'arena.myth.edo'],
  ['koto', 'arena.myth.koto'],
  ['armor', 'arena.myth.armor'],
  ['jinton', 'arena.myth.jinton'],
  ['shadow', 'arena.skill.shadow'],
  ['clone', 'arena.spell.clone'],
  ['kawarimi', 'arena.spell.kawarimi'],
  ['scorch', 'arena.scorch'],
  ['bomb', 'arena.bomb'],
  ['slash', 'arena.slash'],
]

const spellFits = (kind: string, board: { heroes: Card[]; summons: Card[] }, target: string) => {
  const aim = [...board.heroes, ...board.summons].find((one) => one.uid === target)
  if (!aim) return false
  if (kind === 'clone') return !aim.summon && !aim.clone && board.heroes.includes(aim)
  return (aim.dodge ?? 0) <= 0
}

const spellOn = (kind: string, card: Card): Card => (kind === 'clone' ? { ...card, clone: true } : { ...card, dodge: 1 })

const FlameGallery = ({ children }: { children: ReactNode }) => {
  const [round, setRound] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setRound((was) => was + 1), 3200)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div key={round} className="ar-ama-gallery">
      {children}
    </div>
  )
}

const CASTS = new Set(['amaterasu', 'meteor', 'seal', 'blast', 'reaper', 'burn', 'gatesOpen', 'lava', 'coffin', 'benihisago', 'jinton'])

const METEOR_FALL_MS = 700

const COFFIN_FILL_MS = 750


const HOLD_MS: Record<string, number> = { jinton: 600, koto: 700, chains: 600, shadow: 900, dimension: 600, lava: 700, coffin: 700, benihisago: 600, mind: 700, gatesOpen: 600, gates: 300, amaterasu: 600, burn: 300, meteor: 700, seal: 600, blast: 400, raikiri: 400, reaper: 300 }

const holdOf = (step: Step) => (step.ability ? (HOLD_MS[step.ability] ?? 0) : 0) + (step.swapFrom ? 400 : 0) + (step.dodged?.length ? 300 : 0) + (step.marks?.some(([, key]) => key === 'izanagi') ? 900 : 0)

const AMA_STYLE = 'a' as const

const SWAP_AT = 0.4
const SWAP_FADE = 0.58
const SWAP_GONE = 0.68
const SWAP_HOME = 0.9

const RAYS = ['M50.0 50.0 L58.7 52.3 L66.8 56.3 L76.3 55.8 L83.8 62.1 L93.1 37.6 L103.9 51.4', 'M50.0 50.0 L52.8 58.3 L63.4 61.1 L65.4 71.2 L74.7 74.7 L73.8 86.6 L77.7 94.5', 'M50.0 50.0 L52.6 57.1 L48.5 65.1 L50.2 72.7 L62.7 77.5 L49.5 87.9 L69.7 91.0', 'M50.0 50.0 L46.6 56.5 L37.0 56.8 L37.0 67.8 L32.6 73.7 L16.2 64.3 L10.9 70.2', 'M50.0 50.0 L40.5 50.5 L30.9 49.2 L22.5 58.2 L12.7 41.5 L2.2 47.6 L-5.7 36.2', 'M50.0 50.0 L44.8 44.2 L38.2 39.8 L32.0 35.0 L25.0 31.4 L22.9 21.9 L25.3 10.3', 'M50.0 50.0 L47.3 41.6 L44.3 33.3 L50.6 23.6 L42.6 15.6 L35.8 8.3 L38.9 -1.7', 'M50.0 50.0 L56.7 47.4 L57.3 37.7 L68.5 39.2 L75.6 37.2 L68.1 19.1 L87.6 29.3']

const ARCS = ['M29.9 2.0 L35.0 5.4 L40.2 1.7 L45.4 2.1 L50.6 2.7 L55.7 2.0', 'M98.0 15.2 L99.0 20.2 L100.3 25.2 L94.8 30.3 L96.4 35.3 L98.0 40.3', 'M39.3 98.0 L33.5 99.5 L27.6 94.3 L21.7 101.9 L15.9 101.7 L10.0 98.0', 'M2.0 67.6 L-0.7 62.3 L-1.9 56.9 L2.2 51.6 L-1.5 46.3 L2.0 41.0', 'M15.5 2.0 L19.7 -1.8 L24.0 1.7 L28.3 1.5 L32.6 4.7 L36.8 2.0', 'M98.0 33.6 L98.0 38.9 L99.3 44.3 L97.7 49.7 L96.2 55.1 L98.0 60.5', 'M91.8 98.0 L85.4 100.7 L79.0 99.7 L72.6 96.5 L66.3 95.8 L59.9 98.0', 'M2.0 39.9 L4.1 36.1 L1.2 32.3 L4.8 28.5 L1.1 24.7 L2.0 20.9', 'M57.7 2.0 L63.7 -2.0 L69.6 -0.3 L75.6 5.3 L81.6 1.8 L87.6 2.0', 'M98.0 58.9 L94.6 63.6 L99.0 68.3 L100.2 73.1 L96.2 77.8 L98.0 82.5']

const ChidoriFx = () => (
  <span className="ar-chidori" aria-hidden>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {ARCS.map((d, i) => (
        <path key={i} d={d} style={{ '--i': i } as CSSProperties} />
      ))}
    </svg>
  </span>
)

const RaikiriFx = () => (
  <span className="ar-raikiri" aria-hidden>
    <i className="ar-raikiri-flash" />
    <i className="ar-raikiri-ring" />
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {RAYS.map((d, i) => (
        <path key={i} d={d} style={{ '--i': i % 3 } as CSSProperties} />
      ))}
    </svg>
  </span>
)

const GatesFx = ({ lasting = false }: { lasting?: boolean }) => (
  <span className={`ar-gates ${lasting ? 'is-lasting' : ''}`} aria-hidden>
    <i className="ar-gates-glow" />
    {Array.from({ length: lasting ? 7 : 12 }, (_, i) => (
      <i key={i} className="ar-gates-steam" style={{ '--x': `${4 + ((i * 37) % 92)}%`, '--d': `${-((i * 130) % 1000)}ms`, '--s': `${0.7 + ((i * 11) % 5) / 8}` } as CSSProperties} />
    ))}
  </span>
)

const RinneganFx = () => (
  <span className="ar-rinnegan" aria-hidden>
    <i />
    <i />
    <i />
  </span>
)

const LABEL: Record<string, UiKey> = {
  raikiri: 'arena.myth.raikiri',
  gates: 'arena.myth.gates',
  gatesOpen: 'arena.myth.gates',
  gates2: 'arena.myth.gates2',
  rasen: 'arena.myth.rasen',
  meteor: 'arena.myth.meteor',
  clay: 'arena.skill.clay',
  amaterasu: 'arena.skill.amaterasu',
  seal: 'arena.myth.seal',
  dimension: 'arena.myth.dimension',
  chains: 'arena.myth.chains',
  koto: 'arena.myth.koto',
  lava: 'arena.myth.lava',
  coffin: 'arena.myth.coffin',
  benihisago: 'arena.myth.benihisago',
  jinton: 'arena.myth.jinton',
  genjutsu: 'arena.skill.genjutsu',
  shadow: 'arena.skill.shadow',
  mind: 'arena.skill.mind',
  limbo: 'arena.skill.limbo',
  summon: 'arena.skill.summon',
  clone: 'arena.spell.clone',
  sacrifice: 'arena.skill.sacrifice',
  izanagi: 'arena.myth.izanagi',
  armor: 'arena.myth.armor',
  curse: 'arena.myth.curse',
  tenseigan: 'arena.myth.tenseigan',
  hellfist: 'arena.myth.hellfist',
  wind: 'arena.myth.wind',
  slash: 'arena.myth.slash',
  salamander: 'arena.myth.salamander',
  scorch: 'arena.scorch',
  puppet: 'arena.myth.puppet',
  sixpaths: 'arena.myth.sixpaths',
}

const RISEN: Record<string, UiKey> = { rebirth: 'arena.myth.rebirth', shed: 'arena.myth.shed', revive: 'arena.skill.revive', sacrifice: 'arena.skill.sacrifice' }

const SKIPPED: Record<string, UiKey> = { away: 'arena.banished', chained: 'arena.chained', held: 'arena.held', asleep: 'arena.asleep' }

const CHARMED: Record<string, UiKey> = { dimension: 'arena.banished', chains: 'arena.chained', koto: 'arena.controlled' }

const labelOf = (key: string, mythic?: string | null): UiKey | null => (key === 'gatesOpen' && mythic === 'gates2' ? LABEL.gates2! : (LABEL[key] ?? null))

const ChainsFx = () => (
  <span className="ar-chains" aria-hidden>
    <i />
    <i />
  </span>
)

const TIP_W = 270
const TIP_HOVER_MS = 250
const TIP_PRESS_MS = 350

const GenFx = () => (
  <span className="ar-gen" aria-hidden>
    <i className="ar-gen-ripple" />
    <i className="ar-gen-ripple is-late" />
  </span>
)

const SHOTS: Record<string, string> = {
  kunai:
    '<svg viewBox="0 0 40 40"><path d="M39 20 L22 14.5 L22 25.5 Z" fill="#d4dbe4" stroke="#1b1a1e" stroke-width="1.6" stroke-linejoin="round"/><rect x="9" y="18" width="13" height="4" rx="1.5" fill="#1b1a1e"/><circle cx="5.5" cy="20" r="3.6" fill="none" stroke="#1b1a1e" stroke-width="2"/></svg>',
  senbon: '<svg viewBox="0 0 40 40"><path d="M3 20 L37 20" stroke="#eef3f8" stroke-width="2.2" stroke-linecap="round"/><path d="M29 20 L38 20" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/></svg>',
  clay: '<svg viewBox="0 0 40 40"><path d="M5 23 C11 12 19 12 23 18 C27 11 33 9 38 13 C34 18 30 22 26 24 C21 29 13 31 5 23 Z" fill="#f3f0e9" stroke="#8b8478" stroke-width="1.6" stroke-linejoin="round"/><circle cx="31" cy="15" r="1.5" fill="#1b1a1e"/></svg>',
  wind: '<svg viewBox="0 0 40 40"><path d="M12 3 C33 9 36 31 12 37 C26 28 26 12 12 3 Z" fill="rgba(214,244,234,0.95)"/></svg>',
  paper: '<svg viewBox="0 0 40 40"><path d="M20 2 L24.5 15.5 L38 20 L24.5 24.5 L20 38 L15.5 24.5 L2 20 L15.5 15.5 Z" fill="#f7f3eb" stroke="#9b958a" stroke-width="1.3" stroke-linejoin="round"/></svg>',
}
const LEAVE_MS = 320
const LEAVE_STEP_MS = 45

const cutOf = (seed: number) => {
  const next = randomOf(seed)
  const from = 58 + next() * 20
  const to = 22 + next() * 20
  const flip = next() > 0.5
  const a = flip ? to : from
  const b = flip ? from : to
  const dy = ((b - a) / 100) * (4 / 3)
  const size = Math.hypot(1, dy)
  return {
    a,
    b,
    nx: dy / size,
    ny: -1 / size,
    upper: `polygon(-30% -30%, 130% -30%, 130% ${b}%, -30% ${a}%)`,
    lower: `polygon(-30% ${a}%, 130% ${b}%, 130% 130%, -30% 130%)`,
  }
}

const SLASH_FROM = -24
const SLASH_SPAN = 148

const lens = (a: number, b: number, width: number) => {
  const dx = SLASH_SPAN
  const dy = b - a
  const size = Math.hypot(dx, dy)
  const nx = -dy / size
  const ny = dx / size
  const at = (t: number, side: number) => {
    const bulge = Math.sin(Math.PI * t) ** 0.7 * width * side
    return `${(SLASH_FROM + dx * t + nx * bulge).toFixed(2)},${(a + dy * t + ny * bulge).toFixed(2)}`
  }
  const steps = [0, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 1]
  return [...steps.map((t) => at(t, 1)), ...[...steps].reverse().map((t) => at(t, -1))].join(' ')
}

const Wound = ({ a, b }: { a: number; b: number }) => {
  const dy = b - a
  const size = Math.hypot(SLASH_SPAN, dy)
  return (
    <svg className="ar-wound" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polygon className="is-glow" points={lens(a, b, 7)} />
      <polygon className="is-blade" points={lens(a, b, 2.6)} />
      <polygon className="is-core" points={lens(a, b, 0.9)} />
      {Array.from({ length: 12 }, (_, i) => {
        const t = 0.12 + (i / 11) * 0.76
        const x = SLASH_FROM + SLASH_SPAN * t
        const y = a + dy * t
        const side = i % 2 ? 1 : -1
        const push = 7 + ((i * 7) % 5) * 2
        return (
          <circle
            key={i}
            className="is-spark"
            cx={x}
            cy={y}
            r={0.9 + (i % 3) * 0.45}
            style={{ '--x': `${((-dy / size) * push * side + (i % 2 ? 3 : -3)).toFixed(1)}px`, '--y': `${((SLASH_SPAN / size) * push * side).toFixed(1)}px`, animationDelay: `${0.04 + t * 0.09}s` } as CSSProperties}
          />
        )
      })}
    </svg>
  )
}

const Slash = ({ seed }: { seed: number }) => {
  const cut = cutOf(seed)
  return <Wound a={cut.a} b={cut.b} />
}

const randomOf = (seed: number) => {
  let state = (Math.abs(seed) % 2147483646) + 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

const tearOf = (seed: number) => {
  const next = randomOf(seed)
  const left = 45 + next() * 10
  const right = left + (next() - 0.5) * 8
  const cut: [number, number][] = []
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const share = i / steps
    const y = left + (right - left) * share + (next() - 0.5) * 6 + (i % 2 ? 2 : -2)
    cut.push([-15 + share * 130, y])
  }
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',')
  return {
    left: `polygon(-30% -30%, 130% -30%, ${pts([...cut].reverse())})`,
    right: `polygon(${pts(cut)}, 130% 130%, -30% 130%)`,
    lean: 0,
  }
}

const seedOf = (uid: string) => [...uid].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) % 100000

type Kind = 'hand' | 'board' | 'shop'
type Spot = { zone: 'shop' | 'hand' | 'slot'; at: number }
type Cell = { node: HTMLElement; mid: number; chip: HTMLElement | null }
type Hold = {
  kind: Kind
  uid: string
  at: number
  node: HTMLElement
  nest: HTMLElement | null
  x: number
  y: number
  live: boolean
  cells: Cell[]
  span: number
  from: number
  to: number
  slot: number
  summon: boolean
  spell: boolean
  spellKind: string
  aim: string | null
}

const line = (side: Side) => [...side.heroes, ...side.summons]

const SLOTS_OF: Partial<Record<string, number>> = { summon: 1, limbo: 2 }

const callsOf = (side: Side) => side.summons.length + line(side).reduce((sum, one) => sum + (one.armed ?? []).reduce((all, key) => all + (SLOTS_OF[key] ?? 0), 0), 0)

const split = (cards: Card[]): Side => ({ heroes: cards.filter((one) => !one.summon), summons: cards.filter((one) => one.summon) })

const roomOf = (summon: boolean) => (summon ? ARENA_SUMMON_SLOTS : ARENA_HERO_SLOTS)

const ZONE_SHARE = 0.18

const MERCHANT_PIC = '/avatars/fox.webp?v=1'
const STAGE_W = 1600
const STAGE_COMPACT_W = 1400
const STAGE_H = 900
const STAGE_MIN_H = 620
const COMPACT_BELOW = 520
let stageScale = 1
const unscale = (n: number) => Math.round(n / stageScale)

const spotOf = (card: HTMLElement): Spot | null => {
  const box = card.getBoundingClientRect()
  const area = Math.max(1, box.width * box.height)
  let best: Spot | null = null
  let most = ZONE_SHARE
  for (const node of document.querySelectorAll<HTMLElement>('[data-zone]')) {
    const zone = node.dataset.zone
    if (zone !== 'shop' && zone !== 'hand' && zone !== 'slot') continue
    const room = node.getBoundingClientRect()
    const w = Math.min(box.right, room.right) - Math.max(box.left, room.left)
    const h = Math.min(box.bottom, room.bottom) - Math.max(box.top, room.top)
    if (w <= 0 || h <= 0) continue
    const share = (w * h) / area
    if (share > most) {
      most = share
      best = { zone, at: Number(node.dataset.at ?? -1) }
    }
  }
  return best
}

function Hero({ who, name, id, avatar, frame, pic, hp, struck }: { who: 'me' | 'foe' | 'shop'; name: string; id?: string; avatar?: string | null; frame?: string | null; pic?: string; hp?: number; struck?: boolean }) {
  return (
    <div data-hero={who === 'shop' ? undefined : who} className={`ar-me is-${who} ${struck ? 'is-struck' : ''}`}>
      <span className="ar-me-ring">
        {pic ? (
          <span className="avatar has-pic ar-me-face" aria-hidden>
            <img src={pic} alt="" decoding="async" />
          </span>
        ) : (
          <Avatar id={id} name={name} avatar={avatar} frame={frame} className="ar-me-face" />
        )}
      </span>
      {hp !== undefined && (
        <span className="ar-me-hp">
          <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={BADGE_POINTS} />
          </svg>
          <HeartIcon />
          <b>{hp}</b>
        </span>
      )}
    </div>
  )
}

export default function ArenaGame({ game: gameId, demo = false }: { game: string; demo?: 'fight' | 'shop' | 'gallery' | 'flame' | false }) {
  const { t, l } = useI18n()
  const href = useHref()
  const go = useNavigate()
  const { user, loading } = useAuth()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  const ready = useEntities(game)

  const [view, setView] = useState<ArenaView | null>(null)
  const [checked, setChecked] = useState(false)
  const [fight, setFight] = useState(false)
  const [step, setStep] = useState(-1)
  const [hit, setHit] = useState(false)
  const [healing, setHealing] = useState(false)
  const [lead, setLead] = useState(false)
  const [tip, setTip] = useState<{ info: TipInfo; x: number; y: number } | null>(null)
  const tipTimer = useRef<number | undefined>(undefined)
  const tipFor = useRef<HTMLElement | null>(null)
  const tipStart = useRef({ x: 0, y: 0 })
  const tipped = useRef(false)

  const [waiting, setWaiting] = useState(false)
  const [clock, setClock] = useState<number | null>(null)
  const [waitLeft, setWaitLeft] = useState<number | null>(null)
  const skew = useRef(0)
  const [dragging, setDragging] = useState<Kind | null>(null)
  const [over, setOver] = useState<Spot['zone'] | null>(null)
  const [aimed, setAimed] = useState<string | null>(null)
  const [pledging, setPledging] = useState<string | null>(null)
  const [bonusOpen, setBonusOpen] = useState(false)
  const [bonusLeaving, setBonusLeaving] = useState(false)
  const closeBonus = useCallback(() => {
    setBonusLeaving(true)
    window.setTimeout(() => {
      setBonusOpen(false)
      setBonusLeaving(false)
    }, 180)
  }, [])
  useEffect(() => {
    if (!bonusOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBonus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bonusOpen, closeBonus])
  const [cheer, setCheer] = useState<{ labels: Record<string, string>; at: number } | null>(null)
  const [pendingCheer, setPendingCheer] = useState<{ labels: Record<string, string>; at: number } | null>(null)
  const tipBox = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [stage, setStage] = useState({ w: STAGE_W, h: STAGE_H })

  useLayoutEffect(() => {
    const fit = () => {
      const width = window.innerHeight < COMPACT_BELOW ? STAGE_COMPACT_W : STAGE_W
      const height = Math.round(Math.min(STAGE_H, Math.max(STAGE_MIN_H, (width * window.innerHeight) / window.innerWidth)))
      const next = Math.min(window.innerWidth / width, window.innerHeight / height)
      stageScale = next
      setScale(next)
      setStage({ w: width, h: height })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useLayoutEffect(() => {
    const node = tipBox.current
    if (!node) return
    const box = node.getBoundingClientRect()
    if (box.bottom > window.innerHeight - 8) node.style.top = `${Math.max(8, window.innerHeight - 8 - box.height)}px`
  }, [tip])
  const [spelling, setSpelling] = useState(false)
  const [deal, setDeal] = useState(0)
  const [seenOffers, setSeenOffers] = useState('')
  const [dealWait, setDealWait] = useState(0)
  const [seenTavern, setSeenTavern] = useState<ArenaView['tavern']>([])
  const [seenSpell, setSeenSpell] = useState<ArenaView['spellOffer']>(null)
  const [leaving, setLeaving] = useState<ArenaView['tavern'] | null>(null)
  const [leavingSpell, setLeavingSpell] = useState<ArenaView['spellOffer']>(null)
  const overNow = useRef<Spot['zone'] | null>(null)
  const hold = useRef<Hold | null>(null)
  const endLater = useRef(false)

  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const viewNow = useRef<ArenaView | null>(null)
  const pending = useRef(0)
  const beats = useRef<ArenaView['steps']>([])

  const byId = useMemo(() => new Map((game?.entities ?? []).map((one) => [one.id, one])), [game, ready])

  const opening = useRef<Promise<ArenaView | null> | null>(null)
  const load = useCallback(async () => {
    opening.current ??= (async () => {
      const { data } = await api<{ arena?: ArenaView | null }>('arena')
      return data.arena ?? (await api<{ arena?: ArenaView | null }>('arena', { action: 'start', game: gameId })).data.arena ?? null
    })()
    const now = await opening.current
    if (now) skew.current = now.now - Date.now()
    setView((was) => was ?? now)
    setChecked(true)
  }, [gameId])

  const [scene, setScene] = useState(SCENES[0]![0])

  const replay = useCallback(() => {
    const source = demo === 'gallery' ? import('./arena-fx-gallery.json').then((mod) => (mod.default as unknown as Record<string, ArenaView>)[scene]!) : import('./arena-fx.json').then((mod) => mod.default as unknown as ArenaView)
    void source.then((base) => {
      if (demo === 'shop' || demo === 'flame') {
        const heroes = base.board.heroes
        setView({
          ...base,
          steps: [],
          coins: 6,
          coinsMax: 6,
          chakra: 4,
          chakraMax: 4,
          tavern: base.foeBoard.heroes.map((one) => ({ ...one, cost: 3, tier: one.tier ?? 1 })),
          hand: heroes.slice(0, 3),
          board: { heroes: heroes.slice(3), summons: [] },
          turnEndsAt: Date.now() + 9e8,
        })
        setChecked(true)
        return
      }
      const next = base
      beats.current = next.steps
      setView(next)
      setChecked(true)
      setFight(true)
      setStep(0)
      setHit(false)
      setLead(true)
    })
  }, [demo, scene])

  const buffAt = view?.buffAt ?? 0
  const lastBuff = useRef<number | null>(null)
  useEffect(() => {
    if (!view) return
    if (lastBuff.current === null) {
      lastBuff.current = buffAt
      return
    }
    if (buffAt === lastBuff.current) return
    lastBuff.current = buffAt
    const list = view.buffs ?? []
    const label = ({ atk, hp, coin, chakra }: { atk: number; hp: number; coin?: number; chakra?: number }) =>
      [atk && hp ? `+${atk}/+${hp}` : atk ? `+${atk}` : hp ? `+${hp} ♥` : '', coin ? `+${coin} ${t('arena.gain.coin')}` : '', chakra ? `+${chakra} ${t('arena.gain.chakra')}` : ''].filter(Boolean).join(' ')
    if (list.length) setPendingCheer({ labels: Object.fromEntries(list.map((one) => [one.to, label(one)])), at: Date.now() })
  }, [buffAt, view, t])
  useEffect(() => {
    if (!pendingCheer || fight) return
    const timer = window.setTimeout(() => {
      setCheer({ ...pendingCheer, at: Date.now() })
      setPendingCheer(null)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [pendingCheer, fight])
  useEffect(() => {
    if (!cheer) return
    const timer = window.setTimeout(() => setCheer(null), 1300)
    return () => window.clearTimeout(timer)
  }, [cheer])

  const found = useRef<ArenaView | null>(null)
  const [lobby, setLobby] = useState<'new' | 'resume' | null>(null)

  useEffect(() => {
    if (demo) {
      replay()
      return
    }
    if (!user) {
      if (!loading) setChecked(true)
      return
    }
    let alive = true
    void api<{ arena?: ArenaView | null }>('arena').then(({ data }) => {
      if (!alive) return
      found.current = data.arena ?? null
      setLobby(found.current?.status === 'playing' ? 'resume' : 'new')
      setChecked(true)
    })
    return () => {
      alive = false
    }
  }, [demo, replay, user, loading])

  const enter = useCallback(() => {
    const now = found.current
    setLobby(null)
    if (now?.status === 'playing') {
      skew.current = now.now - Date.now()
      opening.current = Promise.resolve(now)
      setView(now)
      return
    }
    opening.current = null
    void load()
  }, [load])

  useEffect(() => {
    if ((demo !== 'fight' && demo !== 'gallery') || fight || !view) return
    const timer = window.setTimeout(replay, 2500)
    return () => window.clearTimeout(timer)
  }, [demo, fight, view, replay])

  const send = useCallback(
    (body: Record<string, unknown>, slow = false, after?: (next: ArenaView) => void) => {
      if (demo) return
      if (slow) setWaiting(true)
      pending.current += 1
      queue.current = queue.current
        .then(async () => {
          const reply = await api<{ arena?: ArenaView | null }>('arena', body).finally(() => {
            pending.current -= 1
          })
          const { data } = reply
          if (data.arena === null) return go(href.bestiary(gameId as GameId))
          if (data.arena && (pending.current === 0 || after)) {
            skew.current = data.arena.now - Date.now()
            setView(data.arena)
            after?.(data.arena)
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (slow) setWaiting(false)
        })
    },
    [go, href, gameId, demo],
  )

  const buy = useCallback(
    (at: number) => {
      if (at < 0) {
        setView((now) => {
          if (!now?.spellOffer || now.coins < now.spellOffer.cost) return now
          const card: Card = { uid: `${now.seq + 1}`, id: 0, rarity: 'paper', atk: 0, hp: 0, max: 0, summon: false, spell: now.spellOffer.kind }
          return { ...now, seq: now.seq + 1, coins: now.coins - now.spellOffer.cost, hand: [...now.hand, card], spellOffer: null }
        })
        send({ action: 'spell' })
        return
      }
      setView((now) => {
        if (!now || now.coins < ARENA_CARD_COST || !now.tavern[at]) return now
        const one = now.tavern[at]!
        const card: Card = { uid: `${now.seq + 1}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic, fury: one.fury, scorch: one.scorch, bomb: one.bomb, guard: one.guard }
        return { ...now, seq: now.seq + 1, coins: now.coins - ARENA_CARD_COST, hand: [...now.hand, card], tavern: now.tavern.filter((_, i) => i !== at) }
      })
      send({ action: 'buy', at })
    },
    [send],
  )

  const buyPlay = useCallback(
    (at: number, slot: number) => {
      setView((now) => {
        if (!now || now.coins < ARENA_CARD_COST || !now.tavern[at]) return now
        const one = now.tavern[at]!
        const card: Card = { uid: `${now.seq + 1}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic, fury: one.fury, scorch: one.scorch, bomb: one.bomb, guard: one.guard, skills: one.skills }
        const group = card.summon ? [...now.board.summons] : [...now.board.heroes]
        if (group.length >= roomOf(card.summon)) return now
        group.splice(slot < 0 ? group.length : Math.min(slot, group.length), 0, card)
        const board = card.summon ? { ...now.board, summons: group } : { ...now.board, heroes: group }
        return { ...now, seq: now.seq + 1, coins: now.coins - ARENA_CARD_COST, tavern: now.tavern.filter((_, i) => i !== at), board }
      })
      send(slot >= 0 ? { action: 'buy', at, play: true, to: slot } : { action: 'buy', at, play: true })
    },
    [send],
  )

  const buyCast = useCallback(
    (target: string) => {
      setView((now) => {
        if (!now?.spellOffer || now.coins < now.spellOffer.cost) return now
        const kind = now.spellOffer.kind
        if (!spellFits(kind, now.board, target)) return now
        const bless = (list: Card[]) => list.map((one) => (one.uid === target ? spellOn(kind, one) : one))
        return { ...now, coins: now.coins - now.spellOffer.cost, spellOffer: null, board: { heroes: bless(now.board.heroes), summons: bless(now.board.summons) } }
      })
      send({ action: 'spell', target })
    },
    [send],
  )

  const play = useCallback(
    (uid: string, at = -1) => {
      setView((now) => {
        if (!now) return now
        const card = now.hand.find((one) => one.uid === uid)
        if (!card) return now
        const group = card.summon ? [...now.board.summons] : [...now.board.heroes]
        if (group.length >= roomOf(card.summon)) return now
        group.splice(at < 0 ? group.length : Math.min(at, group.length), 0, card)
        const board = card.summon ? { ...now.board, summons: group } : { ...now.board, heroes: group }
        return { ...now, hand: now.hand.filter((one) => one.uid !== uid), board }
      })
      send(at >= 0 ? { action: 'play', uid, at } : { action: 'play', uid })
    },
    [send],
  )

  const cast = useCallback(
    (uid: string, target: string) => {
      setView((now) => {
        if (!now) return now
        const spell = now.hand.find((one) => one.uid === uid)
        if (!spell?.spell) return now
        const kind = spell.spell
        if (!spellFits(kind, now.board, target)) return now
        const bless = (list: Card[]) => list.map((one) => (one.uid === target ? spellOn(kind, one) : one))
        return { ...now, hand: now.hand.filter((one) => one.uid !== uid), board: { heroes: bless(now.board.heroes), summons: bless(now.board.summons) } }
      })
      send({ action: 'cast', uid, target })
    },
    [send],
  )

  const pickDiscover = useCallback(
    (at: number) => {
      setView((now) => {
        const one = now?.discover?.[at]
        if (!now || !one) return now
        const card: Card = { uid: `${now.seq + 1}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic, fury: one.fury, scorch: one.scorch, bomb: one.bomb, guard: one.guard, skills: one.skills }
        return { ...now, seq: now.seq + 1, hand: [...now.hand, card], discover: [] }
      })
      send({ action: 'discover', at })
    },
    [send],
  )

  const toggleSkill = useCallback(
    (uid: string, key: string, target?: string) => {
      setView((now) => {
        if (!now) return now
        const card = line(now.board).find((one) => one.uid === uid)
        const skill = card?.skills?.find((one) => one.key === key)
        if (!card || !skill) return now
        const armed = card.armed ?? []
        const on = armed.includes(key)
        if (!on && now.chakra < skill.cost) return now
        if (!on && callsOf(now.board) + (SLOTS_OF[key] ?? 0) > ARENA_SUMMON_SLOTS) return now
        const next = on ? armed.filter((one) => one !== key) : [...armed, key]
        const swap = (list: Card[]) => list.map((one) => (one.uid === uid ? { ...one, armed: next, aim: on ? undefined : (target ?? one.aim) } : one))
        return {
          ...now,
          chakra: on ? Math.min(now.chakra + skill.cost, now.chakraMax) : now.chakra - skill.cost,
          board: { heroes: swap(now.board.heroes), summons: swap(now.board.summons) },
        }
      })
      send(target ? { action: 'ability', uid, key, target } : { action: 'ability', uid, key })
    },
    [send],
  )

  const sell = useCallback(
    (uid: string) => {
      setView((now) => {
        if (!now) return now
        const inHand = now.hand.some((one) => one.uid === uid)
        const left = line(now.board).filter((one) => one.uid !== uid)
        return {
          ...now,
          coins: Math.min(now.coins + ARENA_SELL_BACK, ARENA_COIN_MAX),
          hand: inHand ? now.hand.filter((one) => one.uid !== uid) : now.hand,
          board: inHand ? now.board : split(left),
        }
      })
      send({ action: 'sell', uid })
    },
    [send],
  )

  const shift = useCallback(
    (uid: string, at: number) => {
      setView((now) => {
        if (!now) return now
        const summon = now.board.summons.some((one) => one.uid === uid)
        const next = summon ? [...now.board.summons] : [...now.board.heroes]
        const from = next.findIndex((one) => one.uid === uid)
        if (from < 0 || from === at) return now
        const [card] = next.splice(from, 1)
        next.splice(Math.min(at, next.length), 0, card!)
        return { ...now, board: summon ? { ...now.board, summons: next } : { ...now.board, heroes: next } }
      })
      send({ action: 'move', uid, at })
    },
    [send],
  )

  const finish = useCallback(() => {
    send({ action: 'end' }, true, (next) => {
      beats.current = next.steps ?? []
      if (!next.steps?.length) return
      setFight(true)
      setStep(0)
      setHit(false)
      setLead(true)
    })
  }, [send])

  const offers = view?.tavern.map((one) => one.id).join(',') ?? ''
  if (view && offers !== seenOffers) {
    const next = offers ? offers.split(',').map(Number) : []
    const left = seenOffers ? seenOffers.split(',').map(Number) : []
    const fresh = next.some((id) => {
      const at = left.indexOf(id)
      if (at < 0) return true
      left.splice(at, 1)
      return false
    })
    setSeenOffers(offers)
    setSeenTavern(view.tavern)
    setSeenSpell(view.spellOffer)
    if (fresh) {
      setDeal((was) => was + 1)
      const gone = seenTavern.length + (seenSpell ? 1 : 0)
      setLeaving(seenTavern.length ? seenTavern : null)
      setLeavingSpell(seenTavern.length ? seenSpell : null)
      setDealWait(gone ? LEAVE_MS + (gone - 1) * LEAVE_STEP_MS : 0)
    }
  }

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      setLeaving(null)
      setLeavingSpell(null)
    }, LEAVE_MS + (leaving.length + 1) * LEAVE_STEP_MS + 40)
    return () => window.clearTimeout(timer)
  }, [leaving])

  viewNow.current = view
  const finishing = useRef(finish)
  finishing.current = finish

  const playing = !!view && view.status === 'playing' && !fight
  const turnEndsAt = view?.turnEndsAt ?? 0
  const fightEndsAt = view?.fightEndsAt ?? 0
  useEffect(() => {
    if (!playing) {
      setClock(null)
      setWaitLeft(null)
      return
    }
    let fired = false
    const step = () => {
      const now = Date.now() + skew.current
      if (fightEndsAt > now) {
        setWaitLeft(Math.ceil((fightEndsAt - now) / 1000))
        setClock(null)
        return
      }
      setWaitLeft(null)
      const left = Math.max(0, Math.ceil((turnEndsAt - now) / 1000))
      setClock(left)
      if (left <= 0 && !fired) {
        fired = true
        if (hold.current) endLater.current = true
        else finishing.current()
      }
    }
    step()
    const timer = window.setInterval(step, 250)
    return () => window.clearInterval(timer)
  }, [playing, turnEndsAt, fightEndsAt])

  useEffect(() => {
    if (!hit) {
      setHealing(false)
      return
    }
    const timer = window.setTimeout(() => setHealing(true), HEAL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hit, step])

  useEffect(() => {
    if (!fight || !lead) return
    const timer = setTimeout(() => setLead(false), 1600)
    return () => clearTimeout(timer)
  }, [fight, lead])

  useLayoutEffect(() => {
    if (!fight || step < 0 || lead) return
    const one = beats.current[step]
    if (!one) return

    const crew = one.all?.length ? one.all : [one.from]
    const movers = crew
      .map((uid) => document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${uid}"]`))
      .filter((node): node is HTMLElement => !!node)
    const aim = one.to
      ? document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${one.to}"]`)
      : document.querySelector<HTMLElement>(`[data-hero="${one.foe ? 'me' : 'foe'}"]`)

    const land = setTimeout(() => setHit(true), one.shot === 'clay' ? CLAY_FLY_MS : one.ability === 'meteor' ? METEOR_FALL_MS : one.ability === 'coffin' ? COFFIN_FILL_MS : IMPACT_MS)
    let next: ReturnType<typeof setTimeout> | undefined
    let zone: HTMLElement | null = null
    const plays: Animation[] = []

    const extra: HTMLElement[] = []
    const pulled: HTMLElement[] = []
    if ((one.summoned || one.risen) && movers[0]) {
      plays.push(
        movers[0].animate(
          [
            { transform: 'none' },
            { transform: 'translateY(-16px) scale(1.06)', offset: 0.2 },
            { transform: 'translateY(-16px) scale(1.06)', offset: 0.8 },
            { transform: 'none' },
          ],
          { duration: FLY_MS + 300, easing: 'ease-in-out' },
        ),
      )
    } else if (one.ability && CASTS.has(one.ability)) {
      if (movers[0] && one.ability !== 'burn')
        plays.push(movers[0].animate([{ transform: 'none' }, { transform: 'translateY(-18px) scale(1.08)', offset: 0.3 }, { transform: 'translateY(-18px) scale(1.08)', offset: 0.65 }, { transform: 'none' }], { duration: FLY_MS, easing: 'ease-in-out' }))
      if (one.ability === 'meteor') {
        const prey = (one.splash ?? []).map((uid) => document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${uid}"]`)).filter((node): node is HTMLElement => !!node)
        if (prey.length) {
          const boxes = prey.map((node) => node.getBoundingClientRect())
          const cx = boxes.reduce((sum, box) => sum + box.left + box.width / 2, 0) / boxes.length
          const cy = boxes.reduce((sum, box) => sum + box.top + box.height / 2, 0) / boxes.length
          const size = boxes[0]!.width * 1.1
          const rock = document.createElement('div')
          rock.className = 'ar-meteor-big'
          rock.style.left = `${cx}px`
          rock.style.top = `${cy}px`
          rock.style.width = `${size}px`
          rock.innerHTML = '<i class="ar-meteor-tail"></i><i class="ar-meteor-core"></i>'
          document.body.appendChild(rock)
          extra.push(rock)
          rock.animate(
            [
              { transform: `translate(-50%, -50%) translate(${size * 4.5}px, ${-size * 5.5}px) scale(0.55) rotate(0deg)`, opacity: 0 },
              { opacity: 1, offset: 0.1 },
              { transform: 'translate(-50%, -50%) translate(0, 0) scale(1) rotate(-25deg)', opacity: 1 },
            ],
            { duration: METEOR_FALL_MS, easing: 'cubic-bezier(0.55, 0, 0.95, 0.5)', fill: 'forwards' },
          ).onfinish = () => {
            rock.remove()
            const boom = document.createElement('div')
            boom.className = 'ar-meteor-impact'
            boom.style.left = `${cx}px`
            boom.style.top = `${cy}px`
            boom.style.width = `${size * 4}px`
            boom.innerHTML = '<i class="ar-meteor-flash"></i><i class="ar-meteor-ring"></i><i class="ar-meteor-ring is-late"></i>' + Array.from({ length: 12 }, (_, i) => `<i class="ar-meteor-chunk" style="--a:${i * 30 + ((i * 17) % 20)}deg;--d:${0.6 + ((i * 7) % 5) / 8}"></i>`).join('')
            document.body.appendChild(boom)
            extra.push(boom)
            const board = document.querySelector<HTMLElement>('.ar-board')
            board?.animate([{ translate: '0 0' }, { translate: '-6px 4px' }, { translate: '5px -3px' }, { translate: '-3px 2px' }, { translate: '0 0' }], { duration: 380, easing: 'ease-out' })
            window.setTimeout(() => boom.remove(), 1200)
          }
        }
      }
      if ((one.ability === 'seal' || one.ability === 'benihisago') && movers[0]) {
        const hole = movers[0].getBoundingClientRect()
        for (const uid of one.sealed ?? []) {
          const node = document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${uid}"]`)
          if (!node) continue
          const box = node.getBoundingClientRect()
          const dx = hole.left + hole.width / 2 - (box.left + box.width / 2)
          const dy = hole.top + hole.height / 2 - (box.top + box.height / 2)
          node.style.zIndex = '8'
          pulled.push(node)
          const lx = dx / stageScale
          const ly = dy / stageScale
          plays.push(
            node.animate(
              [
                { transform: 'none', filter: 'none', opacity: 1 },
                { transform: `translate(${lx * 0.15}px, ${ly * 0.15}px) rotate(-8deg) scale(0.95)`, filter: 'brightness(0.7) saturate(0.4)', offset: 0.35 },
                { transform: `translate(${lx}px, ${ly}px) rotate(220deg) scale(0.05)`, filter: 'brightness(0.3) saturate(0)', opacity: 0.2 },
              ],
              { duration: FLY_MS + 300, delay: IMPACT_MS, easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)', fill: 'forwards' },
            ),
          )
        }
      }
    } else if (one.ability === 'shadow' && movers[0] && aim) {
      const from = movers[0].getBoundingClientRect()
      const to = aim.getBoundingClientRect()
      const sx = from.left + from.width / 2
      const sy = from.top + from.height * 0.92
      const tx = to.left + to.width / 2
      const ty = to.top + to.height * 0.92
      const strip = document.createElement('div')
      strip.className = 'ar-shadow-bind'
      strip.style.left = `${sx}px`
      strip.style.top = `${sy}px`
      strip.style.width = `${Math.hypot(tx - sx, ty - sy)}px`
      strip.style.transform = `translateY(-50%) rotate(${(Math.atan2(ty - sy, tx - sx) * 180) / Math.PI}deg)`
      strip.innerHTML = '<i></i><i></i>'
      document.body.appendChild(strip)
      extra.push(strip)
      strip.animate(
        [
          { clipPath: 'inset(0 100% 0 0)', opacity: 0.4 },
          { clipPath: 'inset(0 0% 0 0)', opacity: 1, offset: 0.4 },
          { clipPath: 'inset(0 0% 0 0)', opacity: 1, offset: 0.82 },
          { clipPath: 'inset(0 0% 0 0)', opacity: 0 },
        ],
        { duration: FLY_MS + 900, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'forwards' },
      )
      plays.push(movers[0].animate([{ transform: 'none' }, { transform: 'translateY(4px) scale(0.97)', offset: 0.25 }, { transform: 'translateY(4px) scale(0.97)', offset: 0.85 }, { transform: 'none' }], { duration: FLY_MS + 900, easing: 'ease-in-out' }))
      plays.push(aim.animate([{ transform: 'none', filter: 'none' }, { transform: 'none', filter: 'none', offset: 0.38 }, { transform: 'translateX(-3px)', filter: 'brightness(0.55)', offset: 0.44 }, { transform: 'translateX(3px)', filter: 'brightness(0.55)', offset: 0.5 }, { transform: 'none', filter: 'brightness(0.7)' }], { duration: FLY_MS + 900, easing: 'ease-out' }))
    } else if (one.charm || one.skip || one.wards || one.summoned || one.risen || one.ability === 'mind' || one.ability === 'clone') {
      if (movers[0]) plays.push(movers[0].animate([{ transform: 'none' }, { transform: 'scale(1.04)', offset: 0.3 }, { transform: 'none' }], { duration: FLY_MS, easing: 'ease-out' }))
    } else if (one.shot && movers.length === 1 && aim) {
      const from = movers[0]!.getBoundingClientRect()
      const to = aim.getBoundingClientRect()
      const sx = from.left + from.width / 2
      const sy = from.top + from.height / 2
      const dx = to.left + to.width / 2 - sx
      const dy = to.top + to.height / 2 - sy
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      const spin = one.shot === 'paper' ? 900 : 0
      const lift = one.shot === 'clay' ? -Math.min(140, Math.hypot(dx, dy) * 0.4) : 0
      if (one.shot === 'clay') {
        const prey = [one.to, ...(one.splash ?? [])]
          .map((uid) => (uid ? document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${uid}"]`) : null))
          .filter((node): node is HTMLElement => !!node)
        prey.forEach((node, i) => {
          const spot = node.getBoundingClientRect()
          const ox = spot.left + spot.width / 2 - sx - dx
          const oy = spot.top + spot.height / 2 - sy - dy
          const face = dx + ox < 0 ? -1 : 1
          const rise = -Math.min(110, Math.hypot(dx + ox, dy + oy) * 0.32) - i * 16
          const bird = document.createElement('div')
          bird.className = 'ar-clay-bird is-live'
          bird.innerHTML = CLAY_BIRD
          bird.style.left = `${sx}px`
          bird.style.top = `${sy}px`
          document.body.appendChild(bird)
          extra.push(bird)
          const flight = bird.animate(
            [
              { transform: `translate(0, 0) scale(${0.4 * face}, 0.4) rotate(-14deg)`, opacity: 0 },
              { opacity: 1, offset: 0.15 },
              { transform: `translate(${(dx + ox) * 0.35}px, ${(dy + oy) * 0.35 + rise}px) scale(${face}, 1) rotate(-10deg)`, offset: 0.45 },
              { transform: `translate(${(dx + ox) * 0.75}px, ${(dy + oy) * 0.75 + rise * 0.7}px) scale(${face}, 1) rotate(14deg)`, offset: 0.72 },
              { transform: `translate(${dx + ox}px, ${dy + oy}px) scale(${1.1 * face}, 1.1) rotate(48deg)`, opacity: 1 },
            ],
            { duration: CLAY_FLY_MS, delay: i * CLAY_GAP_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'both' },
          )
          flight.onfinish = () => bird.remove()
        })
      } else {
        const shot = document.createElement('div')
        shot.className = `ar-shot is-${one.shot}`
        shot.innerHTML = SHOTS[one.shot] ?? SHOTS.kunai!
        shot.style.left = `${sx}px`
        shot.style.top = `${sy}px`
        document.body.appendChild(shot)
        extra.push(shot)
        const flight = shot.animate(
          [
            { transform: `translate(-50%, -50%) rotate(${angle}deg)`, opacity: 0 },
            { opacity: 1, offset: 0.12 },
            { transform: `translate(-50%, -50%) translate(${dx / 2}px, ${dy / 2 + lift}px) rotate(${angle + spin / 2}deg)`, offset: 0.5 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${angle + spin}deg)`, opacity: 1 },
          ],
          { duration: SHOT_MS, delay: IMPACT_MS - SHOT_MS, easing: 'cubic-bezier(0.35, 0.1, 0.65, 1)', fill: 'both' },
        )
        flight.onfinish = () => {
          shot.remove()
          if (one.shot !== 'clay') return
          const boom = document.createElement('div')
          boom.className = 'ar-boom'
          boom.style.left = `${sx + dx}px`
          boom.style.top = `${sy + dy}px`
          document.body.appendChild(boom)
          extra.push(boom)
          boom.animate([{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 }], { duration: 480, easing: 'ease-out', fill: 'forwards' }).onfinish = () => boom.remove()
        }
      }
      plays.push(
        movers[0]!.animate(
          [{ transform: 'none' }, { transform: `translate(${-Math.sign(dx) * 4}px, ${-Math.sign(dy) * 8}px) scale(0.97)`, offset: 0.3 }, { transform: 'none' }],
          { duration: FLY_MS + (one.shot === 'clay' ? CLAY_HOLD_MS : 0), easing: 'ease-out' },
        ),
      )
    } else if (movers.length && aim) {
      const b = aim.getBoundingClientRect()
      zone = movers[0]!.closest<HTMLElement>('.ar-half')
      if (zone) zone.style.zIndex = '7'
      for (const node of movers) {
        const a = node.getBoundingClientRect()
        const dx = unscale(b.left + b.width / 2 - (a.left + a.width / 2))
        const dy = unscale(b.top + b.height / 2 - (a.top + a.height / 2))
        node.style.zIndex = '6'
        const play = node.animate(
          [
            { transform: 'translate(0, 0)', easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
            { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px)`, offset: 0.16, easing: 'cubic-bezier(0.6, 0, 0.85, 0.4)' },
            { transform: `translate(${dx * 0.9}px, ${dy * 0.9}px)`, offset: 0.43, easing: 'linear' },
            { transform: `translate(${dx * 0.88}px, ${dy * 0.88}px)`, offset: 0.56, easing: 'cubic-bezier(0.4, 0, 0.25, 1)' },
            { transform: 'translate(0, 0)' },
          ],
          { duration: FLY_MS, easing: 'linear' },
        )
        plays.push(play)
      }
    }

    if (one.swapFrom && one.swapTo) {
      const sasuke = document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${one.swapFrom}"]`)
      const foe = document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${one.swapTo}"]`)
      if (sasuke && foe) {
        const a = sasuke.getBoundingClientRect()
        const b = foe.getBoundingClientRect()
        const jump = `translate(${unscale(b.left - a.left)}px, ${unscale(b.top - a.top)}px)`
        sasuke.style.zIndex = '5'
        pulled.push(sasuke)
        plays.push(
          sasuke.animate(
            [
              { transform: 'none', opacity: 1, filter: 'none', offset: 0, easing: 'step-end' },
              { transform: jump, opacity: 1, filter: 'drop-shadow(0 0 12px rgba(160, 90, 255, 0.95))', offset: SWAP_AT, easing: 'step-end' },
              { transform: jump, opacity: 1, filter: 'drop-shadow(0 0 8px rgba(160, 90, 255, 0.7))', offset: SWAP_FADE, easing: 'ease-in' },
              { transform: `${jump} scale(0.7)`, opacity: 0, filter: 'drop-shadow(0 0 16px rgba(160, 90, 255, 1)) brightness(1.6)', offset: SWAP_GONE, easing: 'step-end' },
              { transform: 'scale(0.85)', opacity: 0, filter: 'drop-shadow(0 0 16px rgba(160, 90, 255, 1)) brightness(1.6)', offset: SWAP_GONE + 0.01, easing: 'ease-out' },
              { transform: 'none', opacity: 1, filter: 'drop-shadow(0 0 6px rgba(160, 90, 255, 0.6))', offset: SWAP_HOME },
              { transform: 'none', opacity: 1, filter: 'none', offset: 1 },
            ],
            { duration: FLY_MS },
          ),
        )
      }
    }
    if ((one.ability === 'raikiri' || one.ability === 'gates') && movers[0]) {
      const glow = one.ability === 'raikiri' ? 'rgba(110, 190, 255, 0.95)' : 'rgba(255, 60, 40, 0.95)'
      plays.push(movers[0].animate([{ filter: 'none' }, { filter: `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 22px ${glow})`, offset: 0.2 }, { filter: `drop-shadow(0 0 14px ${glow}) drop-shadow(0 0 30px ${glow})`, offset: 0.5 }, { filter: 'none' }], { duration: FLY_MS, easing: 'ease-out', composite: 'add' }))
    }

    const run = plays[0]
    const prior = step > 0 ? beats.current[step - 1] : null
    const was = prior
      ? [...prior.mine, ...prior.theirs].map((card) => card.uid)
      : [...document.querySelectorAll<HTMLElement>('.ar-row.is-packed [data-uid]')].map((node) => node.dataset.uid ?? '')
    const left = new Set([...one.mine, ...one.theirs].map((card) => card.uid))
    const died = was.some((uid) => uid && !left.has(uid))

    const clear = () => {
      for (const node of movers) node.style.zIndex = ''
      if (zone) zone.style.zIndex = ''
    }

    const done = () => {
      clear()
      next = setTimeout(() => {
        if (step >= beats.current.length - 1) {
          setFight(false)
          setStep(-1)
          setHit(false)
          return
        }
        setStep((was) => was + 1)
        setHit(false)
      }, GAP_MS + (died ? DEATH_MS : 0) + (one.heals ? HEAL_HOLD_MS : 0) + (one.charm || one.skip ? GEN_HOLD_MS : 0) + holdOf(one))
    }

    if (run) run.addEventListener('finish', done)
    else next = setTimeout(done, FLY_MS)

    return () => {
      clearTimeout(land)
      if (next) clearTimeout(next)
      for (const play of plays) play.cancel()
      for (const node of extra) node.remove()
      for (const node of pulled) node.style.zIndex = ''
      clear()
    }
  }, [fight, step, lead])

  const take = (kind: Kind, card: Card, at: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || fight || waiting || waitLeft !== null) return
    if (pledging) {
      event.stopPropagation()
      if (kind === 'board' && !card.summon && card.uid !== pledging) toggleSkill(pledging, 'sacrifice', card.uid)
      setPledging(null)
      return
    }
    hold.current = {
      kind,
      uid: card.uid,
      at,
      node: event.currentTarget,
      nest: event.currentTarget.closest<HTMLElement>('.ar-half, .ar-hand'),
      x: event.clientX,
      y: event.clientY,
      live: false,
      cells: [],
      span: 160,
      from: -1,
      to: -1,
      slot: -1,
      summon: card.summon,
      spell: !!card.spell,
      spellKind: card.spell ?? '',
      aim: null,
    }
  }

  const place = useCallback((one: Hold) => {
    for (const [i, cell] of one.cells.entries()) {
      if (i === one.from) continue
      let dx = 0
      if (one.kind === 'board' && one.to >= 0) {
        if (i > one.from && i <= one.to) dx = -one.span
        else if (i < one.from && i >= one.to) dx = one.span
      }
      if ((one.kind === 'hand' || one.kind === 'shop') && one.slot >= 0) dx = i < one.slot ? -one.span / 2 : one.span / 2
      cell.node.style.translate = dx ? `${unscale(dx)}px 0` : ''
      if (cell.chip) cell.chip.style.translate = dx ? `${unscale(dx)}px 0` : ''
    }
  }, [])

  useEffect(() => {
    const begin = (one: Hold) => {
      one.live = true
      one.cells = [...document.querySelectorAll<HTMLElement>(`.ar-half.is-bot .ar-row.${one.summon ? 'is-summons' : 'is-heroes'} [data-uid]`)].map((node) => {
        const box = node.getBoundingClientRect()
        return { node, mid: box.left + box.width / 2, chip: node.parentElement?.querySelector<HTMLElement>(':scope > .ar-skills') ?? null }
      })
      const first = one.cells[0]
      one.span = one.cells.length > 1 ? one.cells[1]!.mid - first!.mid : (first?.node.getBoundingClientRect().width ?? 142) + 18
      one.from = one.cells.findIndex((cell) => cell.node.dataset.uid === one.uid)
      one.to = one.from
      one.node.classList.add('is-flying')
      if (one.nest) one.nest.style.zIndex = '70'
      setDragging(one.kind)
      setSpelling(one.spell)
    }

    const clean = (one: Hold) => {
      const nodes = [one.node, ...one.cells.flatMap((cell) => (cell.chip ? [cell.node, cell.chip] : [cell.node]))]
      for (const node of nodes) {
        node.style.transition = 'none'
        node.style.translate = ''
      }
      void one.node.offsetWidth
      for (const node of nodes) node.style.transition = ''
      one.node.classList.remove('is-flying')
      if (one.nest) one.nest.style.zIndex = ''
      setDragging(null)
      setSpelling(false)
    }

    const move = (event: globalThis.PointerEvent) => {
      const one = hold.current
      if (!one) return
      const dx = event.clientX - one.x
      const dy = event.clientY - one.y
      if (!one.live) {
        if (Math.hypot(dx, dy) < GRAB_PX) return
        begin(one)
      }
      one.node.style.translate = `${unscale(dx)}px ${unscale(dy)}px`
      const over = spotOf(one.node)
      const zone = over?.zone ?? null
      if (zone !== overNow.current) {
        overNow.current = zone
        setOver(zone)
      }
      const box = one.node.getBoundingClientRect()
      const centre = box.left + box.width / 2
      if (one.kind === 'board' && one.from >= 0) {
        let to = one.from
        if (over?.zone === 'slot') {
          const mid = one.cells[one.from]!.mid + dx
          while (to > 0 && mid < one.cells[to - 1]!.mid) to -= 1
          while (to < one.cells.length - 1 && mid > one.cells[to + 1]!.mid) to += 1
        }
        if (to !== one.to) {
          one.to = to
          place(one)
        }
      }
      if ((one.kind === 'hand' || one.kind === 'shop') && one.spell) {
        const spot = [...document.querySelectorAll<HTMLElement>('.ar-half.is-bot .ar-row [data-uid]')].find((node) => {
          const room = node.getBoundingClientRect()
          const midY = box.top + box.height / 2
          return centre >= room.left && centre <= room.right && midY >= room.top && midY <= room.bottom
        })
        const board = viewNow.current?.board
        const taken = !!spot && !!board && !spellFits(one.spellKind || 'kawarimi', board, spot.dataset.uid ?? '')
        const aim = taken ? null : (spot?.dataset.uid ?? null)
        if (aim !== one.aim) {
          one.aim = aim
          setAimed(aim)
        }
        return
      }
      if (one.kind === 'hand' || one.kind === 'shop') {
        let slot = -1
        if (over?.zone === 'slot' && one.cells.length < roomOf(one.summon)) {
          slot = one.cells.filter((cell) => cell.mid < centre).length
        }
        if (slot !== one.slot) {
          one.slot = slot
          place(one)
        }
      }
    }

    const release = () => {
      const one = hold.current
      hold.current = null
      if (!one) return
      if (!one.live) {
        if (tipped.current) return
        if (one.kind === 'hand' && !one.spell) play(one.uid)
        return
      }
      if (one.kind === 'hand' && one.spell) {
        setAimed(null)
        if (one.aim) cast(one.uid, one.aim)
        requestAnimationFrame(() => clean(one))
        return
      }
      const over = spotOf(one.node)
      if (one.kind === 'shop' && one.spell) {
        setAimed(null)
        overNow.current = null
        setOver(null)
        if (one.aim) buyCast(one.aim)
        else if (over?.zone === 'hand') buy(one.at)
        requestAnimationFrame(() => clean(one))
        return
      }
      overNow.current = null
      setOver(null)
      if (one.kind === 'board') {
        if (over?.zone === 'shop') sell(one.uid)
        else if (one.to >= 0 && one.to !== one.from) shift(one.uid, one.to)
      } else if (one.kind === 'hand') {
        if (over?.zone === 'shop') sell(one.uid)
        else if (over?.zone === 'slot') play(one.uid, one.slot)
      } else if (over?.zone === 'slot' && one.cells.length < roomOf(one.summon)) {
        buyPlay(one.at, one.slot)
      } else if (over?.zone === 'hand') {
        buy(one.at)
      }
      requestAnimationFrame(() => clean(one))
    }

    const up = () => {
      release()
      if (!endLater.current) return
      endLater.current = false
      finishing.current()
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [place, buy, buyPlay, buyCast, play, sell, shift, cast])

  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  if (!checked || !ready) return <p className="ar-note">{t('arena.loading')}</p>
  if (!user?.admin && !demo) return <div className="card center muted">{t('err.not_found')}</div>
  if (lobby && !demo)
    return (
      <div className="ar-lobby">
        <button type="button" className="ar-lobby-play" onClick={enter}>
          <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
          </svg>
          <b>{t(lobby === 'resume' ? 'arena.resume' : 'arena.start')}</b>
        </button>
      </div>
    )
  if (demo === 'flame' && view) {
    const sample = [...view.board.heroes, ...view.hand][0]!
    return (
      <FlameGallery>
        {(['a', 'b', 'c', 'd'] as const).flatMap((variant, i) =>
          [false, true].map((lasting) => (
            <figure key={variant + lasting}>
              <span className="ar-move">
                <ArenaFace game={game.id} entity={byId.get(sample.id)} rarity={sample.rarity} atk={sample.atk} hp={sample.hp} summon={false} tier={sample.tier} />
                <AmaterasuFx variant={variant} lasting={lasting} />
              </span>
              <figcaption>
                {i + 1} · {lasting ? 'горить' : 'спалах'}
              </figcaption>
            </figure>
          )),
        )}
      </FlameGallery>
    )
  }
  if (!view)
    return (
      <div className="card center muted locked">
        <p>{t('arena.gone')}</p>
        <a className="primary" href={href.bestiary(game.id)}>
          {t('arena.toDex')}
        </a>
      </div>
    )

  const done = view.status !== 'playing' && !fight
  const steps = view.steps ?? []
  beats.current = steps
  const at = fight && step >= 0 ? Math.min(step, steps.length - 1) : -1
  const now = at >= 0 ? steps[at]! : null
  const state = at < 0 ? null : hit ? now : at > 0 ? steps[at - 1]! : null

  const health = new Map<string, number>()
  const guard = new Map<string, number>()
  const shield = new Map<string, string | false>()
  const dazedNow = new Set<string>()
  const burnNow = new Set<string>()
  const gatedNow = new Set<string>()
  const boundNow = new Set<string>()
  const shadeNow = new Set<string>()
  const chainNow = new Set<string>()
  const holdNow = new Set<string>()
  const awayNow = new Set<string>()
  const moltenNow = new Set<string>()
  const scorchNow = new Set<string>()
  const lastWard = new Map<string, string>()
  const power = new Map<string, number>()
  if (at >= 0) {
    for (const one of state ? [...state.mine, ...state.theirs] : [...line(view.board), ...line(view.foeBoard)]) {
      const late = hit && !healing ? (now?.heals?.[one.uid] ?? 0) : 0
      health.set(one.uid, one.hp - late)
    }
    if (state) for (const one of [...state.mine, ...state.theirs]) {
      guard.set(one.uid, one.dodge ?? 0)
      shield.set(one.uid, one.ward || false)
      if (one.stun) dazedNow.add(one.uid)
      if (one.burn) burnNow.add(one.uid)
      if (one.gated) gatedNow.add(one.uid)
      if (one.bound || one.link) boundNow.add(one.uid)
      if (one.chained) chainNow.add(one.uid)
      if (one.away) awayNow.add(one.uid)
      if (one.burn && one.molten) moltenNow.add(one.uid)
      if (one.burn && one.scorched) scorchNow.add(one.uid)
      if (one.shade) {
        shadeNow.add(one.uid)
        if (one.bound) holdNow.add(one.bound)
      }
      power.set(one.uid, one.atk)
    }
    else for (const uid of view.armed ?? []) guard.set(uid, 1)
  }
  const before = at > 0 ? steps[at - 1]! : null
  if (before)
    for (const one of [...before.mine, ...before.theirs]) {
      if (one.ward) lastWard.set(one.uid, one.ward)
      if (one.burn && one.molten) moltenNow.add(one.uid)
      if (one.burn && one.scorched) scorchNow.add(one.uid)
    }
  const standing = new Set((before ? [...before.mine, ...before.theirs] : [...line(view.board), ...line(view.foeBoard)]).map((one) => one.uid))
  const skillsBy = new Map<number, NonNullable<Card['skills']>>()
  for (const one of [...view.tavern, ...view.hand, ...line(view.board), ...line(view.foeBoard), ...steps.flatMap((step) => [...step.mine, ...step.theirs])]) if (one.skills?.length && !skillsBy.has(one.id)) skillsBy.set(one.id, one.skills)

  const cardAt = (target: EventTarget | null) => {
    const from = target as HTMLElement | null
    if (!from?.closest) return null
    return from.closest<HTMLElement>('.arena-card[data-tip]') ?? from.closest<HTMLElement>('.ar-move, li')?.querySelector<HTMLElement>('.arena-card[data-tip]') ?? null
  }

  const showTip = (node: HTMLElement) => {
    if (!node.isConnected || hold.current?.live) return
    const info = JSON.parse(node.dataset.tip ?? '{}') as TipInfo
    const box = node.getBoundingClientRect()
    const x = box.right + 12 + TIP_W > window.innerWidth ? box.left - 12 - TIP_W : box.right + 12
    const y = Math.max(8, box.top)
    setTip({ info, x, y })
  }

  const hideTip = () => {
    window.clearTimeout(tipTimer.current)
    tipFor.current = null
    if (tip) setTip(null)
  }

  const peek = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || dragging || hold.current) return
    const node = cardAt(event.target)
    if (node === tipFor.current) return
    hideTip()
    if (!node) return
    tipFor.current = node
    tipTimer.current = window.setTimeout(() => showTip(node), TIP_HOVER_MS)
  }

  const press = (event: ReactPointerEvent<HTMLElement>) => {
    if (pledging) setPledging(null)
    hideTip()
    tipped.current = false
    if (event.pointerType === 'mouse') return
    const node = cardAt(event.target)
    if (!node) return
    tipFor.current = node
    tipStart.current = { x: event.clientX, y: event.clientY }
    tipTimer.current = window.setTimeout(() => {
      tipped.current = true
      showTip(node)
    }, TIP_PRESS_MS)
  }

  const slide = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !tipFor.current) return
    if (Math.hypot(event.clientX - tipStart.current.x, event.clientY - tipStart.current.y) > 8) hideTip()
  }

  const lift = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') hideTip()
  }

  const statsText = (atk: number, hp: number) => [atk ? t('arena.stat.atk', { n: atk }) : '', hp ? t('arena.stat.hp', { n: hp }) : ''].filter(Boolean).join(t('arena.stat.and'))

  const namesOf = (ids: number[]) => ids.map((id) => (byId.get(id)?.name ?? '').split(' ')[0]).join(', ')

  const captainText = (scope: string, atk: number, hp: number) =>
    scope === 'all'
        ? t('arena.tip.captain.all', { stats: statsText(atk, hp) })
        : t('arena.tip.captain.clan', { clan: t(`arena.clan.${scope}` as UiKey), stats: statsText(atk, hp) })

  const clanExtra = (clan: string) => {
    const rule = (ARENA_CLANS as Record<string, { grow?: readonly [number, number]; every?: number; full?: number }>)[clan]
    if (!rule) return ''
    const stats = rule.grow ? `+${rule.grow[0]}/+${rule.grow[1]}` : ''
    const grow = !rule.grow ? '' : rule.every && rule.every > 1 ? t('arena.clanGrowEvery', { n: rule.every, stats }) : t('arena.clanGrow', { stats })
    const full = rule.full ? t('arena.clanFull', { n: rule.full, b: ARENA_FULL_BONUS }) : ''
    return [grow, full].filter(Boolean).join(' ')
  }

  const tipLines = (info: TipInfo) => {
    const lines: TipLine[] = []
    const short = (atk: number, hp: number) => (atk && hp ? `+${atk}/+${hp}` : atk ? t('arena.short.atk', { n: atk }) : t('arena.short.hp', { n: hp }))
    const have = tierOf(info.rarity ?? 'paper')
    const costs = new Map((skillsBy.get(info.id) ?? []).map((one) => [one.key, one]))
    for (const row of view.kits?.[info.id] ?? []) {
      if (row.key === 'captain') {
        lines.push({ kind: 'extra', head: t('arena.captain'), text: `${row.scope === 'all' ? t('arena.short.all') : t(`arena.clan.${row.scope}` as UiKey)} ${short(row.atk ?? 0, row.hp ?? 0)}` })
        continue
      }
      if (row.key === 'cry') {
        lines.push({ kind: 'extra', head: t('arena.cry'), text: `${t(`arena.cry.${row.scope}` as UiKey)} ${short(row.atk ?? 0, row.hp ?? 0)}` })
        continue
      }
      if (row.key === 'counter') {
        const vs = row.ids?.length ? namesOf(row.ids) : row.scope === 'tailed' ? t('arena.counter.tailed') : t(`arena.clan.${row.scope}` as UiKey)
        const mul = `×${String(row.n ?? 1).replace('.', ',')}`
        lines.push({ kind: 'extra', head: t('arena.counter'), text: `${vs} ${mul}${row.with?.length ? ` (${t('arena.short.with', { names: namesOf(row.with) })})` : ''}` })
        continue
      }
      if (row.key.startsWith('team.')) {
        lines.push({ kind: 'extra', head: t(`arena.team.${row.key.slice(5)}` as UiKey), text: `${t('arena.short.with', { names: namesOf((row.ids ?? []).filter((id) => id !== info.id)) })} ${short(row.atk ?? 0, row.hp ?? 0)}` })
        continue
      }
      if (!row.need) continue
      const on = have >= tierOf(row.need)
      const [group, name = ''] = row.key.split('.') as [string, string | undefined]
      const base = { need: row.need, on }
      if (group === 'clan') lines.push({ ...base, kind: 'clan', head: t(`arena.clan.${name}` as UiKey), text: [t(`arena.tip.clan.${name}` as UiKey), clanExtra(name)].filter(Boolean).join(' ') })
      else if (group === 'up') lines.push({ ...base, kind: 'up', head: t('arena.up'), text: t(`arena.tip.up.${name}` as UiKey) })
      else if (group === 'myth') lines.push({ ...base, kind: 'myth', head: t(`arena.myth.${name}` as UiKey), text: t(`arena.tip.myth.${name}` as UiKey) })
      else if (group === 'skill') {
        const skill = costs.get(name)
        lines.push({ ...base, kind: 'skill', head: t(`arena.skill.${name}` as UiKey), text: t(`arena.skill.${name}.hint` as UiKey, { beast: (skill?.beast && byId.get(skill.beast)?.name) || '' }), cost: skill?.cost })
      } else if (group === 'income') lines.push({ ...base, kind: 'income', head: t('arena.income'), text: t(`arena.tip.income.${name}` as UiKey, { n: row.n ?? 1 }) })
      else if (group === 'grow' || group === 'feed' || group === 'avenge')
        lines.push({ ...base, kind: group, head: t(`arena.${group}` as UiKey), text: t(`arena.tip.${group}` as UiKey, { clan: t(`arena.clan.${row.scope}` as UiKey), stats: short(row.atk ?? 0, row.hp ?? 0) }) })
      else if (group === 'guard') lines.push({ ...base, kind: 'guard', head: t('arena.guard'), text: t('arena.tip.guard.self') })
      else if (group === 'medic') lines.push({ ...base, kind: 'medic', head: t('arena.medic'), text: t('arena.tip.medic', { n: row.n ?? 1 }) })
      else lines.push({ ...base, kind: group, head: t(`arena.${group}` as UiKey), text: t(`arena.tip.${group}` as UiKey) })
    }
    if (info.dodge) lines.push({ kind: 'extra', head: t('arena.dodge'), text: t('arena.tip.dodge') })
    return lines.sort((a, b) => Number(a.kind === 'extra') - Number(b.kind === 'extra'))
  }

  const armedCount = line(view.board).reduce((sum, one) => sum + (one.armed?.length ?? 0), 0)

  const usedWard = new Set(steps.slice(0, hit ? at + 1 : Math.max(0, at)).filter((one) => one.wards).map((one) => one.from))
  const heroHit = hit && now && !now.to && now.damage > 0 && !now.splash?.length ? (now.foe ? 'me' : 'foe') : null

  const withCalls = (base: Card[], pick: (one: Step) => Card[]) => {
    if (at < 0) return base
    const seen = new Set(base.map((one) => one.uid))
    const extra: Card[] = []
    for (const one of steps.slice(0, at + 1))
      for (const card of pick(one))
        if (!seen.has(card.uid)) {
          seen.add(card.uid)
          extra.push(card)
        }
    return [...base, ...extra]
  }
  const mine = withCalls(line(view.board), (one) => one.mine)
  const theirs = withCalls(line(view.foeBoard), (one) => one.theirs)
  const myHp = state ? state.hp : at >= 0 ? (view.opened?.hp ?? view.hp) : view.hp
  const foeHp = state ? state.foeHp : at >= 0 ? (view.opened?.foeHp ?? view.foeHp) : view.foeHp
  const freeAt = view.board.heroes.length < ARENA_HERO_SLOTS ? view.board.heroes.length : -1
  const selling = (dragging === 'board' || dragging === 'hand') && !spelling
  const held = hold.current
  const boardOpen = (dragging === 'hand' || dragging === 'shop') && !spelling && !!held && (held.summon ? view.board.summons.length < ARENA_SUMMON_SLOTS : view.board.heroes.length < ARENA_HERO_SLOTS)
  const buying = dragging === 'shop' && view.hand.length < ARENA_HAND

  const packed = (cards: Card[]) => (
    <ul className="ar-row is-packed">
      {cards.map((card, slot) => {
        const hp = health.get(card.uid)
        const dying = hit && hp === undefined && standing.has(card.uid)
        const gone = at >= 0 && hp === undefined && !dying
        const dodging = hit && !!now?.dodged?.includes(card.uid)
        const phasing = dodging && card.mythic === 'kamui'
        const sparking = dodging && !!now?.marks?.some(([uid, key]) => uid === card.uid && key === 'armor')
        const charmed = hit && !!now?.charm && now.to === card.uid
        const dazed = hit && !!now?.skip && now.from === card.uid
        const seized = hit && now?.ability === 'mind' && (now.to === card.uid || now.from === card.uid)
        const dozing = hit && now?.ability === 'mind' && now.to === card.uid
        const sapped = hit && !!now?.sapped?.includes(card.uid)
        const mended = hit && healing && !!now?.heals?.[card.uid]
        const helping = hit && healing && !!card.medic && !!now?.heals && Object.keys(now.heals).some((uid) => cards.some((one) => one.uid === uid) && uid !== card.uid)
        const blocked = hit && !!now?.warded?.includes(card.uid)
        const raised = hit && !!now?.wards?.includes(card.uid)
        const raging = hit && !!now?.raged?.includes(card.uid)
        const called = hit && !!now?.summoned?.includes(card.uid)
        const risen = hit && now?.risen === card.uid
        const again = hit && !!now?.again && now.from === card.uid
        const mirrored = hit && now?.swapFrom === card.uid
        const sealed = hit && !!now?.sealed?.includes(card.uid)
        const cursing = hit && !!now?.cursed?.includes(card.uid)
        const countered = hit && !!now?.countered?.includes(card.uid)
        const tech = hit && now?.from === card.uid && !now?.skip && !!now?.ability ? labelOf(now.ability, card.mythic) : null
        const marked = hit ? now?.marks?.find(([uid]) => uid === card.uid)?.[1] : undefined
        const word = (marked ? labelOf(marked) : null) ?? (tech === 'arena.spell.clone' && !now?.summoned ? 'arena.cloneWait' : tech)
        const skipWord = dazed && now?.ability ? (SKIPPED[now.ability] ?? null) : null
        const charmWord = charmed && now?.ability ? (CHARMED[now.ability] ?? null) : null
        const entombed = !lead && now?.ability === 'coffin' && now.to === card.uid && !now.warded?.length
        const melting = hit && now?.ability === 'lava' && !!now.splash?.includes(card.uid)
        const toneOf = (uid: string) => (now?.ability === 'amaterasu' && now.to === uid ? undefined : melting || moltenNow.has(uid) ? 'lava' : scorchNow.has(uid) ? 'fire' : undefined)
        const undone = hit && marked === 'izanagi'
        const struck = hit && !dodging && !blocked && !mirrored && !!now?.damage && (now?.to === card.uid || !!now?.splash?.includes(card.uid) || now?.swapTo === card.uid)
        const face = (
          <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={power.get(card.uid) ?? card.atk} hp={Math.max(0, hp ?? 0)} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} fury={card.fury} scorch={card.scorch} bomb={card.bomb} guard={usedWard.has(card.uid) ? null : card.guard} dodge={guard.get(card.uid) ?? card.dodge} kamui={card.mythic === 'kamui'} shield={shield.get(card.uid)} ghost={card.ghost} fake={card.fake} away={!!card.away} art={card.art} />
        )
        const swallowed = !!now?.sealed?.includes(card.uid)
        const clips = dying && !swallowed ? tearOf(seedOf(card.uid)) : null
        const blasted = struck && (now?.shot === 'clay' || now?.ability === 'blast')
        const burning = hit && (now?.ability === 'amaterasu' ? now.to === card.uid : now?.ability === 'burn' && now.from === card.uid)
        const falling = hit && now?.ability === 'meteor' && !!now.splash?.includes(card.uid)
        const shocked = hit && now?.ability === 'raikiri' && now.to === card.uid
        const charging = !hit && now?.ability === 'raikiri' && now.from === card.uid
        const opened = now?.ability === 'gatesOpen' && now.from === card.uid
        const multiplied = hit && (now?.ability === 'raikiri' || now?.ability === 'gates') && now.to === card.uid ? (now.ability === 'raikiri' ? 2 : 3) : 0
        const warped = hit && (now?.swapFrom === card.uid || now?.swapTo === card.uid)
        const blastAt = blasted ? [now?.to, ...(now?.splash ?? [])].indexOf(card.uid) * CLAY_GAP_MS : 0
        const cut = struck && !dying && !blasted && !burning && !falling && !entombed ? cutOf(seedOf(card.uid)) : null
        return (
          <li key={card.uid} style={{ '--slot': slot - (cards.length - 1) / 2 } as CSSProperties} className={`is-held ${gone ? 'is-out' : ''} ${dying ? 'is-dying' : ''}`}>
            <span data-uid={card.uid} className={`ar-move ${dazedNow.has(card.uid) ? 'is-stunned' : ''} ${awayNow.has(card.uid) ? 'is-banished' : ''} ${chainNow.has(card.uid) ? 'is-chained' : ''} ${shadeNow.has(card.uid) ? 'is-shaded' : ''} ${raised ? 'is-warding' : ''} ${called ? 'is-called' : ''} ${risen ? 'is-risen' : ''} ${mended ? 'is-mended' : ''} ${helping ? 'is-helping' : ''} ${struck ? 'is-struck' : ''} ${blasted ? 'is-blasted' : ''} ${dodging && !phasing && !sparking ? 'is-dodging' : ''} ${phasing ? 'is-phasing' : ''} ${sparking ? 'is-sparking' : ''} ${boundNow.has(card.uid) || seized ? 'is-bound' : ''} ${charmed || dozing ? 'is-charmed' : ''} ${dazed ? 'is-dazed' : ''} ${struck && now?.venom ? 'is-venom' : ''}`} style={blasted ? ({ '--at': `${blastAt}ms` } as CSSProperties) : undefined}>
              {clips ? (
                <span className="ar-tear" style={{ '--lean': clips.lean } as CSSProperties}>
                  <span className="ar-tear-half is-left" style={{ clipPath: clips.left }}>
                    {face}
                  </span>
                  <span className="ar-tear-half is-right" style={{ clipPath: clips.right }}>
                    {face}
                  </span>
                </span>
              ) : cut ? (
                <span className="ar-cut" style={{ '--nx': cut.nx, '--ny': cut.ny } as CSSProperties}>
                  <span className="ar-cut-half is-upper" style={{ clipPath: cut.upper }}>
                    {face}
                  </span>
                  <span className="ar-cut-half is-lower" style={{ clipPath: cut.lower }}>
                    {face}
                  </span>
                </span>
              ) : (
                <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={power.get(card.uid) ?? card.atk} hp={Math.max(0, hp ?? card.hp)} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} fury={card.fury} scorch={card.scorch} bomb={card.bomb} guard={usedWard.has(card.uid) ? null : card.guard} dodge={guard.get(card.uid) ?? card.dodge} kamui={card.mythic === 'kamui'} shield={shield.get(card.uid)} ghost={card.ghost} fake={card.fake} away={!!card.away} art={card.art} />
              )}
              {struck && !blasted && !burning && !falling && <Slash seed={seedOf(card.uid)} />}
              {shocked && <RaikiriFx />}
              {charging && <ChidoriFx />}
              {(opened || gatedNow.has(card.uid)) && !dying && <GatesFx lasting={!opened} />}
              {opened && hit && (
                <b className="ar-gates-cost" aria-hidden>
                  −½ <HeartIcon />
                </b>
              )}
              {!!multiplied && (
                <b className={`ar-mult ${multiplied === 2 ? 'is-blue' : 'is-green'}`} aria-hidden>
                  ×{multiplied}
                </b>
              )}
              {warped && <RinneganFx />}
              {burning || melting ? <AmaterasuFx variant={AMA_STYLE} tone={toneOf(card.uid)} /> : burnNow.has(card.uid) && !dying && <AmaterasuFx variant={AMA_STYLE} lasting tone={toneOf(card.uid)} />}
              {blasted && <BlastFx />}
              {entombed && <Ward sand breaking={hit} />}
              {undone && <IzanagiFx />}
              {chainNow.has(card.uid) && !dying && <ChainsFx />}
              {awayNow.has(card.uid) && !dying && <i className="ar-void" aria-hidden />}
              {((charmed && (!now?.ability || now.ability === 'genjutsu' || now.ability === 'koto')) || (dazed && !now?.ability)) && <GenFx />}
              {charmed && now?.ability === 'dimension' && <RinneganFx />}
              {(charmed || dazed) && (
                <b className="ar-status-word" aria-hidden>
                  {t(charmWord ?? skipWord ?? (charmed ? 'arena.charm' : 'arena.dazed'))}
                </b>
              )}
              {sapped && (
                <b className="ar-sap" aria-hidden>
                  −1
                </b>
              )}
              {raging && (
                <b className="ar-rage" aria-hidden>
                  +1
                </b>
              )}
              {cursing && (
                <b className="ar-rage is-curse" aria-hidden>
                  +3
                </b>
              )}
              {mirrored && (
                <b className="ar-dodge-word is-mirror" aria-hidden>
                  {t('arena.mirrored')}
                </b>
              )}
              {countered && (
                <b className="ar-status-word is-counter" aria-hidden>
                  {t('arena.countered')}
                </b>
              )}
              {sealed && (
                <b className="ar-dodge-word is-sealed" aria-hidden>
                  {t('arena.sealed')}
                </b>
              )}
              {word && !charmed && !dazed && (
                <b className="ar-status-word is-tech" aria-hidden>
                  {t(word)}
                </b>
              )}
              {blocked && (
                <>
                  <Ward look={lastWard.get(card.uid)} breaking />
                  <b className="ar-dodge-word is-ward" aria-hidden>
                    {t('arena.wardHit')}
                  </b>
                </>
              )}
              {called && <i className="ar-poof" aria-hidden />}
              {risen && (
                <b className="ar-dodge-word is-risen" aria-hidden>
                  {t((now?.ability && RISEN[now.ability]) || 'arena.risen')}
                </b>
              )}
              {again && (
                <b className="ar-status-word is-again" aria-hidden>
                  {t('arena.strikeAgain')}
                </b>
              )}
              {mended && (
                <b className="ar-heal" aria-hidden>
                  +{now?.heals?.[card.uid]}
                  <HeartIcon />
                </b>
              )}
              {dozing && <GenFx />}
              {dozing && (
                <b className="ar-status-word" aria-hidden>
                  {t('arena.asleep')}
                </b>
              )}
              {chainNow.has(card.uid) && !dying && <b className="ar-bound-tag is-chain">{t('arena.chained')}</b>}
              {awayNow.has(card.uid) && !dying && <b className="ar-bound-tag is-away">{t('arena.banished')}</b>}
              {dazedNow.has(card.uid) && !dying && !chainNow.has(card.uid) && !awayNow.has(card.uid) && <b className="ar-bound-tag is-gen">{t('arena.charm')}</b>}
              {(boundNow.has(card.uid) || seized) && !dying && (
                <b className={`ar-bound-tag ${shadeNow.has(card.uid) || holdNow.has(card.uid) ? 'is-shadow' : ''}`}>{t(shadeNow.has(card.uid) ? 'arena.held' : holdNow.has(card.uid) ? 'arena.holding' : 'arena.asleep')}</b>
              )}
              {phasing && (
                <>
                  <b className="ar-dodge-word is-kamui" aria-hidden>
                    {t('arena.myth.kamui')}
                  </b>
                </>
              )}
              {sparking && (
                <span className="ar-spark" aria-hidden>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M18 4 L30 30 L22 32 L36 60 L28 61 L44 96" />
                    <path d="M82 6 L70 28 L78 31 L62 58 L71 60 L56 94" />
                    <path d="M50 0 L46 18 L54 20 L48 40" />
                  </svg>
                </span>
              )}
              {dodging && !phasing && !sparking && (
                <>
                  <i className="ar-poof" aria-hidden />
                  <img className="ar-log" src="/spells/kawarimi.webp" alt="" aria-hidden draggable={false} />
                  <b className="ar-dodge-word" aria-hidden>
                    {t('arena.dodgeHit')}
                  </b>
                </>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )

  const shopTop = view.tavernTier >= ARENA_TIERS
  const shopBar = () => (
    <div className="ar-shopbar">
      <span className="ar-shop-side is-left">
      <button
        type="button"
        className="ar-tool is-up"
        disabled={waiting || shopTop || view.coins < view.upCost}
        title={shopTop ? t('arena.tavernTop') : t('arena.upgrade', { n: view.tavernTier + 1 })}
        aria-label={shopTop ? t('arena.tavernTop') : t('arena.upgrade', { n: view.tavernTier + 1 })}
        onClick={() => send({ action: 'up' })}
      >
        <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
        </svg>
        <span>
          <UpIcon />
          {!shopTop && (
            <em className="ar-price">
              <i className="ar-coin" />
              {view.upCost}
            </em>
          )}
        </span>
      </button>

      <span className="ar-tier is-bar" title={t('arena.tavernLevel', { n: view.tavernTier })}>
        <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
        </svg>
        {Array.from({ length: ARENA_TIERS }, (_, i) => (
          <i key={i} className={i < view.tavernTier ? 'is-on' : ''} />
        ))}
      </span>
      </span>

      <Hero who="shop" name={t('arena.merchant')} pic={MERCHANT_PIC} />

      <span className="ar-shop-side is-right">

      <button
        type="button"
        className="ar-tool"
        disabled={waiting || view.coins < view.rollCost}
        title={t('arena.reroll')}
        aria-label={t('arena.reroll')}
        onClick={() => send({ action: 'roll' })}
      >
        <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
        </svg>
        <span>
          <RefreshIcon />
          <em className="ar-price">
            <i className="ar-coin" />
            {view.rollCost}
          </em>
        </span>
      </button>

      <button
        type="button"
        className={`ar-tool is-freeze ${view.frozen ? 'is-frozen' : ''}`}
        disabled={waiting}
        aria-pressed={!!view.frozen}
        title={t(view.frozen ? 'arena.unfreeze' : 'arena.freeze')}
        aria-label={t(view.frozen ? 'arena.unfreeze' : 'arena.freeze')}
        onClick={() => {
          setView((now) => (now ? { ...now, frozen: !now.frozen } : now))
          send({ action: 'freeze' })
        }}
      >
        <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
        </svg>
        <span>
          <SnowIcon />
        </span>
      </button>
      </span>
    </div>
  )

  const shop = () => (
    <div className="ar-shop-stack">
      <ul className={`ar-row is-shop ${view.frozen ? 'is-frozen' : ''}`}>
        {view.tavern.map((one, i) => {
          const nth = view.tavern.slice(0, i).filter((other) => other.id === one.id).length
          const poor = one.cost > view.coins
          const card: Card = { uid: `shop${i}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic, fury: one.fury, scorch: one.scorch, bomb: one.bomb, guard: one.guard }
          return (
            <li
              key={`${deal}:${one.id}:${nth}`}
              style={{ '--i': i, '--slot': i - (view.tavern.length - (view.spellOffer ? 0 : 1)) / 2, '--wait': `${dealWait}ms` } as CSSProperties}
              className={`is-held ${poor ? 'is-poor' : ''}`}
            >
              {!!one.skills?.length && (
                <span className="ar-skills is-shop">
                  {one.skills.map((skill) => (
                    <span
                      key={skill.key}
                      className="ar-skill is-static"
                      title={`${t(`arena.skill.${skill.key}` as UiKey)}: ${t(`arena.skill.${skill.key}.hint` as UiKey, { beast: (skill.beast && byId.get(skill.beast)?.name) || '' })}`}
                    >
                      <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
                        <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
                      </svg>
                      <i className="ar-orb is-full" />
                      <b>{skill.cost}</b>
                    </span>
                  ))}
                </span>
              )}
              <span className="ar-move" onPointerDown={poor ? undefined : take('shop', card, i)}>
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} taunt={one.taunt} cleave={one.cleave} shot={one.shot} charm={one.charm} sound={one.sound} poison={one.poison} medic={one.medic} fury={one.fury} scorch={one.scorch} bomb={one.bomb} guard={one.guard} frost={view.frozen} />
              </span>
            </li>
          )
        })}
        {view.spellOffer && (
          <li key={`spell${deal}`} style={{ '--i': view.tavern.length, '--slot': view.tavern.length / 2, '--wait': `${dealWait}ms` } as CSSProperties} className={`is-held is-spell ${view.spellOffer.cost > view.coins ? 'is-poor' : ''}`}>
            <span
              className="ar-move"
              onPointerDown={
                view.spellOffer.cost > view.coins
                  ? undefined
                  : take('shop', { uid: 'spell', id: 0, rarity: 'paper', atk: 0, hp: 0, max: 0, summon: false, spell: view.spellOffer.kind }, -1)
              }
            >
              <SpellFace kind={view.spellOffer.kind} cost={view.spellOffer.cost} />
            </span>
          </li>
        )}
      </ul>
      {leaving && (
        <ul className="ar-row is-shop is-old" aria-hidden>
          {leaving.map((one, i) => (
            <li key={`out${deal}:${i}`} style={{ '--j': leaving.length - i - (leavingSpell ? 0 : 1) } as CSSProperties}>
              <span className="ar-old">
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} taunt={one.taunt} cleave={one.cleave} shot={one.shot} charm={one.charm} sound={one.sound} poison={one.poison} medic={one.medic} fury={one.fury} scorch={one.scorch} bomb={one.bomb} guard={one.guard} />
              </span>
            </li>
          ))}
          {leavingSpell && (
            <li key={`out${deal}:spell`} style={{ '--j': 0 } as CSSProperties}>
              <span className="ar-old">
                <SpellFace kind={leavingSpell.kind} cost={leavingSpell.cost} />
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )

  return (
    <div className={`ar-stage ${stage.w < STAGE_W ? 'is-compact' : ''}`} style={{ '--stage-s': scale, '--stage-w': `${stage.w}px`, '--stage-h': `${stage.h}px`, '--dex': game.accent } as CSSProperties}>
    <div className={`ar ${dragging ? 'is-dragging' : ''} ${fight ? 'is-fighting' : ''} ${waitLeft !== null ? 'is-waiting' : ''}`} style={{ '--dex': game.accent } as CSSProperties} onPointerOver={peek} onPointerDown={press} onPointerMove={slide} onPointerUp={lift} onPointerCancel={lift} onPointerLeave={hideTip} onContextMenu={(event) => event.preventDefault()}>
      {demo === 'gallery' && (
        <nav className="ar-fx-pick">
          {SCENES.map(([key, label]) => (
            <button key={key} type="button" className={key === scene ? 'is-on' : ''} onClick={() => setScene(key)}>
              {t(label)}
            </button>
          ))}
        </nav>
      )}
      <svg className="ar-defs" aria-hidden>
        <filter id="ar-gen-melt">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="9">
            <animate attributeName="baseFrequency" dur="2.4s" values="0.02 0.06;0.03 0.08;0.02 0.06" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
        <filter id="ar-kamui-warp">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.04" numOctaves="2" seed="11">
            <animate attributeName="baseFrequency" dur="1.6s" values="0.015 0.04;0.025 0.06;0.015 0.04" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
        <filter id="ar-gen-warp">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="4">
            <animate attributeName="baseFrequency" dur="1.1s" values="0.02 0.05;0.035 0.09;0.02 0.05" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="14">
            <animate attributeName="scale" dur="1.1s" values="0;16;10;0" repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </svg>
      <div className="ar-top">
        <BackButton href={href.world(game.id)}>{l(game.label)}</BackButton>
        <span className="ar-top-gap" />
        <span className={`ar-chip ar-phase ${fight ? 'is-fight' : ''}`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
          </svg>
          <span>{t('arena.turn', { n: view.turn })}</span>
        </span>
        <button type="button" className="ar-chip ar-leave" onClick={() => send({ action: 'quit' }, true)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
          </svg>
          <span>{t('arena.quit')}</span>
        </button>
      </div>

      {done ? (
        <div className="ar-over">
          <b>{t(view.status === 'won' ? 'arena.won' : 'arena.lost')}</b>
          <div className="ar-score">
            <span>
              <small>{t('arena.you')}</small>
              <b>{view.hp}</b>
            </span>
            <i aria-hidden />
            <span>
              <small>{t('arena.foe')}</small>
              <b>{view.foeHp}</b>
            </span>
          </div>
          <button type="button" className="ar-chip ar-go" onClick={() => send({ action: 'start', game: gameId }, true)}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
            </svg>
            <span>{t('arena.again')}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="ar-crown">{fight ? <Hero who="foe" name={t('arena.foe')} hp={foeHp} struck={heroHit === 'foe'} /> : shopBar()}</div>

          <section className="ar-board">
            <div className="ar-half is-top">
              {fight ? (
                packed(theirs)
              ) : (
                <div data-zone="shop" className={`ar-sell ${selling ? 'is-selling' : ''} ${selling && over === 'shop' ? 'is-over' : ''}`}>
                  {shop()}
                </div>
              )}
            </div>
            <div className="ar-mid">
              <i className="ar-line" aria-hidden />
              {waitLeft !== null && (
                <span className="ar-chip ar-clock is-wait" title={t('arena.waiting')}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span>
                    {t('arena.waiting')}
                    <b>{waitLeft}</b>
                  </span>
                </span>
              )}
              {pledging && !fight && (
                <span className="ar-chip ar-pledge">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span>{t('arena.skill.sacrifice.pick')}</span>
                </span>
              )}
              {clock !== null && !fight && (
              <span className={`ar-chip ar-clock ${clock <= 5 ? 'is-late' : ''}`} title={t('arena.time')}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
                </svg>
                <span>
                  <ClockIcon />
                  <b>{clock}</b>
                </span>
              </span>
            )}
            </div>
            <div
              className="ar-half is-bot"
            >
              {fight ? (
                packed(mine)
              ) : (
                <div data-zone="slot" data-at={freeAt} className={`ar-sell is-drop ${boardOpen ? 'is-selling' : ''} ${boardOpen && over === 'slot' ? 'is-over' : ''}`}>
                <ul className="ar-row is-heroes">
                  {view.board.heroes.map((card, i) => (
                    <li key={card.uid} style={{ '--slot': i - (view.board.heroes.length - 1) / 2 } as CSSProperties} className={`${aimed === card.uid ? 'is-aimed' : ''} ${pledging && pledging !== card.uid ? 'is-pickable' : ''} ${view.board.heroes.some((one) => one.aim === card.uid && one.armed?.includes('sacrifice')) ? 'is-pledged' : ''}`}>
                      {!!card.skills?.length && (
                        <span className="ar-skills">
                          {card.skills.map((skill) => {
                            const on = !!card.armed?.includes(skill.key)
                            return (
                              <button
                                key={skill.key}
                                type="button"
                                className={`ar-skill ${on ? 'is-on' : ''}`}
                                disabled={!on && (view.chakra < skill.cost || armedCount >= ARENA_SKILL_CAP || callsOf(view.board) + (SLOTS_OF[skill.key] ?? 0) > ARENA_SUMMON_SLOTS)}
                                title={`${t(`arena.skill.${skill.key}` as UiKey)}: ${t(`arena.skill.${skill.key}.hint` as UiKey, { beast: (skill.beast && byId.get(skill.beast)?.name) || '' })}`}
                                aria-label={t(`arena.skill.${skill.key}` as UiKey)}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => (skill.key === 'sacrifice' && !on ? setPledging(pledging === card.uid ? null : card.uid) : toggleSkill(card.uid, skill.key))}
                              >
                                <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
                                  <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
                                </svg>
                                <i className="ar-orb is-full" />
                                <b>{skill.cost}</b>
                              </button>
                            )
                          })}
                        </span>
                      )}
                      {card.captain && <b className="ar-captain">{t('arena.captain')}</b>}
                      {cheer?.labels[card.uid] && (
                        <>
                          <b key={cheer.at} className="ar-cheer" aria-hidden>
                            {cheer.labels[card.uid]}
                          </b>
                          <i key={`f${cheer.at}`} className="ar-buff-flash" aria-hidden />
                        </>
                      )}
                      <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                        <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} fury={card.fury} scorch={card.scorch} bomb={card.bomb} guard={card.guard} dodge={card.dodge} clone={card.clone} boost={card.boost} />
                      </span>
                    </li>
                  ))}
                </ul>
                {view.board.summons.length > 0 && (
                <ul className="ar-row is-summons">
                  {Array.from({ length: ARENA_SUMMON_SLOTS }, (_, i) => {
                    const card = view.board.summons[i]
                    return card ? (
                      <li key={card.uid}>
                        <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                          <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} fury={card.fury} scorch={card.scorch} bomb={card.bomb} guard={card.guard} dodge={card.dodge} />
                        </span>
                      </li>
                    ) : (
                      <li key={`empty${i}`} className="is-empty">
                        <span className="ar-summon-slot">{t('arena.summonSlot')}</span>
                      </li>
                    )
                  })}
                </ul>
                )}
                </div>
              )}
            </div>
          </section>

          <div className="ar-foot">
            <div className={`ar-stock is-chakra ${fight ? 'is-hidden' : ''}`} aria-hidden={fight || undefined}>
              <span className="ar-purse is-chakra" aria-label={t('arena.chakra')} title={t('arena.chakra')}>
                <i className="ar-orb is-full" aria-hidden />
                <b>
                  {view.chakra}
                  <small>/{view.chakraMax}</small>
                </b>
              </span>
            </div>

            <div className="ar-me-spot">
              <Hero who="me" name={user?.nickname ?? ''} id={user?.id} avatar={user?.avatar} frame={user?.frame} hp={myHp} struck={heroHit === 'me'} />
            </div>

            <div className="ar-dock-right">
              <div className={`ar-stock is-coins ${fight ? 'is-hidden' : ''}`} aria-hidden={fight || undefined}>
              <span className="ar-purse is-coins" aria-label={t('arena.coins')} title={t('arena.coins')}>
                <i className="ar-coin is-full" aria-hidden />
                <b>
                  {view.coins}
                  <small>/{view.coinsMax}</small>
                </b>
              </span>
              </div>
            <div className={`ar-hand ${fight ? 'is-away' : ''}`}>
              <ul data-zone={buying ? 'hand' : undefined} className={`ar-hand-zone ${buying ? 'is-taking' : ''} ${buying && over === 'hand' ? 'is-over' : ''}`}>
                {view.hand.map((card, i) => (
                  <li key={card.uid} style={{ '--h': i - (view.hand.length - 1) / 2, '--h2': (i - (view.hand.length - 1) / 2) ** 2 } as CSSProperties}>
                    <span className="ar-move" onPointerDown={take('hand', card, i)}>
                      {card.spell ? (
                        <SpellFace kind={card.spell} />
                      ) : (
                        <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} fury={card.fury} scorch={card.scorch} bomb={card.bomb} guard={card.guard} dodge={card.dodge} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              </div>
          </div>
          </div>
        </>
      )}
      {!fight && !!view.discover?.length && (
        <div className="ar-discover" role="dialog" aria-label={t('arena.discover')}>
          <b className="ar-discover-head">{t('arena.discover')}</b>
          <small className="ar-discover-note">{t('arena.discover.note', { n: view.tavernTier })}</small>
          <ul>
            {view.discover.map((one, i) => (
              <li key={`${one.id}:${i}`} style={{ '--i': i } as CSSProperties}>
                <button type="button" className="ar-discover-pick" onClick={() => pickDiscover(i)}>
                  <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} taunt={one.taunt} cleave={one.cleave} shot={one.shot} charm={one.charm} sound={one.sound} poison={one.poison} medic={one.medic} fury={one.fury} scorch={one.scorch} bomb={one.bomb} guard={one.guard} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
      <button type="button" className={`ar-book ${bonusOpen ? 'is-open' : ''}`} aria-label={t('arena.synergy')} onClick={() => (bonusOpen ? closeBonus() : setBonusOpen(true))}>
        <BookIcon />
      </button>
      {bonusOpen && (
        <>
        <div className={`ar-synergy-shade ${bonusLeaving ? 'is-leaving' : ''}`} role="presentation" onClick={closeBonus} />
        <aside className={`ar-synergy ${bonusLeaving ? 'is-leaving' : ''}`} aria-label={t('arena.synergy')}>
        <button type="button" className="ar-synergy-x" aria-label={t('dex.close')} onClick={closeBonus}>
          <CloseIcon />
        </button>
          <svg className="ar-synergy-paper" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polygon points={SHEET_POINTS} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="ar-synergy-scroll">
          {!!view.clans?.length && (
            <div className="ar-synergy-match">
              <b>{t('arena.matchClans')}</b>
              <span>
                {Object.keys(ARENA_CLANS).map((one) => {
                  const live = view.clans!.includes(one)
                  return (
                    <i key={one} className={live ? 'is-live' : 'is-out'} title={live ? undefined : t('arena.clanOut')}>
                      {t(`arena.clan.${one}` as UiKey)}
                    </i>
                  )
                })}
              </span>
            </div>
          )}
          <span className="ar-synergy-top">
            <b className="ar-synergy-head">{t('arena.synergy')}</b>
            <small className="ar-synergy-note">{t('arena.synergy.from')}</small>
          </span>
          {view.synergy?.length || view.crew?.captain || view.crew?.teams.length ? (
            <ul>
              {view.crew?.captain && (
                <li className="is-captain is-on">
                  <span className="ar-synergy-name">
                    <em>{t('arena.captain')}</em>
                    <strong className="ar-synergy-who">{(byId.get(view.crew.captain.id)?.name ?? '').split(' ')[0]}</strong>
                  </span>
                  <small>{captainText(view.crew.captain.scope, view.crew.captain.atk, view.crew.captain.hp)}</small>
                </li>
              )}
              {(view.synergy ?? []).map((one) => (
                <li key={one.clan} data-clan={one.clan} className={one.count >= one.need ? 'is-on' : ''}>
                  <span className="ar-synergy-name">
                    <em>{t(`arena.clan.${one.clan}` as UiKey)}</em>
                    <b>
                      {Math.min(one.count, one.cap)}/{one.cap}
                    </b>
                  </span>
                  <span className="ar-synergy-bar" aria-hidden>
                    {Array.from({ length: one.cap }, (_, i) => (
                      <i key={i} className={i < one.count ? 'is-full' : ''} />
                    ))}
                  </span>
                  <small>{[t(`arena.tip.clan.${one.clan}` as UiKey), clanExtra(one.clan)].filter(Boolean).join(' ')}</small>
                </li>
              ))}
              {(view.crew?.teams ?? []).map((one) => (
                <li key={one.key} className={`is-team ${one.on ? 'is-on' : ''}`}>
                  <span className="ar-synergy-name">
                    <em>{t(`arena.team.${one.key}` as UiKey)}</em>
                    <b>
                      {one.have}/{one.ids.length}
                    </b>
                  </span>
                  <span className="ar-synergy-bar" aria-hidden>
                    {one.ids.map((id, i) => (
                      <i key={id} className={i < one.have ? 'is-full' : ''} />
                    ))}
                  </span>
                  <small>
                    {t('arena.tip.team', { names: namesOf(one.ids), stats: statsText(one.atk, one.hp) })}
                    {!one.on && one.have === one.ids.length && ` ${t('arena.crew.apart')}`}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ar-synergy-none">{t('arena.synergy.none')}</p>
          )}
            </div>
        </aside>
        </>
      )}
      <div className="ar-rotate" aria-live="polite">
        <svg viewBox="0 0 64 64" aria-hidden>
          <g className="is-phone">
            <rect x="21" y="12" width="22" height="40" rx="4" />
            <path d="M29 47 H 35" />
          </g>
        </svg>
        <b>{t('arena.rotate')}</b>
        <span>{t('arena.rotateHint')}</span>
      </div>
      {tip && !dragging && (
        <div ref={tipBox} className="ar-tip" style={{ left: tip.x, top: tip.y, width: TIP_W }} aria-hidden>
          <svg className="ar-tip-paper" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={SHEET_POINTS} vectorEffect="non-scaling-stroke" />
          </svg>
          <b className="ar-tip-name">{byId.get(tip.info.id)?.name}</b>
          <small className="ar-tip-class">{t(tip.info.shot ? 'arena.ranged' : 'arena.melee')}</small>
          <ul>
            {tipLines(tip.info).map((line, i) =>
              line.kind === 'extra' ? (
                <li key={i} className="is-extra">
                  <b>{line.head}</b> {line.text}
                </li>
              ) : (
                <li key={i} className={line.on === false ? 'is-locked' : ''}>
                  {line.need && <small className={`ar-tip-need is-${line.need}`}>{t(`card.rarity.${line.need}` as UiKey)}</small>}
                  <span>
                    <b className="ar-tip-head">{line.head}</b>
                    {line.cost !== undefined && (
                      <span className="ar-tip-cost">
                        <i className="ar-orb is-full" />
                        {line.cost}
                      </span>
                    )}
                    {' — '}
                    {line.text}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
