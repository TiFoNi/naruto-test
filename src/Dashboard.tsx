import type { CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import { GAMES } from './games'
import type { Category, Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, UPCOMING_MODES } from './modes'
import { href } from './router'
import { dailyKey } from './games/specs'
import { emptyStats, kyivToday } from './stats'
import { CalendarIcon, CheckIcon } from './icons'
import { fullUrl } from './pics'

const CATEGORIES: { id: Category; title: UiKey; hint: UiKey }[] = [
  { id: 'anime', title: 'dash.anime', hint: 'dash.animeHint' },
  { id: 'games', title: 'dash.games', hint: 'dash.gamesHint' },
]

function FranchiseCard({ game }: { game: Game }) {
  const { t, l } = useI18n()
  const { stats } = useAuth()
  const featured = game.featured
    .map((f) => game.entities.find((e) => e.nameEn === f || e.name === f))
    .filter((e): e is NonNullable<typeof e> => !!e)
  const upcoming = UPCOMING_MODES.filter((m) => m.categories.includes(game.category))

  return (
    <article className="franchise" style={{ '--tab-accent': game.accent } as CSSProperties}>
      <a className="franchise-art" href={href.play(game.id, game.modes[0])} aria-label={l(game.label)}>
        {featured.slice(0, 3).map((e, i) => (
          <img key={e.id} className={`fan fan-${i}`} src={fullUrl(game.id, e.id)} alt="" loading="lazy" draggable={false} />
        ))}
      </a>
      <div className="franchise-body">
        <div className="franchise-title">
          <h3>{l(game.label)}</h3>
          <span className="count">
            {t(game.unit === 'hero' ? 'dash.heroes' : 'dash.characters', { count: game.entities.length })}
          </span>
        </div>
        <p>{l(game.description)}</p>
        <div className="franchise-modes">
          {MODES.filter((m) => game.modes.includes(m.id)).map((m) => {
            const solved = (stats[statsKey(game.id, m.id)] ?? emptyStats).solved
            return (
              <a key={m.id} className="mode-link" href={href.play(game.id, m.id)}>
                <span className="mode-icon" aria-hidden>
                  {m.icon}
                </span>
                <span>{t(m.label)}</span>
                {solved > 0 && <small>{solved}</small>}
              </a>
            )
          })}
        </div>
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
        {upcoming.length > 0 && (
          <p className="mode-soon">
            <b>{t('soon')}:</b> {upcoming.map((m) => t(m.label).toLowerCase()).join(', ')}
          </p>
        )}
      </div>
    </article>
  )
}

export default function Dashboard() {
  const { t } = useI18n()
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
      </section>

      {CATEGORIES.map((category) => {
        const games = GAMES.filter((g) => g.category === category.id)
        if (!games.length) return null
        return (
          <section key={category.id} className="category">
            <header>
              <h2>{t(category.title)}</h2>
              <p className="muted">{t(category.hint)}</p>
            </header>
            <div className="franchise-grid">
              {games.map((g) => (
                <FranchiseCard key={g.id} game={g} />
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
