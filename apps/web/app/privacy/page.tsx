import type { Metadata } from 'next'
import Legal from '@/src/Legal'
import { privacy } from '@/src/legal-text'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description: 'Какие данные собирает NandaGuessr, зачем и как их удалить.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return <Legal {...privacy} />
}
