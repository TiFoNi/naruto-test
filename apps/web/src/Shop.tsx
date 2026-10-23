'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { BANNER_COSTS, BANNER_RARITY, BUNDLES, FRAME_COSTS, FRAME_RARITY, RARITIES, bannerCost, frameCost, type Rarity } from '@nanda/game'
import Avatar from './Avatar'
import HeroPeek, { type PeekStats } from './HeroPeek'
import BackButton from './BackButton'
import { api } from './api'
import { useAuth } from './auth'
import { bannerPic, bannerSpot } from './banners'
import { frameOf } from './frames'
import { showTone } from './tone'
import { useI18n, type UiKey } from './i18n'
import { CheckIcon } from './icons'
import Rail from './Rail'
import { useHref } from './router'

type Kind = 'bundle' | 'frame' | 'banner'

type Card = { kind: Kind; id: string; frame?: string; banner?: string; cost: number; full?: number; rarity: Rarity }

const BUNDLE_CARDS: Card[] = BUNDLES.map((one) => ({
  kind: 'bundle',
  id: one.id,
  frame: one.frame,
  banner: one.banner,
  cost: one.cost,
  rarity: one.rarity,
  full: (frameCost(one.frame) ?? 0) + (bannerCost(one.banner) ?? 0),
}))

const FRAME_CARDS: Card[] = Object.entries(FRAME_COSTS).map(([id, cost]) => ({ kind: 'frame', id, frame: id, cost, rarity: FRAME_RARITY[id] }))

const BANNER_CARDS: Card[] = Object.entries(BANNER_COSTS).map(([id, cost]) => ({ kind: 'banner', id, banner: id, cost, rarity: BANNER_RARITY[id] }))

const TABS = [
  { id: 'bundles', label: 'shop.bundles', cards: BUNDLE_CARDS },
  { id: 'frames', label: 'shop.frames', cards: FRAME_CARDS },
  { id: 'banners', label: 'shop.banners', cards: BANNER_CARDS },
] as const

