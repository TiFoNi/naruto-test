import type { Metadata } from 'next'
import ZoomAdmin from '@/src/ZoomAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/zoom-admin.css'

export const metadata: Metadata = { title: 'Точка зума', robots: { index: false, follow: false } }

export default function ZoomAdminPage() {
  return <ZoomAdmin />
}
