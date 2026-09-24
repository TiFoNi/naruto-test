'use client'

import { statsKey, useAuth } from './auth'
import { dailyKey } from '@nanda/game'
import ClassicMode from './ClassicMode'
import ImageMode from './ImageMode'
import AbilityMode from './AbilityMode'
import ChallengeMaker from './ChallengeMaker'
import PageMode from './PageMode'
import { CalendarIcon, InfinityIcon, TrophyIcon } from './icons'

import type { Game } from './games/types'
import { useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { href } from './router'
import { average, emptyStats, type Stats } from './stats'

function StatsBar({ stats, daily }: { stats: Stats; daily: boolean }) {
  const { t } = useI18n()
  const items = [
    [t('stats.solved'), stats.solved],
    [t(daily ? 'daily.streak' : 'stats.streak'), stats.streak],
    [t(daily ? 'daily.best' : 'stats.best'), stats.best],
    [t('stats.avg'), average(stats)],
  ] as const
  return (
    <dl className="stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function GameView({ game, mode, daily, visible }: { game: Game; mode: ModeId; daily: boolean; visible: boolean }) {
  const { stats, user } = useAuth()
  const { t, l } = useI18n()
  const statsFor = (m: ModeId, d: boolean) => stats[d ? dailyKey(game.id, m) : statsKey(game.id, m)] ?? emptyStats

  return (
    <div className="game-view" hidden={!visible}>
      <section className="game-head">
        <div className="game-head-top">
          <h1>{l(game.label)}</h1>
          <StatsBar stats={statsFor(mode, daily)} daily={daily} />
        </div>
        <div className="game-head-bar">
          <div className="game-switches">
            <div className="variant-tabs" role="tablist" aria-label={t('daily.variant')}>
              <a role="tab" aria-selected={!daily} className={!daily ? 'active' : ''} href={href.play(game.id, mode)}>
                <InfinityIcon /> {t('daily.endless')}
              </a>
              <a role="tab" aria-selected={daily} className={daily ? 'active' : ''} href={href.play(game.id, mode, true)}>
                <CalendarIcon /> {t('daily.daily')}
              </a>
            </div>
            <div className="mode-tabs" role="tablist">
              {MODES.filter((m) => game.modes.includes(m.id)).map((m) => (
                <a
                  key={m.id}
                  role="tab"
                  aria-selected={mode === m.id}
                  className={mode === m.id ? 'active' : ''}
                  href={href.play(game.id, m.id, daily)}
                >
                  {t(m.label)}
                </a>
              ))}
            </div>
          </div>
          <div className="game-head-side">
            {!daily && user && <ChallengeMaker game={game} mode={mode} />}
            {user && (
              <a className="lb-link" href={href.leaderboard(game.id, mode, daily)}>
                <TrophyIcon /> {t('nav.leaderboard')}
              </a>
            )}
          </div>
        </div>
      </section>
      {!user && (
        <p className="guest-note">
          {t('guest.note')} <a href={href.home}>{t('guest.signIn')}</a>
        </p>
      )}
      {[false, true].map((d) => (
        <div key={String(d)} hidden={daily !== d}>
          {game.modes.includes('classic') && (
            <div hidden={mode !== 'classic'}>
              <ClassicMode game={game} active={visible && daily === d && mode === 'classic'} stats={statsFor('classic', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('image') && (
            <div hidden={mode !== 'image'}>
              <ImageMode game={game} active={visible && daily === d && mode === 'image'} stats={statsFor('image', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('ability') && (
            <div hidden={mode !== 'ability'}>
              <AbilityMode game={game} active={visible && daily === d && mode === 'ability'} stats={statsFor('ability', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('page') && (
            <div hidden={mode !== 'page'}>
              <PageMode game={game} active={visible && daily === d && mode === 'page'} stats={statsFor('page', d)} daily={d} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

