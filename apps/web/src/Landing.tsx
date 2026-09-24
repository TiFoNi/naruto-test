'use client'

import type { CSSProperties } from 'react'
import AuthScreen from './AuthScreen'
import { BRAND } from './brand'
import type { GameMeta } from './games/meta'
import { useI18n } from './i18n'
import { useHref } from './router'

export default function Landing({ games }: { games: GameMeta[] }) {
  const { t, l } = useI18n()
  const href = useHref()

  return (
    <main className="landing">
      <div className="landing-copy">
        <h1>
          {BRAND.parts[0]}
          <em>{BRAND.parts[1]}</em>
        </h1>
        <p>{t('brand.tagline')}</p>
        <ul className="landing-games">
          {games.map((g) => (
            <li key={g.id} style={{ '--tab-accent': g.accent } as CSSProperties}>
              <a href={href.play(g.id, g.modes[0])}>
                <span className="dot" />
                {l(g.label)}
              </a>
            </li>
          ))}
        </ul>
        <p className="landing-hint">{t('landing.guestHint')}</p>
      </div>
      <AuthScreen />
    </main>
  )
}
