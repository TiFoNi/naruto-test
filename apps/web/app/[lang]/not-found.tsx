import type { Metadata } from 'next'
import NotFound from '@/src/NotFound'
import { gameMeta } from '@/src/games/meta.server'

export const metadata: Metadata = { title: '404', robots: { index: false, follow: false } }

export default async function NotFoundPage() {
  return <NotFound games={await gameMeta()} />
}
