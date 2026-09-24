import type { Metadata } from 'next'
import Legal from '@/src/Legal'
import { terms } from '@/src/legal-text'

export const metadata: Metadata = {
  title: 'Условия использования',
  description: 'Правила пользования NandaGuessr.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return <Legal {...terms} />
}
