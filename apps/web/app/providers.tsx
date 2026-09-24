'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/src/auth'
import type { GameMeta } from '@/src/games/meta'
import { I18nProvider } from '@/src/i18n'
import Shell from '@/src/Shell'

export default function Providers({ children, games }: { children: ReactNode; games: GameMeta[] }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <Shell games={games}>{children}</Shell>
      </AuthProvider>
    </I18nProvider>
  )
}
