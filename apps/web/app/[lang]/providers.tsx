'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/src/auth'
import type { GameMeta } from '@/src/games/meta'
import type { Lang } from '@/src/i18n/ui'
import { I18nProvider } from '@/src/i18n'
import Shell from '@/src/Shell'

export default function Providers({ children, games, lang }: { children: ReactNode; games: GameMeta[]; lang: Lang }) {
  return (
    <I18nProvider lang={lang}>
      <AuthProvider>
        <Shell games={games}>{children}</Shell>
      </AuthProvider>
    </I18nProvider>
  )
}
