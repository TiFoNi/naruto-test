import type { Metadata } from 'next'
import Admin from '@/src/Admin'

export const metadata: Metadata = { title: 'Персонажи', robots: { index: false, follow: false } }

export default function AdminPage() {
  return <Admin />
}
