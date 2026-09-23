'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/src/auth'
import { I18nProvider } from '@/src/i18n'
import Shell from '@/src/Shell'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <Shell>{children}</Shell>
      </AuthProvider>
    </I18nProvider>
  )
}
