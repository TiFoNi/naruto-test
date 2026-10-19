'use client'

import Link from 'next/link'
import { BOARD_START } from './games'
import { useI18n } from './i18n'
import { GamepadIcon, GlobeIcon } from './icons'
import { useHref } from './router'

export default function BoardScope({ scope, game, mode }: { scope: 'season' | 'game'; game?: string; mode?: string }) {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="board-scope" role="tablist">
      <Link
        role="tab"
        aria-selected={scope === 'game'}
        className={scope === 'game' ? 'active' : ''}
        href={href.leaderboard((game ?? BOARD_START.game) as never, (mode ?? BOARD_START.mode) as never)}
      >
        <GamepadIcon /> {t('lb.scopeGame')}
      </Link>
      <Link role="tab" aria-selected={scope === 'season'} className={scope === 'season' ? 'active' : ''} href={href.board}>
        <GlobeIcon /> {t('lb.scopeSeason')}
      </Link>
    </div>
  )
}
