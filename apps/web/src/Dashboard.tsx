'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import { useHref } from './router'
import { dailyKey } from '@nanda/game'
import { average, emptyStats, kyivToday } from './stats'
import { CalendarIcon, ChartIcon, CheckIcon, GamepadIcon, PageIcon, TvIcon } from './icons'
import { CARD, cardUrl } from './pics'

const CATEGORIES: { id: Category; title: UiKey; hint: UiKey; icon: (props: { className?: string }) => React.ReactElement }[] = [
  { id: 'anime', title: 'dash.anime', hint: 'dash.animeHint', icon: TvIcon },
  { id: 'manga', title: 'dash.mangaTitle', hint: 'dash.mangaHint', icon: PageIcon },
  { id: 'games', title: 'dash.games', hint: 'dash.gamesHint', icon: GamepadIcon },
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

function FranchiseCard({ game, eager }: { game: GameMeta; eager: boolean }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { stats, user } = useAuth()

  return (
    <article className="franchise" style={{ '--tab-accent': game.accent } as CSSProperties}>
      <a className="franchise-art" href={href.play(game.id, game.modes[0])} aria-label={l(game.label)}>
        {game.featured.map(({ id, image }, i) => (
          <img
            key={id}
            className={`fan fan-${i}`}
            src={cardUrl(game.id, id, image)}
            alt=""
            width={CARD.width}
            height={CARD.height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'low'}
            draggable={false}
          />
        ))}
      </a>
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
            return (
              <a key={m.id} className="mode-link" href={href.play(game.id, m.id)}>
                <span className="mode-icon" aria-hidden>
                  {m.icon}
                </span>
                <span>{t(m.label)}</span>
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
              </a>
            )
          })}
        </div>
        {user && (
          <div className="daily-links">
            <span className="daily-links-title">
              <CalendarIcon /> {t('daily.dashTitle')}
            </span>
            {MODES.filter((m) => game.modes.includes(m.id)).map((m) => {
              const done = stats[dailyKey(game.id, m.id)]?.lastDay === kyivToday()
              return (
                <a
                  key={m.id}
                  className={`daily-link ${done ? 'done' : ''}`}
                  href={href.play(game.id, m.id, true)}
                  title={done ? t('daily.done') : undefined}
                >
                  {done && (
                    <span aria-label={t('daily.done')}>
                      <CheckIcon />
                    </span>
                  )}
                  {t(m.label)}
                </a>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}

export default function Dashboard({ games }: { games: GameMeta[] }) {
  const { t, lang } = useI18n()
  const href = useHref()
  const { user, stats } = useAuth()
  const all = Object.values(stats)
  const totalSolved = all.reduce((sum, s) => sum + s.solved, 0)
  const bestStreak = all.reduce((max, s) => Math.max(max, s.best), 0)

  const shown = CATEGORIES.filter((category) => games.some((g) => g.category === category.id))
  const [active, setActive] = useState<Category>(shown[0]?.id ?? 'anime')
  const current = shown.find((category) => category.id === active)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER) as Category | null
      if (saved && shown.some((category) => category.id === saved)) setActive(saved)
    } catch {
      /* приватний режим — просто лишаємо типову категорію */
    }
  }, [])

  const pick = (id: Category) => {
    setActive(id)
    try {
      localStorage.setItem(REMEMBER, id)
    } catch {
      /* не критично */
    }
  }

  const accentOf = (id: Category) => games.find((g) => g.category === id)?.accent ?? 'var(--accent)'

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-copy">
          {user && <span className="eyebrow">{t('dash.hello', { name: user.nickname })}</span>}
          <h1>{t('dash.title')}</h1>
          <p>{t('dash.lead')}</p>
          <ul className="features">
            <li>{t('dash.feature.unlimited')}</li>
            <li>{t('dash.feature.daily')}</li>
            <li>{t('dash.feature.modes')}</li>
            <li>{t('dash.feature.stats')}</li>
          </ul>
        </div>
        {user ? (
          <a className="card hero-stats" href={href.profile}>
            <span className="hero-stats-title">{t('dash.yourStats')}</span>
            <div className="hero-stats-grid">
              <div>
                <b>{totalSolved}</b>
                <span>{t('profile.total')}</span>
              </div>
              <div>
                <b>{bestStreak}</b>
                <span>{t('profile.bestStreak')}</span>
              </div>
            </div>
            <span className="hero-stats-link">{t('dash.openProfile')}</span>
          </a>
        ) : (
          <a className="card hero-stats guest" href={href.login}>
            <span className="hero-stats-title">{t('dash.yourStats')}</span>
            <p>{t('landing.guestHint')}</p>
            <span className="hero-stats-link">{t('nav.signIn')}</span>
          </a>
        )}
      </section>

      <section className="picker">
        <h2>{t('dash.pick')}</h2>
        <div className="tiles">
          {shown.map((category) => {
            const list = games.filter((g) => g.category === category.id)
            const Icon = category.icon
            const first = list.map((game) => ({ game, picture: game.featured[0] })).filter((item) => item.picture)
            const rest = list.flatMap((game) => game.featured.slice(1).map((picture) => ({ game, picture })))
            const art = [...first, ...rest].slice(0, 3)
            return (
              <button
                key={category.id}
                type="button"
                className={`tile ${category.id === active ? 'on' : ''}`}
                style={{ '--tile': accentOf(category.id) } as CSSProperties}
                onClick={() => pick(category.id)}
              >
                <span className="tile-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="tile-fan" data-count={art.length} aria-hidden>
                  {art.map(({ game, picture }, index) => (
                    <img
                      key={`${game.id}-${picture.id}`}
                      className={`tile-card tile-card-${index}`}
                      src={cardUrl(game.id, picture.id, picture.image)}
                      alt=""
                      width={CARD.width}
                      height={CARD.height}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ))}
                </span>
                <b>{t(category.title)}</b>
                <small>
                  {list.length} {worldsOf(list.length, lang)}
                </small>
              </button>
            )
          })}
        </div>
      </section>

      {current && (
        <section className="category">
          <header>
            <h2>{t(current.title)}</h2>
            <p className="muted">{t(current.hint)}</p>
          </header>
          <div className="franchise-grid">
            {games
              .filter((g) => g.category === active)
              .map((g, i) => (
                <FranchiseCard key={g.id} game={g} eager={i < 3} />
              ))}
          </div>
        </section>
      )}

    </div>
  )
}
