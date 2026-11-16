'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ARENA_CARD_COST, ARENA_CHAKRA_MAX, ARENA_COIN_MAX, ARENA_HERO_SLOTS, ARENA_SELL_BACK, ARENA_SUMMON_SLOTS, ARENA_TIERS } from '@nanda/game'
import { api } from './api'
import { ArenaFace, type ArenaView, type Card, type Side } from './ArenaCard'
import { BADGE_POINTS } from './DexCard'
import Avatar from './Avatar'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
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
  const top = 45 + next() * 10
  const bottom = top + (next() - 0.5) * 8
  const cut: [number, number][] = []
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const share = i / steps
    const x = top + (bottom - top) * share + (next() - 0.5) * 7 + (i % 2 ? 2 : -2)
    cut.push([x, -15 + share * 130])
  }
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',')
  const lean = (bottom - top) / 130
  return {
    left: `polygon(-30% -15%, ${pts(cut)}, -30% 115%)`,
    right: `polygon(${pts(cut)}, 130% 115%, 130% -15%)`,
    lean: Math.max(-0.8, Math.min(0.8, lean)),
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
  const [lead, setLead] = useState(false)

  const [waiting, setWaiting] = useState(false)
  const [clock, setClock] = useState<number | null>(null)
  const [dragging, setDragging] = useState<Kind | null>(null)
  const [over, setOver] = useState<Spot['zone'] | null>(null)
  const [deal, setDeal] = useState(0)
  const [seenOffers, setSeenOffers] = useState('')
  const [dealWait, setDealWait] = useState(0)
  const [seenTavern, setSeenTavern] = useState<ArenaView['tavern']>([])
  const [leaving, setLeaving] = useState<ArenaView['tavern'] | null>(null)
  const overNow = useRef<Spot['zone'] | null>(null)
  const hold = useRef<Hold | null>(null)

  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const beats = useRef<ArenaView['steps']>([])

  const byId = useMemo(() => new Map((game?.entities ?? []).map((one) => [one.id, one])), [game, ready])

  const load = useCallback(async () => {
    const { data } = await api<{ arena?: ArenaView | null }>('arena')
    const now = data.arena ?? (await api<{ arena?: ArenaView | null }>('arena', { action: 'start', game: gameId })).data.arena ?? null
    setView(now)
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
      setView((now) => {
        if (!now || now.coins < ARENA_CARD_COST || !now.tavern[at]) return now
        const one = now.tavern[at]!
        const card: Card = { uid: `${now.seq + 1}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier }
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
    if (fresh) {
      setDeal((was) => was + 1)
      setLeaving(seenTavern.length ? seenTavern : null)
      setDealWait(seenTavern.length ? LEAVE_MS + (seenTavern.length - 1) * LEAVE_STEP_MS : 0)
    }
  }

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS + leaving.length * LEAVE_STEP_MS + 40)
    return () => window.clearTimeout(timer)
  }, [leaving])

  const finishing = useRef(finish)
  finishing.current = finish

  const recruiting = !!view && view.status === 'playing' && !fight
  const turn = view?.turn
  const turnSec = view?.turnSec ?? 30
  useEffect(() => {
    if (!recruiting) {
      setClock(null)
      return
    }
    const ends = Date.now() + turnSec * 1000
    setClock(turnSec)
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((ends - Date.now()) / 1000))
      setClock(left)
      if (left <= 0) {
        window.clearInterval(tick)
        finishing.current()
      }
    }, 250)
    return () => window.clearInterval(tick)
  }, [recruiting, turn, turnSec])

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

    if (movers.length && aim) {
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
      }, GAP_MS + (died ? DEATH_MS : 0))
    }

    if (run) run.addEventListener('finish', done)
    else next = setTimeout(done, FLY_MS)

    return () => {
      clearTimeout(land)
      if (next) clearTimeout(next)
      for (const play of plays) play.cancel()
      clear()
    }
  }, [fight, step, lead])

  const take = (kind: Kind, card: Card, at: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || fight || waiting) return
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
        else if (one.kind === 'hand') play(one.uid)
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
  }, [place, buy, play, sell, shift])

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
  if (at >= 0) for (const one of state ? [...state.mine, ...state.theirs] : [...line(view.board), ...line(view.foeBoard)]) health.set(one.uid, one.hp)
  const before = at > 0 ? steps[at - 1]! : null
  const standing = new Set((before ? [...before.mine, ...before.theirs] : [...line(view.board), ...line(view.foeBoard)]).map((one) => one.uid))
  const heroHit = hit && now && !now.to ? (now.foe ? 'me' : 'foe') : null

  const mine = at >= 0 ? line(view.board) : line(view.board)
  const theirs = at >= 0 ? line(view.foeBoard) : line(view.foeBoard)
  const myHp = state ? state.hp : at >= 0 ? (view.opened?.hp ?? view.hp) : view.hp
  const foeHp = state ? state.foeHp : at >= 0 ? (view.opened?.foeHp ?? view.foeHp) : view.foeHp
  const freeAt = view.board.heroes.length < ARENA_HERO_SLOTS ? view.board.heroes.length : -1
  const selling = dragging === 'board' || dragging === 'hand'
  const buying = dragging === 'shop'

  const packed = (cards: Card[]) => (
    <ul className="ar-row is-packed">
      {cards.map((card) => {
        const hp = health.get(card.uid)
        const dying = hit && hp === undefined && standing.has(card.uid)
        const gone = at >= 0 && hp === undefined && !dying
        const struck = hit && now?.to === card.uid
        const face = (
          <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={Math.max(0, hp ?? 0)} summon={card.summon} triple={card.triple} tier={card.tier} />
        )
        const clips = dying ? tearOf(seedOf(card.uid)) : null
        const cut = struck && !dying ? cutOf(seedOf(card.uid)) : null
        return (
          <li key={card.uid} className={`is-held ${gone ? 'is-out' : ''} ${dying ? 'is-dying' : ''}`}>
            <span data-uid={card.uid} className={`ar-move ${struck ? 'is-struck' : ''}`}>
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
                <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={Math.max(0, hp ?? card.hp)} summon={card.summon} triple={card.triple} tier={card.tier} />
              )}
              {struck && <Slash seed={seedOf(card.uid)} />}
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
          const card: Card = { uid: `shop${i}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier }
          return (
            <li
              key={`${deal}:${one.id}:${nth}`}
              style={{ '--i': i, '--wait': `${dealWait}ms` } as CSSProperties}
              className={`is-held ${poor ? 'is-poor' : ''}`}
            >
              <span className="ar-move" onPointerDown={poor ? undefined : take('shop', card, i)}>
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} />
              </span>
            </li>
          )
        })}
      </ul>
      {leaving && (
        <ul className="ar-row is-shop is-old" aria-hidden>
          {leaving.map((one, i) => (
            <li key={`out${deal}:${i}`} style={{ '--j': leaving.length - 1 - i } as CSSProperties}>
              <span className="ar-old">
                <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className={`ar ${dragging ? 'is-dragging' : ''} ${fight ? 'is-fighting' : ''}`} style={{ '--dex': game.accent } as CSSProperties}>
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
                <div data-zone="slot" data-at={freeAt} className={`ar-sell is-drop ${dragging === 'hand' || dragging === 'shop' ? 'is-selling' : ''} ${(dragging === 'hand' || dragging === 'shop') && over === 'slot' ? 'is-over' : ''}`}>
                <ul className="ar-row is-heroes">
                  {view.board.heroes.map((card, i) => (
                    <li key={card.uid}>
                      <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                        <ArenaFace game={game.id} entity={byId.get(card.id)} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} />
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
                          <ArenaFace game={game.id} entity={byId.get(card.id)} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} />
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
                      <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} />
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
