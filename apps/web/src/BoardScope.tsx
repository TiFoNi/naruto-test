'use client'

import Link from 'next/link'
import { GAMES } from './games'
import { useI18n } from './i18n'
import { GamepadIcon, GlobeIcon } from './icons'
import { useHref } from './router'

export default function BoardScope({ scope, game, mode }: { scope: 'season' | 'game'; game?: string; mode?: string }) {
  const { t } = useI18n()
  const href = useHref()
  const fallback = GAMES[0]

  return (
    <div className="board-scope" role="tablist">
      <Link role="tab" aria-selected={scope === 'season'} className={scope === 'season' ? 'active' : ''} href={href.board}>
        <GlobeIcon /> {t('lb.scopeSeason')}
      </Link>
      <Link
        role="tab"
        aria-selected={scope === 'game'}
        className={scope === 'game' ? 'active' : ''}
        href={href.leaderboard((game ?? fallback.id) as never, (mode ?? fallback.modes[0]) as never)}
      >
        <GamepadIcon /> {t('lb.scopeGame')}
      </Link>
    </div>
  )
}
