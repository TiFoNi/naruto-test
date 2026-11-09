import type { Metadata } from 'next'
import DifficultyAdmin from '@/src/DifficultyAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/activity-admin.css'
import '@/src/styles/difficulty-admin.css'

export const metadata: Metadata = { title: 'Сложность', robots: { index: false, follow: false } }

export default function DifficultyAdminPage() {
  return <DifficultyAdmin />
}
