'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ARENA_CARD_COST, ARENA_CHAKRA_MAX, ARENA_COIN_MAX, ARENA_HERO_SLOTS, ARENA_SELL_BACK, ARENA_SUMMON_SLOTS, ARENA_TIERS } from '@nanda/game'
import { api } from './api'
import { ArenaFace, SpellFace, type ArenaView, type Card, type Side } from './ArenaCard'
import { BADGE_POINTS } from './DexCard'
import Avatar from './Avatar'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { ClockIcon, HeartIcon, RefreshIcon, UpIcon } from './icons'
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

const Wound = ({ a, b }: { a: number; b: number }) => (
  <svg className="ar-wound" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
    <line className="is-gash" x1="-4" y1={a} x2="104" y2={b} />
    <line className="is-core" x1="-4" y1={a} x2="104" y2={b} />
    {Array.from({ length: 8 }, (_, i) => {
      const x = 6 + i * 12.5
      const y = a + ((b - a) * (x + 4)) / 108
      return <circle key={i} className="is-spark" cx={x} cy={y} r="1.6" style={{ '--x': `${(i % 2 ? 1 : -1) * (6 + i)}px`, '--y': `${-5 - i}px`, animationDelay: `${i * 0.02}s` } as CSSProperties} />
    })}
  </svg>
)

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
type Cell = { node: HTMLElement; mid: number }
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
  aim: string | null
}

const line = (side: Side) => [...side.heroes, ...side.summons]

const split = (cards: Card[]): Side => ({ heroes: cards.filter((one) => !one.summon), summons: cards.filter((one) => one.summon) })

const roomOf = (summon: boolean) => (summon ? ARENA_SUMMON_SLOTS : ARENA_HERO_SLOTS)

const ZONE_SHARE = 0.18

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

function Hero({ who, name, id, avatar, frame, hp, struck }: { who: 'me' | 'foe'; name: string; id?: string; avatar?: string | null; frame?: string | null; hp: number; struck?: boolean }) {
  return (
    <div data-hero={who} className={`ar-me is-${who} ${struck ? 'is-struck' : ''}`}>
      <span className="ar-me-ring">
        <Avatar id={id} name={name} avatar={avatar} frame={frame} className="ar-me-face" />
      </span>
      <span className="ar-me-hp">
        <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={BADGE_POINTS} />
        </svg>
        <HeartIcon />
        <b>{hp}</b>
      </span>
    </div>
  )
}

