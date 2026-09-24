import Dashboard from '@/src/Dashboard'
import { gameMeta } from '@/src/games/meta.server'

export default async function HomePage() {
  return <Dashboard games={await gameMeta()} />
}
