'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import Quests from './Quests'
import { useHref } from './router'
import { GRID_GAMES, dailyKey } from '@nanda/game'
import { average, emptyStats, kyivToday } from './stats'
import { BallIcon, BookIcon, CalendarIcon, ChartIcon, CheckIcon, CloseIcon, GamepadIcon, MedalIcon, PaletteIcon, PlayIcon, SearchIcon, SwordsIcon, TvIcon } from './icons'
import { CARD, cardUrl } from './pics'
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

const MODE_ROWS = 2

function FranchiseCard({ game, eager }: { game: GameMeta; eager: boolean }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats, user } = useAuth()
  const modes = MODES.filter((m) => game.modes.includes(m.id) || (m.id === 'grid' && GRID_GAMES.includes(game.id)))
  const rows = modes.slice(0, MODE_ROWS)
  const extra = modes.length - rows.length

  return (
    <article className="franchise" style={{ '--tab-accent': game.accent } as CSSProperties}>
      <Link className="franchise-art" href={href.play(game.id, game.modes[0])} aria-label={l(game.label)} prefetch={false}>
        {game.featured.map(({ id, image }, i) => (
          <img
            key={id}
            className={`fan fan-${i}`}
            src={cardUrl(game.id, id, image)}
            sizes={i === 0 ? '128px' : '112px'}
            alt=""
            width={CARD.width}
            height={CARD.height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'low'}
            draggable={false}
          />
        ))}
      </Link>
      <div className="franchise-body">
        <div className="franchise-title">
          <h3>{l(game.label)}</h3>
          <span className="count">
            {t(game.unit === 'manga' ? 'dash.titles' : game.unit === 'hero' ? 'dash.heroes' : game.unit === 'player' ? 'dash.players' : 'dash.characters', { count: game.count })}
          </span>
        </div>
        <p>{l(game.description)}</p>
        <div className="franchise-modes">
          {extra > 0 ? (
            <Link className="modes-more" href={href.play(game.id, modes[MODE_ROWS].id)} prefetch={false}>
              {t('dash.moreModes', { count: extra })}
            </Link>
          ) : (
            <span className="modes-more" aria-hidden />
          )}
          {rows.map((m) => {
            const own = stats[statsKey(game.id, m.id)] ?? emptyStats
            const played = own.solved > 0 || own.skipped > 0
            const done = stats[dailyKey(game.id, m.id)]?.lastDay === kyivToday()
            return (
              <div key={m.id} className="mode-row">
                <Link className="mode-link" href={href.play(game.id, m.id)} prefetch={false}>
                  <span className="mode-icon" aria-hidden>
                    {m.icon}
                  </span>
                  <span className="mode-name">{t(m.label)}</span>
                </Link>
                {played && (
                  <span
                    className="mode-stat-hint"
                    tabIndex={0}
                    role="button"
                    aria-label={t('dash.statsHint')}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const hint = e.currentTarget
                      if (document.activeElement === hint) hint.blur()
                      else hint.focus()
                    }}
                  >
                    <ChartIcon />
                    <span className="mode-tip" role="tooltip">
                      <b>{t('dash.tipSolved', { count: own.solved })}</b>
                      <b>{t('dash.tipSkipped', { count: own.skipped })}</b>
                      <b>{t('dash.tipAvg', { value: average(own) })}</b>
                    </span>
                  </span>
                )}
                {user && m.id !== 'grid' && (
                  <Link
                    className={`mode-daily ${done ? 'done' : ''}`}
                    href={href.play(game.id, m.id, true)}
                    title={done ? t('daily.done') : t('daily.dashTitle')}
                    aria-label={done ? t('daily.done') : t('daily.dashTitle')}
                    prefetch={false}
                  >
                    {done ? <CheckIcon /> : <CalendarIcon />}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

export default function Dashboard({ games }: { games: GameMeta[] }) {
  const { t } = useI18n()
  const href = useHref()
  const { user } = useAuth()

  const shown = CATEGORIES.filter((category) => games.some((g) => g.category === category.id))

  const [query, setQuery] = useState('')
  const results = useMemo(() => searchGames(games, query), [games, query])
  const found = results ?? []
  const groups = shown.filter((category) => found.some((g) => g.category === category.id))
  const chosen = useRef<Category | undefined>(undefined)
  const started = useRef(false)

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
    setQuery('')
    document.documentElement.dataset.cat = id
    try {
      localStorage.setItem(REMEMBER, id)
    } catch {
      /* не критично */
    }
  }

  const accentOf = (id: Category) => games.find((g) => g.category === id)?.accent ?? 'var(--accent)'

  return (
    <main className="dashboard">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{user ? t('dash.hello', { name: user.nickname }) : '\u00a0'}</span>
          <h1>{t('dash.title')}</h1>
          <p className="hero-sub">{t('dash.sub')}</p>
        </div>
        <label className="hero-search">
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
            <button type="button" className="hero-search-clear" aria-label={t('dash.searchClear')} onClick={() => setQuery('')}>
              <CloseIcon />
            </button>
          )}
        </label>
        {user ? (
          <Quests />
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
        <div className="tiles">
          {shown.map((category) => {
            const list = games.filter((g) => g.category === category.id)
            return (
              <button
                key={category.id}
                type="button"
                className="tile"
                title={t(category.title)}
                data-id={category.id}
                data-first={category.id === shown[0]?.id ? '' : undefined}
                style={{ '--tile': accentOf(category.id) } as CSSProperties}
                onClick={() => pick(category.id)}
              >
                <span className="tile-icon" aria-hidden>
                  {categoryIcon(category.id)}
                </span>
                <span className="tile-body">
                  <b>{t(category.title)}</b>
                  <small>
                    {t('dash.worlds', { count: list.length })}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
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
                <div className="franchise-grid">
                  {found
                    .filter((g) => g.category === category.id)
                    .map((g) => (
                      <FranchiseCard key={g.id} game={g} eager={false} />
                    ))}
                </div>
              </div>
            ))
          ) : (
            <p className="muted">{t('dash.searchEmpty', { query })}</p>
          )}
        </section>
      )}

      {shown.map((category, index) => (
        <section key={category.id} className="category" data-id={category.id} data-first={index === 0 ? '' : undefined}>
          <header>
            <h2>{t(category.title)}</h2>
          </header>
          <div className="franchise-grid">
            {games
              .filter((g) => g.category === category.id)
              .map((g, i) => (
                <FranchiseCard key={g.id} game={g} eager={index === 0 && i < 3} />
              ))}
          </div>
        </section>
      ))}
    </main>
  )
}
