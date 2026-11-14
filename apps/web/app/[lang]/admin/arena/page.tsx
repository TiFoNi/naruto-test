import type { Metadata } from 'next'
import ArenaAdmin from '@/src/ArenaAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/arena-admin.css'

export const metadata: Metadata = { title: 'Арена', robots: { index: false, follow: false } }

export default function ArenaAdminPage() {
  return <ArenaAdmin />
}
