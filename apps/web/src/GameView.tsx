'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { statsKey, useAuth } from './auth'
import { GRID_GAMES, dailyKey } from '@nanda/game'
import ClassicMode from './ClassicMode'
import ImageMode from './ImageMode'
import AbilityMode from './AbilityMode'
import OddMode from './OddMode'
import PageMode from './PageMode'
import PhraseMode from './PhraseMode'
import { CalendarIcon, InfinityIcon, MedalIcon } from './icons'

import type { Game } from './games/types'
import WorldMark from './WorldMark'
import { useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { useHref } from './router'
import { emptyStats } from './stats'

export default function GameView({ game, mode, daily }: { game: Game; mode: ModeId; daily: boolean }) {
  const { stats, user } = useAuth()
  const href = useHref()
  const { t, l } = useI18n()
  const statsFor = (m: ModeId, d: boolean) => stats[d ? dailyKey(game.id, m) : statsKey(game.id, m)] ?? emptyStats
  const tabs = MODES.filter((m) => game.modes.includes(m.id) || (m.id === 'grid' && GRID_GAMES.includes(game.id) && !daily))

  return (
    <div className="game-view" style={{ '--game-accent': game.accent } as CSSProperties}>
      <header className="game-head">
        <div className="game-title">
          <div className="game-name">
            <WorldMark game={game.id} className="game-mark" />
            <h1>{l(game.label)}</h1>
          </div>
        </div>
        <div className="game-switches">
          <div className="variant-tabs" role="tablist" aria-label={t('daily.variant')}>
            <Link role="tab" aria-selected={!daily} className={!daily ? 'active' : ''} href={href.play(game.id, mode)}>
              <InfinityIcon /> {t('daily.endless')}
            </Link>
            <Link role="tab" aria-selected={daily} className={daily ? 'active' : ''} href={href.play(game.id, mode, true)}>
              <CalendarIcon /> {t('daily.daily')}
            </Link>
          </div>
          <div className="mode-tabs" role="tablist" data-tabs={tabs.length}>
            {tabs.map((m) => (
              <Link
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={mode === m.id ? 'active' : ''}
                href={href.play(game.id, m.id, daily)}
              >
                {m.icon} {t(m.label)}
              </Link>
            ))}
          </div>
        </div>

      </header>

      {!user && (
        <div className="guest-note">
          <span className="guest-note-mark" aria-hidden>
            <MedalIcon />
          </span>
          <p>{t('guest.note')}</p>
          <Link className="guest-note-cta" href={href.login} prefetch={false}>
            {t('guest.signIn')}
          </Link>
        </div>
      )}

      {[false, true].map((d) => (
        <div key={String(d)} hidden={daily !== d}>
          {game.modes.includes('classic') && (
            <div hidden={mode !== 'classic'}>
              <ClassicMode game={game} active={daily === d && mode === 'classic'} stats={statsFor('classic', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('image') && (
            <div hidden={mode !== 'image'}>
              <ImageMode game={game} active={daily === d && mode === 'image'} stats={statsFor('image', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('ability') && (
            <div hidden={mode !== 'ability'}>
              <AbilityMode game={game} active={daily === d && mode === 'ability'} stats={statsFor('ability', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('phrase') && (
            <div hidden={mode !== 'phrase'}>
              <PhraseMode game={game} active={daily === d && mode === 'phrase'} stats={statsFor('phrase', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('page') && (
            <div hidden={mode !== 'page'}>
              <PageMode game={game} active={daily === d && mode === 'page'} stats={statsFor('page', d)} daily={d} />
            </div>
          )}
          {game.modes.includes('odd') && (
            <div hidden={mode !== 'odd'}>
              <OddMode game={game} active={daily === d && mode === 'odd'} stats={statsFor('odd', d)} daily={d} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
