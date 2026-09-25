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
    duels: at('/duels'),
    privacy: at('/privacy'),
    terms: at('/terms'),
    duel: (code: string) => at(`/duel/${code}`),
    challenge: (code: string) => at(`/c/${code}`),
    play: (game: GameId, mode: ModeId, daily = false) => at(`/play/${game}/${mode}${variant(daily)}`),
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
  return go
}