export default function Shop() {
  const { t, l } = useI18n()
  const href = useHref()
  const { user, refresh } = useAuth()
  const tabs = useRef<HTMLDivElement>(null)
  const [ink, setInk] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('bundles')
  const [pick, setPick] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slip, setSlip] = useState<UiKey | null>(null)
  const [stats, setStats] = useState<PeekStats | null>(null)
  const [ask, setAsk] = useState<{ card: Card; kind: Kind; id?: string; cost: number } | null>(null)

  useEffect(() => setReady(true), [])

  useEffect(() => {
    if (!user) return
    let alive = true
    void api<PeekStats>('profile/summary').then(({ ok, data }) => {
      if (alive && ok) setStats(data)
    })
    return () => {
      alive = false
    }
  }, [user])

  useEffect(() => {
    if (!pick && !ask) return
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (ask) setAsk(null)
      else setPick(null)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [pick, ask])

  useEffect(() => {
    showTone(user?.tone ?? null)
    return () => showTone(null)
  }, [user?.tone])

  const slide = useCallback(() => {
    const row = tabs.current
    const on = row?.querySelector<HTMLElement>(`button[data-tab="${tab}"]`)
    if (!row || !on) return
    setInk({ x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight })
  }, [tab])

  useLayoutEffect(() => {
    slide()
  }, [slide])

  useEffect(() => {
    const row = tabs.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(slide)
    watcher.observe(row)
    return () => watcher.disconnect()
  }, [slide])

  const list = TABS.find((one) => one.id === tab)?.cards ?? []
  const card = list.find((one) => one.id === pick) ?? null

  const mineFrames = user?.frames ?? []
  const mineBanners = user?.banners ?? []

  const frameName = (id: string) => l(frameOf(id)?.label ?? { ru: id, uk: id, en: id })
  const bannerName = (id: string) => t(`banner.${id}` as UiKey)

  const nameOf = (one: Card) =>
    one.kind === 'bundle' ? t(`bundle.${one.id}` as UiKey) : one.kind === 'frame' ? frameName(one.id) : bannerName(one.id)

  const hasFrame = (one: Card) => !one.frame || mineFrames.includes(one.frame)
  const hasBanner = (one: Card) => !one.banner || mineBanners.includes(one.banner)
  const hasAll = (one: Card) => hasFrame(one) && hasBanner(one)

  const buy = async (kind: Kind, id?: string) => {
    if (!id || busy) return
    setBusy(true)
    setSlip(null)
    const { ok, data } = await api<{ error?: string }>('profile', { action: 'buy', kind, id })
    setAsk(null)
    if (ok) await refresh()
    else setSlip(data.error === 'no_coins' ? 'shop.poor' : 'shop.failed')
    setBusy(false)
  }

  const swap = (next: (typeof TABS)[number]) => {
    setTab(next.id)
    setPick(null)
    setSlip(null)
  }

  const art = card?.banner ?? user?.banner ?? null
  const worn = card?.frame ?? user?.frame ?? null

  const slot = (one: Card) => {
    const mine = hasAll(one)
    const pair = one.kind === 'bundle' && !hasFrame(one) && !hasBanner(one)
    const kind: Kind = pair ? 'bundle' : !hasFrame(one) ? 'frame' : 'banner'
    const id = pair ? one.id : !hasFrame(one) ? one.frame : one.banner
    const cost = pair ? one.cost : !hasFrame(one) ? (frameCost(one.frame) ?? 0) : (bannerCost(one.banner) ?? 0)
    const poor = cost > (user?.coins ?? 0)

    const foot = (
      <div className="shop-foot">
        {one.banner && <span className="shop-foot-echo" aria-hidden style={{ backgroundImage: `url(${bannerPic(one.banner)})` }} />}
        {one.kind !== 'frame' && <b>{nameOf(one)}</b>}
        {mine ? (
          <i className="shop-have">
            <CheckIcon />
            {t('shop.have')}
          </i>
        ) : (
          <button
            type="button"
            className={`shop-go ${poor ? 'is-poor' : ''}`}
            disabled={busy || poor}
            onClick={() => setAsk({ card: one, kind, id, cost })}
          >
            {t('shop.buy')}
            <i>{cost}</i>
          </button>
        )}
      </div>
    )

    const peek = () => {
      setPick(one.id)
      setSlip(null)
    }

    return (
      <div key={one.id} className={`shop-slot-card is-${one.rarity}`}>
        {one.kind === 'frame' ? (
          <button type="button" className="shop-tile is-frame" onClick={peek}>
            <Avatar className="shop-frame-face" id={user?.id} name={user?.nickname ?? '?'} avatar={user?.avatar} frame={one.frame ?? null} />
          </button>
        ) : (
          <button type="button" className="shop-tile is-wide" onClick={peek}>
            <span className="shop-tile-art" aria-hidden>
              {one.banner ? <img src={bannerPic(one.banner)} alt="" style={{ objectPosition: bannerSpot(one.banner) }} /> : <i />}
            </span>
            <span className="shop-wide-body">
              <Avatar className="shop-tile-face" id={user?.id} name={user?.nickname ?? '?'} avatar={user?.avatar} frame={one.frame ?? null} />
              <span className="shop-tile-text">
                <b>{user?.nickname ?? '—'}</b>
                {user?.tag && <em>#{user.tag}</em>}
              </span>
            </span>
          </button>
        )}
        {foot}
      </div>
    )
  }

  return (
    <div className="shop-page">
      <header className="shop-head">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>

        <div className="shop-head-text">
          <h1>{t('shop.title')}</h1>
          <p className="muted">{t('shop.lead')}</p>
        </div>

        <div className="shop-purse">
          <img className="shop-purse-mark" src="/shop/coins-big.webp" alt="" aria-hidden />
          <span className="shop-purse-text">
            <em>{t('shop.purse')}</em>
            <b>{user?.coins ?? 0}</b>
          </span>
          <Link className="shop-purse-add" href={href.support} prefetch={false}>
            {t('shop.topUp')}
          </Link>
        </div>
      </header>

      <Rail className="cat-rail shop-rail" trackClass="rail-chips" innerRef={tabs}>
        <span
          className={`seg-ink ${ink ? 'is-set' : ''}`}
          style={ink ? { transform: `translate(${ink.x}px, ${ink.y}px)`, width: ink.w, height: ink.h } : undefined}
          aria-hidden
        />
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            data-tab={one.id}
            aria-selected={tab === one.id}
            className={tab === one.id ? 'active' : ''}
            onClick={() => swap(one)}
          >
            {t(one.label as UiKey)} <b>{one.cards.length}</b>
          </button>
        ))}
      </Rail>

      {RARITIES.filter((tier) => list.some((one) => one.rarity === tier)).map((tier) => (
        <section key={tier} className={`shop-band is-${tier}`}>
          <h2 className="shop-band-head">
            <i className="shop-gem">{t(`shop.rarity.${tier}` as UiKey)}</i>
            <span>{list.filter((one) => one.rarity === tier).length}</span>
          </h2>
          <div className={`shop-grid ${tab === 'frames' ? 'is-frames' : 'is-wide'}`}>
            {list.filter((one) => one.rarity === tier).map(slot)}
          </div>
        </section>
      ))}

      {slip && <p className="shop-slip">{t(slip)}</p>}

      {ready &&
        card &&
        createPortal(
          <div className="modal-backdrop shop-peek" onClick={() => setPick(null)} role="presentation">
            <section className="shop-peek-box" role="dialog" aria-modal="true" aria-label={nameOf(card)}>
              <HeroPeek user={user ?? null} stats={stats} banner={art} frame={worn} />
            </section>
          </div>,
          document.body,
        )}
      {ready &&
        ask &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setAsk(null)} role="presentation">
            <section
              className="card modal shop-ask"
              role="dialog"
              aria-modal="true"
              aria-label={nameOf(ask.card)}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shop-ask-top">
                {ask.card.banner ? (
                  <span className="shop-ask-art" aria-hidden>
                    <img src={bannerPic(ask.card.banner)} alt="" style={{ objectPosition: bannerSpot(ask.card.banner) }} />
                    {ask.card.frame && (
                      <Avatar
                        className="shop-ask-face"
                        id={user?.id}
                        name={user?.nickname ?? '?'}
                        avatar={user?.avatar}
                        frame={ask.card.frame}
                      />
                    )}
                  </span>
                ) : (
                  <Avatar
                    className="shop-ask-solo"
                    id={user?.id}
                    name={user?.nickname ?? '?'}
                    avatar={user?.avatar}
                    frame={ask.card.frame ?? null}
                  />
                )}

                <div className="shop-ask-name">
                  <b>{nameOf(ask.card)}</b>
                  <em>
                    {[ask.card.frame && frameName(ask.card.frame), ask.card.banner && bannerName(ask.card.banner)]
                      .filter(Boolean)
                      .join(' · ')}
                  </em>
                </div>
              </div>

              <div className="shop-ask-sum">
                <span className="shop-ask-cost">
                  <img src="/shop/coins-big.webp" alt="" aria-hidden />
                  {ask.cost}
                </span>
                <em>{t('shop.left', { left: (user?.coins ?? 0) - ask.cost })}</em>
              </div>

              <div className="shop-ask-row">
                <button type="button" className="ghost" disabled={busy} onClick={() => setAsk(null)}>
                  {t('shop.cancel')}
                </button>
                <button type="button" className="shop-go" disabled={busy} onClick={() => void buy(ask.kind, ask.id)}>
                  {t('shop.buy')}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}
