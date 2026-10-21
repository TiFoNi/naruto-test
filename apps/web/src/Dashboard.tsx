'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointer } from 'react'
import { useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import Quests, { QuestsGhost } from './Quests'
import Rail from './Rail'
import { useHref } from './router'
import { DAILY_XP_MODES, dailyKey, hasDaily, type ModeId } from '@nanda/game'
import { dailyNumber, kyivToday, type Stats } from './stats'
import { BallIcon, BookIcon, ChartIcon, CheckIcon, CloseIcon, GamepadIcon, MedalIcon, PaletteIcon, PlayIcon, SearchIcon, SwordsIcon, TvIcon } from './icons'
import { useBeforePaint } from './paint'
import { searchGames } from './search'

const CATEGORIES: { id: Category; title: UiKey }[] = [
  { id: 'anime', title: 'dash.anime' },
  { id: 'manga', title: 'dash.mangaTitle' },
  { id: 'cartoon', title: 'dash.cartoon' },
  { id: 'screen', title: 'dash.screen' },
  { id: 'games', title: 'dash.games' },
  { id: 'sport', title: 'dash.sport' },
]

const PERKS: { key: UiKey; Icon: typeof ChartIcon }[] = [
  { key: 'login.perk.progress', Icon: ChartIcon },
  { key: 'login.perk.duels', Icon: SwordsIcon },
  { key: 'login.perk.levels', Icon: MedalIcon },
]

const REMEMBER = 'nanda.category'

const CATEGORY_IDS: Category[] = ['anime', 'manga', 'cartoon', 'screen', 'games', 'sport']

const storedCategory = (): Category | undefined => {
  try {
    const value = localStorage.getItem(REMEMBER)
    return CATEGORY_IDS.find((id) => id === value)
  } catch {
    return undefined
  }
}

const categoryIcon = (id: Category) =>
  id === 'anime' ? (
    <TvIcon />
  ) : id === 'manga' ? (
    <BookIcon />
  ) : id === 'cartoon' ? (
    <PaletteIcon />
  ) : id === 'sport' ? (
    <BallIcon />
  ) : id === 'screen' ? (
    <PlayIcon />
  ) : (
    <GamepadIcon />
  )

const favourite = (games: GameMeta[], stats: Record<string, Stats>) => {
  const score = new Map<string, number>()
  for (const [key, value] of Object.entries(stats)) {
    const id = key.split('_')[0]
    score.set(id, (score.get(id) ?? 0) + (value?.solved ?? 0) + (value?.skipped ?? 0))
  }

  return [...games]
    .filter((one) => one.modes.some((mode) => DAILY_XP_MODES.includes(mode)))
    .sort((one, two) => (score.get(two.id) ?? 0) - (score.get(one.id) ?? 0) || two.plays - one.plays)[0]
}

type Slide = {
  id: string
  accent: string
  art: string
  flat?: boolean
  kicker: string
  done?: boolean
  title: string
  lead: string
  cta: string
  href: string
  out?: boolean
}

const SPIN = 7000
const TELEGRAM = 'https://t.me/nandaguessr'

function DailyCard({ games }: { games: GameMeta[] }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats } = useAuth()
  const [shown, setShown] = useState(0)
  const [turns, setTurns] = useState(0)
  const [awake, setAwake] = useState(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const today = kyivToday()
  const loved = useMemo(() => favourite(games, stats), [games, stats])
  const shots = games.find((one) => one.id === 'shots')

  const daily = (game: GameMeta, kicker: string): Slide => {
    const mode = (game.modes.find((one) => DAILY_XP_MODES.includes(one)) ?? 'classic') as ModeId
    const titles = game.unit === 'manga'
    return {
      id: `${game.id}-${mode}`,
      accent: game.accent,
      art: `/worlds/big/${game.id}.webp`,
      kicker,
      done: stats[dailyKey(game.id, mode)]?.lastDay === today,
      title: titles ? t('dash.dailyTitleManga') : t('dash.dailyTitle', { world: l(game.label) }),
      lead: t(titles ? 'dash.dailyLeadManga' : 'dash.dailyLead'),
      cta: t('dash.playDaily'),
      href: href.play(game.id, mode, true),
    }
  }

  const slides: Slide[] = []
  if (loved) slides.push(daily(loved, `${t('dash.dailyKicker')} · #${dailyNumber(today)}`))
  if (shots)
    slides.push({
      id: 'shots',
      accent: shots.accent,
      art: `/worlds/big/${shots.id}.webp`,
      kicker: t('dash.newMode'),
      title: t('mode.shot'),
      lead: t('mode.shot.desc'),
      cta: t('dash.tryMode'),
      href: href.play(shots.id, 'shot'),
    })
  slides.push({
    id: 'telegram',
    accent: '#2aabee',
    art: '/promo/telegram.svg',
    flat: true,
    kicker: t('dash.tgKicker'),
    title: t('dash.tgTitle'),
    lead: t('dash.tgLead'),
    cta: t('dash.tgCta'),
    href: TELEGRAM,
    out: true,
  })

  const count = slides.length
  const at = count ? shown % count : 0
  const slide = slides[at]

  useEffect(() => {
    if (awake) return
    const wake = () => setAwake(true)
    const kinds = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    for (const kind of kinds) window.addEventListener(kind, wake, { once: true, passive: true })
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, wake)
    }
  }, [awake])

  useEffect(() => {
    if (count < 2 || !awake) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      setShown((one) => (one + 1) % count)
      setTurns((one) => one + 1)
    }, SPIN)
    return () => window.clearInterval(timer)
  }, [awake, count, shown])

  if (!slide) return null

  const start = (event: ReactPointer<HTMLElement>) => {
    swipe.current = { x: event.clientX, y: event.clientY }
  }

  const end = (event: ReactPointer<HTMLElement>) => {
    const from = swipe.current
    swipe.current = null
    if (!from || count < 2) return
    const dx = event.clientX - from.x
    if (Math.abs(dx) < 45 || Math.abs(event.clientY - from.y) > Math.abs(dx)) return
    setShown((one) => (one + (dx < 0 ? 1 : count - 1)) % count)
    setTurns((one) => one + 1)
  }

  return (
    <section
      className="hero-daily"
      style={{ '--world-accent': slide.accent } as CSSProperties}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={() => (swipe.current = null)}
    >
      <img
        key={slide.art}
        className={`hero-daily-art ${slide.flat ? 'is-flat' : ''} ${turns ? 'is-swap' : ''}`}
        src={slide.art}
        alt=""
        aria-hidden
        width={448}
        height={448}
      />

      <div key={slide.id} className={`hero-daily-copy ${turns ? 'is-swap' : ''}`}>
        <span className="hero-daily-kicker">
          <i aria-hidden />
          {slide.kicker}
          {slide.done && (
            <em>
              <CheckIcon />
              {t('dash.dailyDone')}
            </em>
          )}
        </span>

        <h1>{slide.title}</h1>
        <p>{slide.lead}</p>

        <div className="hero-daily-actions">
          {slide.out ? (
            <a className="primary" href={slide.href} target="_blank" rel="noreferrer">
              {slide.cta}
            </a>
          ) : (
            <Link className="primary" href={slide.href} prefetch={false}>
              {slide.cta}
            </Link>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="hero-dots">
          {slides.map((one, index) => (
            <button
              key={one.id}
              type="button"
              className={index === at ? 'active' : ''}
              aria-label={t('dash.slide', { number: index + 1 })}
              aria-current={index === at}
              onClick={() => {
                setShown(index)
                setTurns((one) => one + 1)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function WorldTile({ game, eager }: { game: GameMeta; eager: boolean }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats, user } = useAuth()
  const today = kyivToday()
  const done = !!user && game.modes.some((mode) => hasDaily(mode) && stats[dailyKey(game.id, mode)]?.lastDay === today)

  return (
    <Link className="cat-card" href={href.world(game.id)} prefetch={false} style={{ '--world-accent': game.accent } as CSSProperties}>
      <span className="cat-card-art">
        <img
          src={`/worlds/big/${game.id}.webp`}
          alt=""
          width={448}
          height={448}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={(event) => {
            const img = event.currentTarget
            if (img.dataset.small === undefined) {
              img.dataset.small = ''
              img.src = `/worlds/${game.id}.webp`
            } else img.hidden = true
          }}
        />
        {done && (
          <span className="cat-card-badge is-done">
            <CheckIcon />
            {t('dash.dailyDone')}
          </span>
        )}
      </span>
      <b>{l(game.label)}</b>
      <small>
        {t(game.unit === 'manga' ? 'dash.titles' : game.unit === 'hero' ? 'dash.heroes' : game.unit === 'player' ? 'dash.players' : 'dash.characters', {
          count: game.count,
        })}
      </small>
    </Link>
  )
}

export default function Dashboard({ games }: { games: GameMeta[] }) {
  const { t } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()

  const shown = CATEGORIES.filter((category) => games.some((g) => g.category === category.id))

  const [query, setQuery] = useState('')
  const results = useMemo(() => searchGames(games, query), [games, query])
  const found = results ?? []
  const groups = shown.filter((category) => found.some((g) => g.category === category.id))
  const chosen = useRef<Category | undefined>(undefined)
  const started = useRef(false)
  const tabs = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Category | undefined>(undefined)
  const [ink, setInk] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    setActive(storedCategory())
  }, [])

  const slide = useCallback(() => {
    const row = tabs.current
    const on = row?.querySelector<HTMLElement>('.cat-tab.active')
    setInk(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null)
  }, [])

  useLayoutEffect(() => {
    slide()
  }, [slide, active, query])

  useEffect(() => {
    const row = tabs.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(slide)
    watcher.observe(row)
    return () => watcher.disconnect()
  }, [slide])

  useEffect(() => {
    const row = tabs.current
    const on = row?.querySelector<HTMLElement>('.cat-tab.active')
    if (!row || !on) return
    const left = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [active])

  useBeforePaint(() => {
    const root = document.documentElement
    if (!started.current) {
      chosen.current = (root.dataset.cat as Category | undefined) ?? storedCategory()
      started.current = true
    }
    if (chosen.current && root.dataset.cat === undefined) root.dataset.cat = chosen.current

    if (!results) {
      if (root.dataset.search !== undefined) {
        delete root.dataset.search
        if (chosen.current) root.dataset.cat = chosen.current
        else delete root.dataset.cat
      }
      return
    }

    root.dataset.search = ''
    const cats = [...new Set(results.map((g) => g.category))]
    root.dataset.cat = cats.length === 1 ? cats[0] : 'mixed'
  }, [results])

  useEffect(
    () => () => {
      const root = document.documentElement
      if (root.dataset.search === undefined) return
      delete root.dataset.search
      if (chosen.current) root.dataset.cat = chosen.current
      else delete root.dataset.cat
    },
    [],
  )

  const pick = (id: Category) => {
    chosen.current = id
    setActive(id)
    setQuery('')
    document.documentElement.dataset.cat = id
    try {
      localStorage.setItem(REMEMBER, id)
    } catch {
      /* не критично */
    }
  }

  return (
    <main className="dashboard">
      <section className="hero">
        <DailyCard games={games} />
        {user ? (
          <Quests />
        ) : loading ? (
          <QuestsGhost />
        ) : (
          <div className="card hero-guest">
            <span className="hero-guest-title">{t('dash.yourStats')}</span>
            <p>{t('landing.guestHint')}</p>
            <ul className="hero-guest-perks">
              {PERKS.map(({ key, Icon }) => (
                <li key={key}>
                  <Icon />
                  {t(key)}
                </li>
              ))}
            </ul>
            <Link className="primary" href={href.login} prefetch={false}>
              {t('nav.signIn')}
            </Link>
          </div>
        )}
      </section>

      <section className="picker">
        <h2>{t('dash.pick')}</h2>

        <Rail className="cat-rail" trackClass="rail-chips" innerRef={tabs}>
          <span
            className={`seg-ink ${ink ? 'is-set' : ''}`}
            style={ink ? { transform: `translate(${ink.x}px, ${ink.y}px)`, width: ink.w, height: ink.h } : undefined}
            aria-hidden
          />
          {shown.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`cat-tab ${active === category.id ? 'active' : ''}`}
              data-id={category.id}
              onClick={() => pick(category.id)}
            >
              {t(category.title)}
            </button>
          ))}
        </Rail>

        <label className="cat-search">
          <SearchIcon />
          <input
            type="search"
            placeholder={t('dash.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
            autoComplete="off"
          />
          {!!query && (
            <button type="button" className="cat-search-clear" aria-label={t('dash.searchClear')} onClick={() => setQuery('')}>
              <CloseIcon />
            </button>
          )}
        </label>
      </section>

      {results && (
        <section className="search-results">
          <header>
            <h2>{found.length ? t('dash.searchFound', { count: found.length }) : t('dash.searchNone')}</h2>
            <button type="button" className="search-reset" onClick={() => setQuery('')}>
              {t('dash.searchClear')}
            </button>
          </header>
          {found.length ? (
            groups.map((category) => (
              <div key={category.id} className="search-group">
                {groups.length > 1 && (
                  <h3>
                    {categoryIcon(category.id)}
                    {t(category.title)}
                  </h3>
                )}
                <div className="cat-grid">
                  {found
                    .filter((g) => g.category === category.id)
                    .map((g) => (
                      <WorldTile key={g.id} game={g} eager={false} />
                    ))}
                </div>
              </div>
            ))
          ) : (
            <p className="muted">{t('dash.searchEmpty', { query })}</p>
          )}
        </section>
      )}

      {shown.map((category, index) => {
        const list = games.filter((g) => g.category === category.id)

        return (
          <section key={category.id} className="category" data-id={category.id} data-first={index === 0 ? '' : undefined}>
            <div className="cat-grid">
              {list.map((g, i) => (
                <WorldTile key={g.id} game={g} eager={index === 0 && i < 7} />
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
