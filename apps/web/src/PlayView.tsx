'use client'

import Link from 'next/link'
import GameView from './GameView'
import { useAuth } from './auth'
import { useEntities } from './entities'
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
  const ready = useEntities(game)
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  const mode = (game.modes.includes(modeId as ModeId) ? modeId : game.modes[0]) as ModeId

  return (
    <div className="play">
      <div className="play-nav">
        <Link className="back" href={href.home}>
          {t('play.back')}
        </Link>
      </div>
      <main>
        {daily && !user && !loading ? (
          <div className="card center muted locked">
            <p>{t('daily.needsAccount')}</p>
            <Link className="primary" href={href.login}>
              {t('nav.signIn')}
            </Link>
          </div>
        ) : (
          <GameView game={game} mode={mode} daily={daily} visible={ready} />
        )}
      </main>
    </div>
  )
}
