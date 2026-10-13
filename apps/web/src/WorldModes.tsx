'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { GRID_GAMES, dailyKey, hasDaily, statsKey } from '@nanda/game'
import BackButton from './BackButton'
import WorldMark from './WorldMark'
import { useAuth } from './auth'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { CalendarIcon, CheckIcon } from './icons'
import { MODES } from './modes'
import { useHref } from './router'
import { emptyStats, kyivToday } from './stats'

export default function WorldModes({ game: gameId, about }: { game: string; about?: ReactNode }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { user, stats } = useAuth()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>

  const modes = MODES.filter((one) => game.modes.includes(one.id) || (one.id === 'grid' && GRID_GAMES.includes(game.id)))
  const total = modes.reduce((sum, one) => sum + (stats[statsKey(game.id, one.id)]?.solved ?? 0), 0)

  return (
    <div className="world">
      <div className="play-nav">
        <BackButton href={href.home}>{t('play.back')}</BackButton>
      </div>

      <header className="world-head">
        <div className="world-head-body">
          <WorldMark game={game.id} className="world-mark" />
          <div className="world-title">
            <h1>{l(game.label)}</h1>
            {about}
          </div>
          <p className="world-lead">{l(game.description)}</p>
          <div className="world-chips">
            <span className="world-chip">{t('world.modes', { count: modes.length })}</span>
            {total > 0 && <span className="world-chip">{t('world.total', { count: total })}</span>}
          </div>
        </div>
      </header>

      <h2 className="world-pick">{t('world.pick')}</h2>

      <div className="world-grid">
        {modes.map((one) => {
          const own = stats[statsKey(game.id, one.id)] ?? emptyStats
          const played = own.solved > 0 || own.skipped > 0
          const daily = hasDaily(one.id)
          const done = stats[dailyKey(game.id, one.id)]?.lastDay === kyivToday()

          return (
            <article key={one.id} className="world-card">
              <Link className="world-card-main" href={href.play(game.id, one.id)} prefetch={false}>
                <span className="world-card-mark" aria-hidden>
                  {one.icon}
                </span>
                <b className="world-card-name">{t(one.label)}</b>
                <small className="world-card-desc">{t(one.description)}</small>
              </Link>

              <div className="world-card-foot">
                <span className="world-card-stat">
                  {played ? t('world.solved', { count: own.solved }) : t('world.fresh')}
                </span>
                {user && daily && (
                  <Link className={`world-card-daily ${done ? 'done' : ''}`} href={href.play(game.id, one.id, true)} prefetch={false}>
                    {done ? <CheckIcon /> : <CalendarIcon />}
                    {t(done ? 'world.dailyDone' : 'world.daily')}
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
