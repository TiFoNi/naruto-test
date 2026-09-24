import { useRouter } from 'next/navigation'
import type { GameId } from './games/types'
import type { ModeId } from './modes'

const variant = (daily: boolean) => (daily ? '/daily' : '')

export const href = {
  home: '/',
  login: '/login',
  profile: '/profile',
  duels: '/duels',
  duel: (code: string) => `/duel/${code}`,
  challenge: (code: string) => `/c/${code}`,
  play: (game: GameId, mode: ModeId, daily = false) => `/play/${game}/${mode}${variant(daily)}`,
  leaderboard: (game: GameId, mode: ModeId, daily = false) => `/leaderboard/${game}/${mode}${variant(daily)}`,
}

export function useNavigate() {
  const router = useRouter()
  return (to: string) => router.push(to)
}
