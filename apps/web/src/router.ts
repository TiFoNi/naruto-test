import { usePathname, useRouter } from 'next/navigation'
import type { Category, GameId } from './games/types'
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
    adminZoom: at('/admin/zoom'),
    adminTitles: at('/admin/titles'),
    adminQuizzes: at('/admin/quizzes'),
    adminFrames: at('/admin/frames'),
    duels: at('/duels'),
    privacy: at('/privacy'),
    terms: at('/terms'),
    refunds: at('/refunds'),
    sources: at('/sources'),
    support: at('/support'),
    duel: (code: string) => at(`/duel/${code}`),
    challenge: (code: string) => at(`/c/${code}`),
    world: (game: GameId) => at(`/play/${game}`),
    tests: (category: Category) => at(`/tests/${category}`),
    test: (game: GameId, id: string) => at(`/play/${game}/tests/${id}`),
    play: (game: GameId, mode: ModeId, daily = false) => at(`/play/${game}/${mode}${variant(daily)}`),
    board: at('/leaderboard'),
    leaderboard: (game: GameId, mode: ModeId) => at(`/leaderboard/${game}/${mode}`),
  }
}

export const useHref = () => hrefs(useI18n().lang)

const trail: string[] = []

const bare = (path: string) => path.split(/[?#]/)[0].replace(/^\/[a-z]{2}(?=\/|$)/, '').replace(/\/+$/, '') || '/'

export function useVisitTracker() {
  const pathname = usePathname()
  if (pathname === trail[trail.length - 1]) return
  if (trail.length > 1 && trail[trail.length - 2] === pathname) trail.pop()
  else trail.push(pathname)
}

export const previousPath = () => trail[trail.length - 2] ?? null

export const cameFrom = (href: string) => {
  const previous = previousPath()
  return previous !== null && bare(previous) === bare(href)
}

export function useNavigate() {
  const router = useRouter()
  const go = (to: string) => router.push(to)
  go.back = () => router.back()
  go.replace = (to: string) => {
    trail.pop()
    router.replace(to)
  }
  return go
}
