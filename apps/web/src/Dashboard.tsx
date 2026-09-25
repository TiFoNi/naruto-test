'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import Quests from './Quests'
import { useHref } from './router'
import { dailyKey } from '@nanda/game'
import { average, emptyStats, kyivToday } from './stats'
import { BookIcon, CalendarIcon, ChartIcon, CheckIcon, GamepadIcon, SearchIcon, TvIcon } from './icons'
import { CARD, MINI, cardUrl, miniUrl } from './pics'

const CATEGORIES: { id: Category; title: UiKey }[] = [
  { id: 'anime', title: 'dash.anime' },
  { id: 'manga', title: 'dash.mangaTitle' },
  { id: 'games', title: 'dash.games' },
]

const WORLDS = {
  ru: ['вселенная', 'вселенные', 'вселенных'],
  uk: ['всесвіт', 'всесвіти', 'всесвітів'],
  en: ['world', 'worlds', 'worlds'],
} as const

const worldsOf = (count: number, lang: keyof typeof WORLDS) => {
  if (lang === 'en') return WORLDS.en[count === 1 ? 0 : 1]
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return WORLDS[lang][0]
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return WORLDS[lang][1]
  return WORLDS[lang][2]
}

const REMEMBER = 'nanda.category'

const categoryIcon = (id: Category) => (id === 'anime' ? <TvIcon /> : id === 'manga' ? <BookIcon /> : <GamepadIcon />)

function FranchiseCard({ game, eager }: { game: GameMeta; eager: boolean }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats, user } = useAuth()

  return (
    <article className="franchise" style={{ '--tab-accent': game.accent } as CSSProperties}>
      <Link className="franchise-art" href={href.play(game.id, game.modes[0])} aria-label={l(game.label)} prefetch={false}>
        {game.featured.map(({ id, image }, i) => (
          <img
            key={id}
            className={`fan fan-${i}`}
            src={cardUrl(game.id, id, image)}
            srcSet={`${miniUrl(game.id, id, image)} ${MINI.width}w, ${cardUrl(game.id, id, image)} ${CARD.width}w`}
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
            {t(game.unit === 'manga' ? 'dash.titles' : game.unit === 'hero' ? 'dash.heroes' : 'dash.characters', { count: game.count })}
          </span>
        </div>
        <p>{l(game.description)}</p>
        <div className="franchise-modes">
          {MODES.filter((m) => game.modes.includes(m.id)).map((m) => {
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
                  {played && (
                    <span
                      className="mode-stat-hint"
                      tabIndex={0}
                      role="button"
                      aria-label={t('dash.statsHint')}
                      onClick={(e) => {
                        e.preventDefault()
                        e.currentTarget.focus()
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
                </Link>
                {user && (
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
  const { t, lang } = useI18n()
  const href = useHref()
  const { user } = useAuth()

  const shown = CATEGORIES.filter((category) => games.some((g) => g.category === category.id))

  const pick = (id: Category) => {
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
          <label className="hero-search" title={t('dash.searchSoon')}>
            <SearchIcon />
            <input type="search" placeholder={t('dash.search')} disabled />
            <span className="hero-search-all">{t('dash.searchAll')}</span>
          </label>
        </div>
        {user ? (
          <Quests />
        ) : (
          <Link className="card hero-stats guest" href={href.login}>
            <span className="hero-stats-title">{t('dash.yourStats')}</span>
            <p>{t('landing.guestHint')}</p>
            <span className="hero-stats-link">{t('nav.signIn')}</span>
          </Link>
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
                    {list.length} {worldsOf(list.length, lang)}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

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
