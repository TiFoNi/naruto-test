import type { Metadata } from 'next'
import FrameAdmin from '@/src/FrameAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/frame-admin.css'

export const metadata: Metadata = { title: 'Посадка рамок', robots: { index: false, follow: false } }

export default function FrameAdminPage() {
  return <FrameAdmin />
}
