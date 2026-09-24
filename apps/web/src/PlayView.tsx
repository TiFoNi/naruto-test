'use client'

import GameView from './GameView'
import { useAuth } from './auth'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { useHref } from './router'

export default function PlayView({ game: gameId, mode: modeId, daily }: { game: string; mode: string; daily: boolean }) {
  const { t } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const game = GAMES.find((g) => g.id === (gameId as GameId))
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  const mode = (game.modes.includes(modeId as ModeId) ? modeId : game.modes[0]) as ModeId

  return (
    <div className="play">
      <div className="play-nav">
        <a className="back" href={href.home}>
          {t('play.back')}
        </a>
      </div>
      <main>
        {daily && !user && !loading ? (
          <div className="card center muted locked">
            <p>{t('daily.needsAccount')}</p>
            <a className="primary" href={href.login}>
              {t('nav.signIn')}
            </a>
          </div>
        ) : (
          <GameView game={game} mode={mode} daily={daily} visible />
        )}
      </main>
    </div>
  )
}
