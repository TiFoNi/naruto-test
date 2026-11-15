'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ARENA_CARD_COST, ARENA_CHAKRA_MAX, ARENA_HERO_SLOTS, ARENA_SELL_BACK, ARENA_SUMMON_SLOTS, ARENA_TIERS } from '@nanda/game'
import { api } from './api'
import { ArenaFace, type ArenaView, type Card, type Side } from './ArenaCard'
import { BADGE_POINTS } from './DexCard'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { RefreshIcon, UpIcon } from './icons'
import BackButton from './BackButton'
import { tornPoints } from './torn'
import { useHref, useNavigate } from './router'

const SLOTS = ARENA_HERO_SLOTS + ARENA_SUMMON_SLOTS
const GRAB_PX = 5

const CHIP = tornPoints(24, 7, 6)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

const FLY_MS = 1100
const IMPACT_MS = 470
const GAP_MS = 260

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
}

const line = (side: Side) => [...side.heroes, ...side.summons]

const split = (cards: Card[]): Side => ({ heroes: cards.filter((one) => !one.summon), summons: cards.filter((one) => one.summon) })

const spotAt = (x: number, y: number): Spot | null => {
  for (const node of document.elementsFromPoint(x, y)) {
    const zone = (node as HTMLElement).dataset?.zone
    if (zone === 'shop' || zone === 'hand' || zone === 'slot') return { zone, at: Number((node as HTMLElement).dataset.at ?? -1) }
  }
  return null
}

