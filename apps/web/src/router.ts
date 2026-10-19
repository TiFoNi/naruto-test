import { usePathname, useRouter } from 'next/navigation'
import type { GameId } from './games/types'
import { useI18n, type Lang } from './i18n'
import type { ModeId } from './modes'

const variant = (daily: boolean) => (daily ? '/daily' : '')

export function hrefs(lang: Lang) {
  const at = (path: string) => `/${lang}${path}`
  return {
    home: `/${lang}`,
    login: at('/login'),
    profile: at('/profile'),
    player: (id: string) => at(`/u/${id}`),
    playerWorlds: (id: string) => at(`/u/${id}/worlds`),
    playerAwards: (id: string) => at(`/u/${id}/achievements`),
    settings: at('/settings'),
    friends: at('/friends'),
    achievements: at('/achievements'),
    levels: at('/levels'),
    worlds: at('/worlds'),
    shop: at('/shop'),
    admin: at('/admin'),
    adminShots: at('/admin/shots'),
    duels: at('/duels'),
    privacy: at('/privacy'),
    terms: at('/terms'),
    refunds: at('/refunds'),
    sources: at('/sources'),
    support: at('/support'),
    duel: (code: string) => at(`/duel/${code}`),
    challenge: (code: string) => at(`/c/${code}`),
    world: (game: GameId) => at(`/play/${game}`),
    play: (game: GameId, mode: ModeId, daily = false) => at(`/play/${game}/${mode}${variant(daily)}`),
    board: at('/leaderboard'),
    leaderboard: (game: GameId, mode: ModeId) => at(`/leaderboard/${game}/${mode}`),
  }
}

export const useHref = () => hrefs(useI18n().lang)

let visited = 0
let lastPath: string | null = null

export function useVisitTracker() {
  const pathname = usePathname()
  if (pathname !== lastPath) {
    lastPath = pathname
    visited += 1
  }
}

export const canGoBack = () => visited > 1

export function useNavigate() {
  const router = useRouter()
  const go = (to: string) => router.push(to)
  go.back = () => router.back()
  go.replace = (to: string) => {
    visited = Math.max(0, visited - 1)
    router.replace(to)
  }
  return go
}
