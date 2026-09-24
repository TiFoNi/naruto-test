import type { Metadata } from 'next'
import Landing from '@/src/Landing'
import { gameMeta } from '@/src/games/meta.server'

export const metadata: Metadata = {
  title: 'Вход',
  description: 'Войди в NandaGuessr, чтобы сохранять прогресс, серии и играть в дуэлях.',
  robots: { index: false },
}

export default async function LoginPage() {
  return <Landing games={await gameMeta()} />
}
