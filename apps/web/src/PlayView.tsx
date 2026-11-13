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
import { useDeviceLock } from './deviceLock'
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
  const wanted = (game?.modes.includes(modeId as ModeId) ? modeId : (game?.modes[0] ?? modeId)) as ModeId
  const mode = game && daily && !hasDaily(wanted) ? (game.modes.find(hasDaily) ?? wanted) : wanted
  const spot = { game: gameId, mode, daily }
  const lock = usePlayLock(spot)
  const device = useDeviceLock(spot, !!user && !!game && lock.state === 'held')
  const blocked = lock.state === 'blocked' ? lock.other : device.state === 'blocked' ? device.other : null
  const otherGame = GAMES.find((one) => one.id === blocked?.game)
  const otherMode = MODES.find((one) => one.id === blocked?.mode)
  const elsewhere = [otherGame && l(otherGame.label), otherMode && t(otherMode.label), blocked?.daily && t('world.daily')]
    .filter(Boolean)
    .join(' · ')
  const same = !!blocked && blocked.game === gameId && blocked.mode === mode && !!blocked.daily === daily
  if (!game) return <div className="card center muted">{t('err.not_found')}</div>
  const solo = modeId === 'grid' && GRID_GAMES.includes(game.id) && !daily

  return (
    <div className="play">
      <div className="play-nav">
        <BackButton href={href.world(game.id)}>{l(game.label)}</BackButton>
      </div>
      <div className="page-main">
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
        ) : device.state === 'blocked' ? (
          <div className="card center muted locked">
            <p>
              {t('lock.device', { name: device.other?.name ?? t('lock.deviceUnknown') })}
              {elsewhere && (
                <>
                  <br />
                  <b>{elsewhere}</b>
                </>
              )}
            </p>
            {same && <small>{t('lock.moveHint')}</small>}
            <button type="button" className="primary" onClick={device.take}>
              {t(same ? 'lock.moveHere' : 'lock.take')}
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
      </div>
    </div>
  )
}
