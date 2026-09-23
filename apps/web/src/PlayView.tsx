'use client'

import GameView from './GameView'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { href } from './router'

export default function PlayView({ game: gameId, mode: modeId, daily }: { game: string; mode: string; daily: boolean }) {
  const { t } = useI18n()
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
        <GameView game={game} mode={mode} daily={daily} visible />
      </main>
    </div>
  )
}
