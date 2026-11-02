import type { Metadata } from 'next'
import ActivityAdmin from '@/src/ActivityAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/activity-admin.css'

export const metadata: Metadata = { title: 'Активность', robots: { index: false, follow: false } }

export default function ActivityAdminPage() {
  return <ActivityAdmin />
}
