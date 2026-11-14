'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ARENA_CARD_COST, ARENA_CHAKRA_MAX, ARENA_HERO_SLOTS, ARENA_SELL_BACK, ARENA_SUMMON_SLOTS } from '@nanda/game'
import { api } from './api'
import { ArenaFace, type ArenaView, type Card, type Side } from './ArenaCard'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { useHref, useNavigate } from './router'

const SLOTS = ARENA_HERO_SLOTS + ARENA_SUMMON_SLOTS
const GRAB_PX = 5

const FLY_MS = 1100
const IMPACT_MS = 470
const GAP_MS = 260

type Grab = { kind: 'hand' | 'board' | 'shop'; uid: string; at: number; card: Card; w: number; dx: number; dy: number }
type Spot = { zone: 'shop' | 'hand' | 'slot'; at: number }

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
  const shelf = useRef(new Map<string, DOMRect>())
  const [waiting, setWaiting] = useState(false)
  const [grab, setGrab] = useState<Grab | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [point, setPoint] = useState({ x: 0, y: 0 })

  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const moved = useRef(false)
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
        const card: Card = { uid: `new${at}:${now.turn}:${now.hand.length}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon }
        return { ...now, chakra: now.chakra - ARENA_CARD_COST, hand: [...now.hand, card], tavern: now.tavern.filter((_, i) => i !== at) }
      })
      send({ action: 'buy', at })
    },
    [send],
  )

  const play = useCallback(
    (uid: string) => {
      setView((now) => {
        if (!now) return now
        const card = now.hand.find((one) => one.uid === uid)
        if (!card || line(now.board).length >= SLOTS) return now
        return { ...now, hand: now.hand.filter((one) => one.uid !== uid), board: split([...line(now.board), card]) }
      })
      send({ action: 'play', uid })
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

  useEffect(() => {
    if (!fight || !lead) return
    const timer = setTimeout(() => setLead(false), 1600)
    return () => clearTimeout(timer)
  }, [fight, lead])

  useLayoutEffect(() => {
    if (!fight || step < 0 || lead) return
    const one = beats.current[step]
    if (!one) return

    const from = document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${one.from}"]`)
    const aim = one.to
      ? document.querySelector<HTMLElement>(`.ar-row.is-packed [data-uid="${one.to}"]`)
      : document.querySelector<HTMLElement>(`[data-hero="${one.foe ? 'me' : 'foe'}"]`)

    const land = setTimeout(() => setHit(true), IMPACT_MS)
    let next: ReturnType<typeof setTimeout> | undefined
    let run: Animation | undefined
    let zone: HTMLElement | null = null

    if (from && aim) {
      const a = from.getBoundingClientRect()
      const b = aim.getBoundingClientRect()
      const dx = Math.round(b.left + b.width / 2 - (a.left + a.width / 2))
      const dy = Math.round(b.top + b.height / 2 - (a.top + a.height / 2))
      from.style.zIndex = '6'
      zone = from.closest<HTMLElement>('.ar-half')
      if (zone) zone.style.zIndex = '7'
      run = from.animate(
        [
          { transform: 'translate(0, 0)', easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
          { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px)`, offset: 0.16, easing: 'cubic-bezier(0.6, 0, 0.85, 0.4)' },
          { transform: `translate(${dx * 0.9}px, ${dy * 0.9}px)`, offset: 0.43, easing: 'linear' },
          { transform: `translate(${dx * 0.88}px, ${dy * 0.88}px)`, offset: 0.56, easing: 'cubic-bezier(0.4, 0, 0.25, 1)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: FLY_MS, easing: 'linear' },
      )
    }

    const done = () => {
      if (from) from.style.zIndex = ''
      if (zone) zone.style.zIndex = ''
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
      run?.cancel()
      if (from) from.style.zIndex = ''
      if (zone) zone.style.zIndex = ''
    }
  }, [fight, step, lead])

  useLayoutEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.ar-row.is-shop [data-shelf]')]
    const spots = new Map<string, DOMRect>()
    for (const node of cards) {
      const key = `${node.dataset.shelf}:${cards.filter((one) => one.dataset.shelf === node.dataset.shelf).indexOf(node)}`
      const box = node.getBoundingClientRect()
      spots.set(key, box)
      const was = shelf.current.get(key)
      if (!was) continue
      const dx = was.left - box.left
      if (Math.abs(dx) < 1) continue
      node.style.transition = 'none'
      node.style.translate = `${dx}px 0`
      void node.offsetWidth
      node.style.transition = 'translate 0.32s cubic-bezier(0.22, 1, 0.36, 1)'
      node.style.translate = '0px 0px'
    }
    shelf.current = spots
  })

  const take = (kind: Grab['kind'], card: Card, at: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || fight || waiting) return
    const box = event.currentTarget.getBoundingClientRect()
    moved.current = false
    setPoint({ x: event.clientX, y: event.clientY })
    setGrab({ kind, uid: card.uid, at, card, w: box.width, dx: event.clientX - box.left - box.width / 2, dy: event.clientY - box.top - box.height / 2 })
  }

  useEffect(() => {
    if (!grab) return
    const start = { ...point }
    const move = (event: globalThis.PointerEvent) => {
      if (!moved.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < GRAB_PX) return
      moved.current = true
      setPoint({ x: event.clientX, y: event.clientY })
      setSpot(spotAt(event.clientX, event.clientY))
    }
    const up = (event: globalThis.PointerEvent) => {
      const where = moved.current ? spotAt(event.clientX, event.clientY) : null
      if (!moved.current) {
        if (grab.kind === 'shop') buy(grab.at)
        else if (grab.kind === 'hand') play(grab.uid)
      } else if (where?.zone === 'slot' && grab.kind === 'hand') play(grab.uid)
      else if (where?.zone === 'slot' && grab.kind === 'board') shift(grab.uid, where.at)
      else if (where?.zone === 'hand' && grab.kind === 'shop') buy(grab.at)
      else if (where?.zone === 'shop' && grab.kind !== 'shop') sell(grab.uid)
      setGrab(null)
      setSpot(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [grab, point, buy, play, sell, shift])

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
  const dragging = !!grab && moved.current
  const freeAt = line(view.board).length < SLOTS ? line(view.board).length : -1
  const selling = dragging && grab.kind !== 'shop'
  const buying = dragging && grab.kind === 'shop'

  const packed = (cards: Card[]) => (
    <ul className="ar-row is-packed">
      {cards.map((card) => {
        const hp = health.get(card.uid)
        const gone = at >= 0 && hp === undefined
        return (
          <li key={card.uid} className={`is-held ${gone ? 'is-out' : ''}`}>
            <span data-uid={card.uid} className={`ar-move ${hit && now?.to === card.uid ? 'is-struck' : ''}`}>
              <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={Math.max(0, hp ?? card.hp)} summon={card.summon} triple={card.triple} />
            </span>
          </li>
        )
      })}
    </ul>
  )

  const slots = (cards: Card[]) => (
    <ul className="ar-row">
      {Array.from({ length: SLOTS }, (_, i) => {
        const card = cards[i]
        const open = dragging && ((grab.kind === 'hand' && i === freeAt) || (grab.kind === 'board' && i < Math.max(cards.length, 1)))
        return (
          <li
            key={card ? card.uid : `slot${i}`}
            data-zone={open ? 'slot' : undefined}
            data-at={i}
            className={`${card ? 'is-held' : 'is-free'} ${open ? 'is-target' : ''} ${open && spot?.zone === 'slot' && spot.at === i ? 'is-over' : ''}`}
          >
            {card ? (
              <span data-uid={card.uid} className="ar-move" onPointerDown={take('board', card, i)}>
                <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} />
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )

  const shop = () => (
    <ul className="ar-row is-shop">
      {view.tavern.map((one, i) => {
        const poor = one.cost > view.chakra
        const card: Card = { uid: `shop${i}`, id: one.id, rarity: one.rarity, atk: one.atk, hp: one.hp, max: one.hp, summon: one.summon }
        return (
          <li
            key={`${one.id}:${i}`}
            data-shelf={one.id}
            className={`is-held ${poor ? 'is-poor' : ''} ${grab?.kind === 'shop' && grab.at === i && dragging ? 'is-ghost' : ''}`}
          >
            <span className="ar-move" onPointerDown={poor ? undefined : take('shop', card, i)}>
              <ArenaFace game={game.id} entity={byId.get(one.id)} rarity={one.rarity} atk={one.atk} hp={one.hp} summon={one.summon} />
            </span>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={`ar ${dragging ? 'is-dragging' : ''} ${fight ? 'is-fighting' : ''}`} style={{ '--dex': game.accent } as CSSProperties}>
      <div className="ar-top">
        <button type="button" className="ar-leave" onClick={() => send({ action: 'quit' }, true)}>
          {t('arena.quit')}
        </button>
        <b className="ar-name">
          {t('arena.title')} · {l(game.label)}
        </b>
        <span className={`ar-phase ${fight ? 'is-fight' : ''}`}>{t('arena.turn', { n: view.turn })}</span>
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
          <button type="button" className="ar-go" onClick={() => send({ action: 'quit' }, true)}>
            {t('arena.again')}
          </button>
        </div>
      ) : (
        <>
          <section className="ar-board">
            <div
              data-zone={selling ? 'shop' : undefined}
              className={`ar-half is-top ${selling ? 'is-selling' : ''} ${selling && spot?.zone === 'shop' ? 'is-over' : ''}`}
            >
              <div className="ar-plate">{fight && <Plate mark="B" name={t('arena.foe')} hp={foeHp} foe />}</div>
              {fight ? packed(theirs) : shop()}
            </div>
            <i className="ar-line" aria-hidden />
            <div
              data-zone={dragging && grab.kind === 'hand' && freeAt >= 0 ? 'slot' : undefined}
              data-at={freeAt}
              className={`ar-half is-bot ${dragging && grab.kind === 'hand' && freeAt >= 0 ? 'is-landing' : ''} ${
                dragging && grab.kind === 'hand' && spot?.zone === 'slot' ? 'is-over' : ''
              }`}
            >
              {fight ? packed(mine) : slots(mine)}
              <div className="ar-plate">{fight && <Plate mark="T" name={t('arena.you')} hp={myHp} />}</div>
            </div>
          </section>

          <div className="ar-foot">
            <div
              data-zone={buying ? 'hand' : undefined}
              className={`ar-hand ${buying ? 'is-taking' : ''} ${buying && spot?.zone === 'hand' ? 'is-over' : ''}`}
            >
              <ul>
                {view.hand.map((card, i) => (
                  <li
                    key={card.uid}
                    className={grab?.uid === card.uid && dragging ? 'is-ghost' : ''}
                    style={{ '--at': i - (view.hand.length - 1) / 2 } as CSSProperties}
                  >
                    <span className="ar-move" onPointerDown={take('hand', card, i)}>
                      <ArenaFace game={game.id} entity={byId.get(card.id)} rarity={card.rarity} atk={card.atk} hp={card.hp} summon={card.summon} triple={card.triple} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ar-side">
              <button
                type="button"
                className="ar-go"
                disabled={waiting || fight}
                onClick={() =>
                  send({ action: 'end' }, true, (next) => {
                    beats.current = next.steps ?? []
                    if (!next.steps?.length) return
                    setFight(true)
                    setStep(0)
                    setHit(false)
                    setLead(true)
                  })
                }
              >
                {t('arena.end')}
              </button>
              <div className="ar-chakra">
                <b>
                  {view.chakra}/{view.chakraMax}
                </b>
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

      {dragging && (
        <span className="ar-fly" style={{ width: grab.w, left: point.x - grab.dx, top: point.y - grab.dy } as CSSProperties} aria-hidden>
          <ArenaFace game={game.id} entity={byId.get(grab.card.id)} rarity={grab.card.rarity} atk={grab.card.atk} hp={grab.card.hp} summon={grab.card.summon} triple={grab.card.triple} />
        </span>
      )}
    </div>
  )
}
