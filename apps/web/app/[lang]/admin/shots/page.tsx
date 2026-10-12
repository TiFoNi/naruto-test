import type { Metadata } from 'next'
import ShotsAdmin from '@/src/ShotsAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/shots-admin.css'

export const metadata: Metadata = { title: 'Кадры аниме', robots: { index: false, follow: false } }

export default function ShotsAdminPage() {
  return <ShotsAdmin />
}