export default function ArenaGame({ game: gameId }: { game: string }) {
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

  const [waiting, setWaiting] = useState(false)
  const [clock, setClock] = useState<number | null>(null)
  const [waitLeft, setWaitLeft] = useState<number | null>(null)
  const skew = useRef(0)
  const [dragging, setDragging] = useState<Kind | null>(null)
  const [over, setOver] = useState<Spot['zone'] | null>(null)
  const [aimed, setAimed] = useState<string | null>(null)
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

  useEffect(() => {
    if (user) void load()
    else if (!loading) setChecked(true)
  }, [user, loading, load])

  const send = useCallback(
    (body: Record<string, unknown>, slow = false, after?: (next: ArenaView) => void) => {
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
    [go, href, gameId],
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
        const card: Card = { uid: `${now.seq + 1}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic }
        return { ...now, seq: now.seq + 1, coins: now.coins - ARENA_CARD_COST, hand: [...now.hand, card], tavern: now.tavern.filter((_, i) => i !== at) }
      })
      send({ action: 'buy', at })
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
        if (line(now.board).some((one) => one.uid === target && (one.dodge ?? 0) > 0)) return now
        const bless = (list: Card[]) => list.map((one) => (one.uid === target ? { ...one, dodge: 1 } : one))
        return { ...now, hand: now.hand.filter((one) => one.uid !== uid), board: { heroes: bless(now.board.heroes), summons: bless(now.board.summons) } }
      })
      send({ action: 'cast', uid, target })
    },
    [send],
  )

  const toggleSkill = useCallback(
    (uid: string, key: string) => {
      setView((now) => {
        if (!now) return now
        const card = line(now.board).find((one) => one.uid === uid)
        const skill = card?.skills?.find((one) => one.key === key)
        if (!card || !skill) return now
        const armed = card.armed ?? []
        const on = armed.includes(key)
        if (!on && now.chakra < skill.cost) return now
        const next = on ? armed.filter((one) => one !== key) : [...armed, key]
        const swap = (list: Card[]) => list.map((one) => (one.uid === uid ? { ...one, armed: next } : one))
        return {
          ...now,
          chakra: on ? Math.min(now.chakra + skill.cost, now.chakraMax) : now.chakra - skill.cost,
          board: { heroes: swap(now.board.heroes), summons: swap(now.board.summons) },
        }
      })
      send({ action: 'ability', uid, key })
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
        finishing.current()
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

    const land = setTimeout(() => setHit(true), IMPACT_MS)
    let next: ReturnType<typeof setTimeout> | undefined
    let zone: HTMLElement | null = null
    const plays: Animation[] = []

    const extra: HTMLElement[] = []
    if (one.charm || one.skip) {
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
      plays.push(
        movers[0]!.animate(
          [{ transform: 'none' }, { transform: `translate(${-Math.sign(dx) * 4}px, ${-Math.sign(dy) * 8}px) scale(0.97)`, offset: 0.3 }, { transform: 'none' }],
          { duration: FLY_MS, easing: 'ease-out' },
        ),
      )
    } else if (movers.length && aim) {
      const b = aim.getBoundingClientRect()
      zone = movers[0]!.closest<HTMLElement>('.ar-half')
      if (zone) zone.style.zIndex = '7'
      for (const node of movers) {
        const a = node.getBoundingClientRect()
        const dx = Math.round(b.left + b.width / 2 - (a.left + a.width / 2))
        const dy = Math.round(b.top + b.height / 2 - (a.top + a.height / 2))
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
      }, GAP_MS + (died ? DEATH_MS : 0) + (one.heals ? HEAL_HOLD_MS : 0))
    }

    if (run) run.addEventListener('finish', done)
    else next = setTimeout(done, FLY_MS)

    return () => {
      clearTimeout(land)
      if (next) clearTimeout(next)
      for (const play of plays) play.cancel()
      for (const node of extra) node.remove()
      clear()
    }
  }, [fight, step, lead])

  const take = (kind: Kind, card: Card, at: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || fight || waiting || waitLeft !== null) return
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
      if (one.kind === 'hand' && one.slot >= 0) dx = i < one.slot ? -one.span / 2 : one.span / 2
      cell.node.style.translate = dx ? `${Math.round(dx)}px 0` : ''
    }
  }, [])

  useEffect(() => {
    const begin = (one: Hold) => {
      one.live = true
      one.cells = [...document.querySelectorAll<HTMLElement>(`.ar-half.is-bot .ar-row.${one.summon ? 'is-summons' : 'is-heroes'} [data-uid]`)].map((node) => {
        const box = node.getBoundingClientRect()
        return { node, mid: box.left + box.width / 2 }
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
      const nodes = [one.node, ...one.cells.map((cell) => cell.node)]
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
      one.node.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`
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
      if (one.kind === 'hand' && one.spell) {
        const spot = [...document.querySelectorAll<HTMLElement>('.ar-half.is-bot .ar-row [data-uid]')].find((node) => {
          const room = node.getBoundingClientRect()
          const midY = box.top + box.height / 2
          return centre >= room.left && centre <= room.right && midY >= room.top && midY <= room.bottom
        })
        const board = viewNow.current?.board
        const taken = !!spot && !!board && line(board).some((one) => one.uid === spot.dataset.uid && (one.dodge ?? 0) > 0)
        const aim = taken ? null : (spot?.dataset.uid ?? null)
        if (aim !== one.aim) {
          one.aim = aim
          setAimed(aim)
        }
        return
      }
      if (one.kind === 'hand') {
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

    const up = () => {
      const one = hold.current
      hold.current = null
      if (!one) return
      if (!one.live) {
        if (one.kind === 'shop') buy(one.at)
        else if (one.kind === 'hand' && !one.spell) play(one.uid)
        return
      }
      if (one.kind === 'hand' && one.spell) {
        setAimed(null)
        if (one.aim) cast(one.uid, one.aim)
        requestAnimationFrame(() => clean(one))
        return
      }
      const over = spotOf(one.node)
      overNow.current = null
      setOver(null)
      if (one.kind === 'board') {
        if (over?.zone === 'shop') sell(one.uid)
        else if (one.to >= 0 && one.to !== one.from) shift(one.uid, one.to)
      } else if (one.kind === 'hand') {
        if (over?.zone === 'shop') sell(one.uid)
        else if (over?.zone === 'slot') play(one.uid, one.slot)
      } else if (over?.zone === 'hand' || over?.zone === 'slot') {
        buy(one.at)
      }
      requestAnimationFrame(() => clean(one))
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [place, buy, play, sell, shift, cast])

  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  if (!checked || !ready) return <p className="ar-note">{t('arena.loading')}</p>
  if (!user?.admin) return <div className="card center muted">{t('err.not_found')}</div>
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
  const power = new Map<string, number>()
  if (at >= 0) {
    for (const one of state ? [...state.mine, ...state.theirs] : [...line(view.board), ...line(view.foeBoard)]) {
      const late = hit && !healing ? (now?.heals?.[one.uid] ?? 0) : 0
      health.set(one.uid, one.hp - late)
    }
    if (state) for (const one of [...state.mine, ...state.theirs]) {
      guard.set(one.uid, one.dodge ?? 0)
      power.set(one.uid, one.atk)
    }
    else for (const uid of view.armed ?? []) guard.set(uid, 1)
  }
  const before = at > 0 ? steps[at - 1]! : null
  const standing = new Set((before ? [...before.mine, ...before.theirs] : [...line(view.board), ...line(view.foeBoard)]).map((one) => one.uid))
  const heroHit = hit && now && !now.to ? (now.foe ? 'me' : 'foe') : null

  const mine = at >= 0 ? line(view.board) : line(view.board)
  const theirs = at >= 0 ? line(view.foeBoard) : line(view.foeBoard)
  const myHp = state ? state.hp : at >= 0 ? (view.opened?.hp ?? view.hp) : view.hp
  const foeHp = state ? state.foeHp : at >= 0 ? (view.opened?.foeHp ?? view.foeHp) : view.foeHp
  const freeAt = view.board.heroes.length < ARENA_HERO_SLOTS ? view.board.heroes.length : -1
  const selling = (dragging === 'board' || dragging === 'hand') && !spelling
  const buying = dragging === 'shop'

  const packed = (cards: Card[]) => (
    <ul className="ar-row is-packed">
      {cards.map((card) => {
        const hp = health.get(card.uid)
        const dying = hit && hp === undefined && standing.has(card.uid)
        const gone = at >= 0 && hp === undefined && !dying
        const dodging = hit && !!now?.dodged?.includes(card.uid)
        const charmed = hit && !!now?.charm && now.to === card.uid
        const dazed = hit && !!now?.skip && now.from === card.uid
        const sapped = hit && !!now?.sapped?.includes(card.uid)
        const mended = hit && healing && !!now?.heals?.[card.uid]
        const helping = hit && healing && !!card.medic && !!now?.heals && Object.keys(now.heals).some((uid) => cards.some((one) => one.uid === uid) && uid !== card.uid)
        const struck = hit && !dodging && (now?.to === card.uid || !!now?.splash?.includes(card.uid))
        const face = (
          <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={power.get(card.uid) ?? card.atk} hp={Math.max(0, hp ?? 0)} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} dodge={guard.get(card.uid) ?? card.dodge} />
        )
        const clips = dying ? tearOf(seedOf(card.uid)) : null
        const cut = struck && !dying ? cutOf(seedOf(card.uid)) : null
        return (
          <li key={card.uid} className={`is-held ${gone ? 'is-out' : ''} ${dying ? 'is-dying' : ''}`}>
            <span data-uid={card.uid} className={`ar-move ${mended ? 'is-mended' : ''} ${helping ? 'is-helping' : ''} ${struck ? 'is-struck' : ''} ${dodging ? 'is-dodging' : ''} ${charmed ? 'is-charmed' : ''} ${dazed ? 'is-dazed' : ''} ${struck && now?.venom ? 'is-venom' : ''}`}>
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
                <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={power.get(card.uid) ?? card.atk} hp={Math.max(0, hp ?? card.hp)} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} dodge={guard.get(card.uid) ?? card.dodge} />
              )}
              {struck && <Slash seed={seedOf(card.uid)} />}
              {(charmed || dazed) && <i className="ar-spiral" aria-hidden />}
              {(charmed || dazed) && (
                <b className="ar-status-word" aria-hidden>
                  {t(charmed ? 'arena.charm' : 'arena.dazed')}
                </b>
              )}
              {sapped && (
                <b className="ar-sap" aria-hidden>
                  −1
                </b>
              )}
              {mended && (
                <b className="ar-heal" aria-hidden>
                  +{now?.heals?.[card.uid]}
                  <HeartIcon />
                </b>
              )}
              {dodging && (
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
    </div>
  )

  const shop = () => (
    <div className="ar-shop-stack">
      <ul className="ar-row is-shop">
        {view.tavern.map((one, i) => {
          const nth = view.tavern.slice(0, i).filter((other) => other.id === one.id).length
          const poor = one.cost > view.coins
          const card: Card = { uid: `shop${i}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier, taunt: one.taunt, cleave: one.cleave, shot: one.shot, charm: one.charm, sound: one.sound, poison: one.poison, medic: one.medic }
          return (
            <li
              key={`${deal}:${one.id}:${nth}`}
              style={{ '--i': i, '--wait': `${dealWait}ms` } as CSSProperties}
              className={`is-held ${poor ? 'is-poor' : ''}`}
            >
              <span className="ar-move" onPointerDown={poor ? undefined : take('shop', card, i)}>
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} taunt={one.taunt} cleave={one.cleave} shot={one.shot} charm={one.charm} sound={one.sound} poison={one.poison} medic={one.medic} />
              </span>
            </li>
          )
        })}
        {view.spellOffer && (
          <li key={`spell${deal}`} style={{ '--i': view.tavern.length, '--wait': `${dealWait}ms` } as CSSProperties} className={`is-held is-spell ${view.spellOffer.cost > view.coins ? 'is-poor' : ''}`}>
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
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} taunt={one.taunt} cleave={one.cleave} shot={one.shot} charm={one.charm} sound={one.sound} poison={one.poison} medic={one.medic} />
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
    <div className={`ar ${dragging ? 'is-dragging' : ''} ${fight ? 'is-fighting' : ''} ${waitLeft !== null ? 'is-waiting' : ''}`} style={{ '--dex': game.accent } as CSSProperties}>
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
                <div data-zone="slot" data-at={freeAt} className={`ar-sell is-drop ${(dragging === 'hand' && !spelling) || dragging === 'shop' ? 'is-selling' : ''} ${((dragging === 'hand' && !spelling) || dragging === 'shop') && over === 'slot' ? 'is-over' : ''}`}>
                <ul className="ar-row is-heroes">
                  {view.board.heroes.map((card, i) => (
                    <li key={card.uid} className={aimed === card.uid ? 'is-aimed' : ''}>
                      {!!card.skills?.length && (
                        <span className="ar-skills">
                          {card.skills.map((skill) => {
                            const on = !!card.armed?.includes(skill.key)
                            return (
                              <button
                                key={skill.key}
                                type="button"
                                className={`ar-skill ${on ? 'is-on' : ''}`}
                                disabled={!on && view.chakra < skill.cost}
                                title={`${t(`arena.skill.${skill.key}` as UiKey)}: ${t(`arena.skill.${skill.key}.hint` as UiKey)}`}
                                aria-label={t(`arena.skill.${skill.key}` as UiKey)}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => toggleSkill(card.uid, skill.key)}
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
                      <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                        <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} dodge={card.dodge} />
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
                          <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} dodge={card.dodge} />
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
            <div className={`ar-hand ${fight ? 'is-away' : ''}`}>
              {fight && user && <Hero who="me" name={user.nickname} id={user.id} avatar={user.avatar} frame={user.frame} hp={myHp} struck={heroHit === 'me'} />}
              <ul data-zone={buying ? 'hand' : undefined} className={`ar-hand-zone ${buying ? 'is-taking' : ''} ${buying && over === 'hand' ? 'is-over' : ''}`}>
                {view.hand.map((card, i) => (
                  <li key={card.uid}>
                    <span className="ar-move" onPointerDown={take('hand', card, i)}>
                      {card.spell ? (
                        <SpellFace kind={card.spell} />
                      ) : (
                        <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} taunt={card.taunt} cleave={card.cleave} shot={card.shot} charm={card.charm} sound={card.sound} poison={card.poison} medic={card.medic} dodge={card.dodge} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ar-side">
              <div className="ar-purse is-coins">
                <span className="ar-purse-head">
                  <small>{t('arena.coins')}</small>
                  <b>
                    {view.coins} / {view.coinsMax}
                  </b>
                </span>
                <span className="ar-purse-row" aria-hidden>
                  {Array.from({ length: ARENA_COIN_MAX }, (_, i) => (
                    <i key={i} className={`ar-coin ${i < view.coins ? 'is-full' : i < view.coinsMax ? 'is-spent' : ''}`} />
                  ))}
                </span>
              </div>
              <div className="ar-purse is-chakra">
                <span className="ar-purse-head">
                  <small>{t('arena.chakra')}</small>
                  <b>
                    {view.chakra} / {view.chakraMax}
                  </b>
                </span>
                <span className="ar-purse-row" aria-hidden>
                  {Array.from({ length: ARENA_CHAKRA_MAX }, (_, i) => (
                    <i key={i} className={`ar-orb ${i < view.chakra ? 'is-full' : i < view.chakraMax ? 'is-spent' : ''}`} />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
