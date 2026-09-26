'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/src/auth'
import type { GameMeta } from '@/src/games/meta'
import type { Dict, Lang } from '@/src/i18n/ui'
import { I18nProvider } from '@/src/i18n'
import Shell from '@/src/Shell'

export default function Providers({ children, games, lang, dict }: { children: ReactNode; games: GameMeta[]; lang: Lang; dict: Dict }) {
  return (
    <I18nProvider lang={lang} dict={dict}>
      <AuthProvider>
        <Shell games={games}>{children}</Shell>
      </AuthProvider>
    </I18nProvider>
  )
}
