import Dashboard from '@/src/Dashboard'
import { gameMeta } from '@/src/games/meta.server'
import '@/src/styles/home.css'

export const revalidate = 600

export default async function HomePage() {
  return <Dashboard games={await gameMeta()} />
}
