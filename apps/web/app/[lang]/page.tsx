import Dashboard from '@/src/Dashboard'
import { gameMeta } from '@/src/games/meta.server'

export default function HomePage() {
  return <Dashboard games={gameMeta()} />
}
