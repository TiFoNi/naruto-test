'use client'

import Link from 'next/link'
import BackButton from './BackButton'
import GameView from './GameView'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { usePlayLock } from './playLock'
import { useHref } from './router'
import SoloGrid from './SoloGrid'
import { GRID_GAMES, hasDaily } from '@nanda/game'

export default function PlayView({ game: gameId, mode: modeId, daily }: { game: string; mode: string; daily: boolean }) {
  const { t, l } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const game = GAMES.find((g) => g.id === (gameId as GameId))
  useEntities(game)
  const lock = usePlayLock({ game: gameId, mode: modeId, daily })
  const otherGame = GAMES.find((one) => one.id === lock.other?.game)
  const otherMode = MODES.find((one) => one.id === lock.other?.mode)
  const elsewhere = [otherGame && l(otherGame.label), otherMode && t(otherMode.label), lock.other?.daily && t('world.daily')]
    .filter(Boolean)
    .join(' · ')
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  const solo = modeId === 'grid' && GRID_GAMES.includes(game.id) && !daily
  const wanted = (game.modes.includes(modeId as ModeId) ? modeId : game.modes[0]) as ModeId
  const mode = daily && !hasDaily(wanted) ? (game.modes.find(hasDaily) ?? wanted) : wanted

  return (
    <div className="play">
      <div className="play-nav">
        <BackButton href={href.world(game.id)}>{l(game.label)}</BackButton>
      </div>
      <main>
        {lock.state === 'blocked' ? (
          <div className="card center muted locked">
            <p>
              {t('lock.elsewhere')}
              {elsewhere && (
                <>
                  <br />
                  <b>{elsewhere}</b>
                </>
              )}
            </p>
            <button type="button" className="primary" onClick={lock.take}>
              {t('lock.take')}
            </button>
          </div>
        ) : solo ? (
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
          <GameView game={game} mode={mode} daily={daily} />
        )}
      </main>
    </div>
  )
}
