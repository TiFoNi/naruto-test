'use client'

import GameView from './GameView'
import { useAuth } from './auth'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { useHref } from './router'

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

const formatDate = (value: string, lang: keyof typeof LOCALES) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function PlayView({ game: gameId, mode: modeId, daily }: { game: string; mode: string; daily: boolean }) {
  const { t, lang } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const game = GAMES.find((g) => g.id === (gameId as GameId))
  const ready = useEntities(game)
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
          <GameView game={game} mode={mode} daily={daily} visible={ready} />
        )}
        {ready && game.updated && (
          <p className="play-updated muted">{t('play.updated').replace('{date}', formatDate(game.updated, lang))}</p>
        )}
      </main>
    </div>
  )
}
