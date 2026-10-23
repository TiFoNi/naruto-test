import type { Metadata } from 'next'
import TitleAdmin from '@/src/TitleAdmin'
import '@/src/styles/admin.css'

export const metadata: Metadata = { title: 'Титулы', robots: { index: false, follow: false } }


export default function TitleAdminPage() {
  return <TitleAdmin />
}