function Plate({ mark, name, hp, foe }: { mark: string; name: string; hp: number; foe?: boolean }) {
  return (
    <div data-hero={foe ? 'foe' : 'me'} className={`ar-hero ${foe ? 'is-foe' : ''}`}>
      <span className="ar-hero-face" aria-hidden>
        {mark}
      </span>
      <b>{name}</b>
      <span className="ar-hero-hp">{hp}</span>
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
  const hold = useRef<Hold | null>(null)

  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const beats = useRef<ArenaView['steps']>([])

  const byId = useMemo(() => new Map((game?.entities ?? []).map((one) => [one.id, one])), [game, ready])

  const load = useCallback(async () => {
    const { data } = await api<{ arena?: ArenaView | null }>('arena')
    setView(data.arena ?? null)
    setChecked(true)
  }, [])

  useEffect(() => {
    if (user) void load()
    else if (!loading) setChecked(true)
  }, [user, loading, load])

  const send = useCallback(
    (body: Record<string, unknown>, slow = false, after?: (next: ArenaView) => void) => {
      if (slow) setWaiting(true)
      queue.current = queue.current
        .then(async () => {
          const { data } = await api<{ arena?: ArenaView | null }>('arena', body)
          if (data.arena === null) return go(href.bestiary(gameId as GameId))
          if (data.arena) {
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
        if (!now || now.chakra < ARENA_CARD_COST || !now.tavern[at]) return now
        const one = now.tavern[at]!
        const card: Card = { uid: `new${at}:${now.turn}:${now.hand.length}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier }
        return { ...now, chakra: now.chakra - ARENA_CARD_COST, hand: [...now.hand, card], tavern: now.tavern.filter((_, i) => i !== at) }
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
        const cards = line(now.board)
        if (!card || cards.length >= SLOTS) return now
        const next = [...cards]
        next.splice(at < 0 ? next.length : Math.min(at, next.length), 0, card)
        return { ...now, hand: now.hand.filter((one) => one.uid !== uid), board: split(next) }
      })
      send({ action: 'play', uid })
      if (at >= 0) send({ action: 'move', uid, at })
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
          chakra: Math.min(now.chakra + ARENA_SELL_BACK, ARENA_CHAKRA_MAX),
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
        const cards = line(now.board)
        const from = cards.findIndex((one) => one.uid === uid)
        if (from < 0 || from === at) return now
        const next = [...cards]
        const [card] = next.splice(from, 1)
        next.splice(Math.min(at, next.length), 0, card!)
        return { ...now, board: split(next) }
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
      }, GAP_MS)
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
      one.cells = [...document.querySelectorAll<HTMLElement>('.ar-half.is-bot .ar-row [data-uid]')].map((node) => {
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
      const over = spotAt(event.clientX, event.clientY)
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
        if (over?.zone === 'slot' && one.cells.length < SLOTS) {
          slot = one.cells.filter((cell) => cell.mid < event.clientX).length
        }
        if (slot !== one.slot) {
          one.slot = slot
          place(one)
        }
      }
    }

    const up = (event: globalThis.PointerEvent) => {
      const one = hold.current
      hold.current = null
      if (!one) return
      if (!one.live) {
        if (one.kind === 'shop') buy(one.at)
        else if (one.kind === 'hand') play(one.uid)
        return
      }
      const over = spotAt(event.clientX, event.clientY)
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

  const mine = at >= 0 ? line(view.board) : line(view.board)
  const theirs = at >= 0 ? line(view.foeBoard) : line(view.foeBoard)
  const myHp = state ? state.hp : at >= 0 ? (view.opened?.hp ?? view.hp) : view.hp
  const foeHp = state ? state.foeHp : at >= 0 ? (view.opened?.foeHp ?? view.foeHp) : view.foeHp
  const freeAt = line(view.board).length < SLOTS ? line(view.board).length : -1
  const stable = line(view.board)
  const selling = dragging === 'board' || dragging === 'hand'
  const buying = dragging === 'shop'

  const packed = (cards: Card[]) => (
    <ul className="ar-row is-packed">
      {cards.map((card) => {
        const hp = health.get(card.uid)
        const gone = at >= 0 && hp === undefined
        return (
          <li key={card.uid} className={`is-held ${gone ? 'is-out' : ''}`}>
            <span data-uid={card.uid} className={`ar-move ${hit && now?.to === card.uid ? 'is-struck' : ''}`}>
              <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={Math.max(0, hp ?? card.hp)} summon={card.summon} triple={card.triple} tier={card.tier} />
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
        disabled={waiting || shopTop || view.chakra < view.upCost}
        title={shopTop ? t('arena.tavernTop') : t('arena.upgrade', { n: view.tavernTier + 1 })}
        onClick={() => send({ action: 'up' })}
      >
        <span>
          <UpIcon />
          {shopTop ? t('arena.tavernTop') : t('arena.upgrade', { n: view.tavernTier + 1 })}
          {!shopTop && (
            <em className="ar-price">
              <i />
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
        disabled={waiting || view.chakra < view.rollCost}
        title={t('arena.reroll')}
        onClick={() => send({ action: 'roll' })}
      >
        <span>
          <RefreshIcon />
          {t('arena.reroll')}
          <em className="ar-price">
            <i />
            {view.rollCost}
          </em>
        </span>
      </button>
    </div>
  )

  const shop = () => (
    <ul className="ar-row is-shop">
      {view.tavern.map((one, i) => {
        const poor = one.cost > view.chakra
        const card: Card = { uid: `shop${i}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon, tier: one.tier }
        return (
          <li
            key={`${one.id}:${i}`}
            className={`is-held ${poor ? 'is-poor' : ''}`}
          >
            <span className="ar-move" onPointerDown={poor ? undefined : take('shop', card, i)}>
              <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} tier={one.tier} />
            </span>
          </li>
        )
      })}
    </ul>
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
          <button type="button" className="ar-chip ar-go" onClick={() => send({ action: 'quit' }, true)}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polygon points={CHIP} vectorEffect="non-scaling-stroke" />
            </svg>
            <span>{t('arena.again')}</span>
          </button>
        </div>
      ) : (
        <>
          <section className="ar-board">
            <div
              data-zone={fight ? undefined : 'shop'}
              className={`ar-half is-top ${selling ? 'is-selling' : ''}`}
            >
              <div className="ar-plate">{fight && <Plate mark="B" name={t('arena.foe')} hp={foeHp} foe />}</div>
              {fight ? (
                packed(theirs)
              ) : (
                <>
                  {shopBar()}
                  {shop()}
                </>
              )}
            </div>
            <i className="ar-line" aria-hidden />
            <div
              data-zone={fight ? undefined : 'slot'}
              data-at={freeAt}
              className="ar-half is-bot"
            >
              {fight ? (
                packed(mine)
              ) : (
                <ul className="ar-row">
                  {stable.map((card, i) => (
                    <li key={card.uid}>
                      <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                        <ArenaFace game={game.id} entity={byId.get(card.id)} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} tier={card.tier} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="ar-plate">{fight && <Plate mark="T" name={t('arena.you')} hp={myHp} />}</div>
            </div>
          </section>

          <div className="ar-foot">
            <div
              data-zone={buying ? 'hand' : undefined}
              className={`ar-hand ${buying ? 'is-taking' : ''}`}
            >
              <ul>
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
              {clock !== null && !fight && (
                <div className={`ar-time ${clock <= 5 ? 'is-late' : ''}`}>
                  <small>{t('arena.time')}</small>
                  <b>{clock}</b>
                </div>
              )}
              <div className="ar-chakra">
                <span className="ar-chakra-head">
                  <small>{t('arena.chakra')}</small>
                  <b>
                    {view.chakra} / {view.chakraMax}
                  </b>
                </span>
                <span className="ar-crystals" aria-hidden>
                  {Array.from({ length: ARENA_CHAKRA_MAX }, (_, i) => (
                    <i key={i} className={i < view.chakra ? 'is-full' : i < view.chakraMax ? 'is-spent' : ''} />
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
