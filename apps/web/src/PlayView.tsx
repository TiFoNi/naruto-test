'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import BackButton from './BackButton'
import GameView from './GameView'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { useHref } from './router'
import SoloGrid from './SoloGrid'
import { GRID_GAMES } from '@nanda/game'

export default function PlayView({ game: gameId, mode: modeId, daily, about }: { game: string; mode: string; daily: boolean; about?: ReactNode }) {
  const { t } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const game = GAMES.find((g) => g.id === (gameId as GameId))
  useEntities(game)
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  const solo = modeId === 'grid' && GRID_GAMES.includes(game.id) && !daily
  const mode = (game.modes.includes(modeId as ModeId) ? modeId : game.modes[0]) as ModeId

  return (
    <div className="play">
      <div className="play-nav">
        <BackButton href={href.home}>{t('play.back')}</BackButton>
      </div>
      <main>
        {solo ? (
          user || loading ? (
            <SoloGrid game={game.id} />
          ) : (
            <div className="card center muted locked">
              <p>{t('grid.needsAccount')}</p>
              <Link className="primary" href={href.login} prefetch={false}>
                {t('nav.signIn')}
              </Link>
            </div>
          )
        ) : daily && !user && !loading ? (
          <div className="card center muted locked">
            <p>{t('daily.needsAccount')}</p>
            <Link className="primary" href={href.login} prefetch={false}>
              {t('nav.signIn')}
            </Link>
          </div>
        ) : (
          <GameView game={game} mode={mode} daily={daily} about={about} />
        )}
      </main>
    </div>
  )
}
