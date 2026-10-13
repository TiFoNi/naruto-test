'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import Quests, { QuestsGhost } from './Quests'
import { useHref } from './router'
import { DAILY_XP_MODES, dailyKey, hasDaily, type ModeId } from '@nanda/game'
import { dailyNumber, kyivToday, type Stats } from './stats'
import { ArrowIcon, BallIcon, BookIcon, ChartIcon, CheckIcon, CloseIcon, GamepadIcon, MedalIcon, PaletteIcon, PlayIcon, SearchIcon, SwordsIcon, TvIcon } from './icons'
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

function DailyCard({ games }: { games: GameMeta[] }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats } = useAuth()

  const game = useMemo(() => favourite(games, stats), [games, stats])
  if (!game) return null

  const mode = (game.modes.find((one) => DAILY_XP_MODES.includes(one)) ?? 'classic') as ModeId
  const today = kyivToday()
  const done = stats[dailyKey(game.id, mode)]?.lastDay === today
  const titles = game.unit === 'manga'

  return (
    <section className="hero-daily" style={{ '--world-accent': game.accent } as CSSProperties}>
      <img className="hero-daily-art" src={`/worlds/big/${game.id}.webp`} alt="" aria-hidden width={448} height={448} />

      <span className="hero-daily-kicker">
        <i aria-hidden />
        {t('dash.dailyKicker')} · #{dailyNumber(today)}
        {done && (
          <em>
            <CheckIcon />
            {t('dash.dailyDone')}
          </em>
        )}
      </span>

      <h1>{titles ? t('dash.dailyTitleManga') : t('dash.dailyTitle', { world: l(game.label) })}</h1>
      <p>{t(titles ? 'dash.dailyLeadManga' : 'dash.dailyLead')}</p>

      <div className="hero-daily-actions">
        <Link className="primary" href={href.play(game.id, mode, true)} prefetch={false}>
          {t('dash.playDaily')}
          <ArrowIcon />
        </Link>
        <Link className="ghost" href={href.play(game.id, mode)} prefetch={false}>
          {t('daily.endless')}
        </Link>
      </div>
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
  const [mark, setMark] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [live, setLive] = useState(false)
  const placed = useRef(false)

  useEffect(() => {
    setActive(storedCategory())
  }, [])

  useBeforePaint(() => {
    const row = tabs.current
    const on = row?.querySelector<HTMLElement>('.cat-tab.on')
    setMark(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 })
    if (on && !placed.current) {
      placed.current = true
      requestAnimationFrame(() => setLive(true))
    }
  }, [active, shown.length])

  useEffect(() => {
    const row = tabs.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const sync = () => {
      const on = row.querySelector<HTMLElement>('.cat-tab.on')
      if (on) setMark({ x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight })
    }
    const watcher = new ResizeObserver(sync)
    watcher.observe(row)
    return () => watcher.disconnect()
  }, [])

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

        <div className="cat-tabs" ref={tabs}>
          <span
            className={`cat-tabs-mark ${live ? 'is-live' : ''}`}
            aria-hidden
            style={{ '--x': `${mark.x}px`, '--y': `${mark.y}px`, '--w': `${mark.w}px`, '--h': `${mark.h}px`, opacity: mark.w ? 1 : 0 } as CSSProperties}
          />
          {shown.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`cat-tab ${active === category.id ? 'on' : ''}`}
              data-id={category.id}
              onClick={() => pick(category.id)}
            >
              {t(category.title)}
            </button>
          ))}
        </div>

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
