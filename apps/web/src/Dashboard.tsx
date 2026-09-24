'use client'

import type { CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import type { GameMeta } from './games/meta'
import type { Category } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import { useHref } from './router'
import { dailyKey } from '@nanda/game'
import { average, emptyStats, kyivToday } from './stats'
import { CalendarIcon, ChartIcon, CheckIcon } from './icons'
import { CARD, cardUrl } from './pics'

const CATEGORIES: { id: Category; title: UiKey; hint: UiKey }[] = [
  { id: 'anime', title: 'dash.anime', hint: 'dash.animeHint' },
  { id: 'manga', title: 'dash.mangaTitle', hint: 'dash.mangaHint' },
  { id: 'games', title: 'dash.games', hint: 'dash.gamesHint' },
]

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
  const { t } = useI18n()
  const href = useHref()
  const { user, stats } = useAuth()
  const all = Object.values(stats)
  const totalSolved = all.reduce((sum, s) => sum + s.solved, 0)
  const bestStreak = all.reduce((max, s) => Math.max(max, s.best), 0)

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

      {CATEGORIES.map((category, index) => {
        const list = games.filter((g) => g.category === category.id)
        if (!list.length) return null
        return (
          <section key={category.id} className="category">
            <header>
              <h2>{t(category.title)}</h2>
              <p className="muted">{t(category.hint)}</p>
            </header>
            <div className="franchise-grid">
              {list.map((g, i) => (
                <FranchiseCard key={g.id} game={g} eager={index === 0 && i < 3} />
              ))}
            </div>
          </section>
        )
      })}

      <section className="category how">
        <header>
          <h2>{t('dash.howTitle')}</h2>
        </header>
        <div className="how-grid">
          {MODES.map((m) => (
            <div key={m.id} className="card how-card">
              <span className="mode-icon big" aria-hidden>
                {m.icon}
              </span>
              <h3>{t(m.label)}</h3>
              <p className="muted">{t(m.description)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
