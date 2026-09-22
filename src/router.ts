import { useEffect, useState } from 'react'
import { GAMES } from './games'
import type { GameId } from './games/types'
import type { ModeId } from './modes'

export type Route =
  | { name: 'home' }
  | { name: 'profile' }
  | { name: 'play'; game: GameId; mode: ModeId; daily: boolean }
  | { name: 'leaderboard'; game: GameId; mode: ModeId; daily: boolean }
  | { name: 'duels' }
  | { name: 'duel'; code: string }

export const href = {
  home: '#/',
  profile: '#/profile',
  play: (game: GameId, mode: ModeId, daily = false) => `#/play/${game}/${mode}${daily ? '/daily' : ''}`,
  duels: '#/duels',
  duel: (code: string) => `#/duel/${code}`,
  leaderboard: (game: GameId, mode: ModeId, daily = false) => `#/leaderboard/${game}/${mode}${daily ? '/daily' : ''}`,
}

function parse(hash: string): Route {
  const [, section, gameId, modeId, variant] = hash.replace(/^#/, '').split('/')
  if (section === 'profile') return { name: 'profile' }
  if (section === 'duels') return { name: 'duels' }
  if (section === 'duel' && /^[A-Z0-9]{6}$/.test(gameId ?? '')) return { name: 'duel', code: gameId }
  if (section === 'play' || section === 'leaderboard') {
    const game = GAMES.find((g) => g.id === gameId) ?? (section === 'leaderboard' ? GAMES[0] : undefined)
    if (game) {
      const mode = game.modes.includes(modeId as ModeId) ? (modeId as ModeId) : game.modes[0]
      return { name: section, game: game.id, mode, daily: variant === 'daily' }
    }
  }
  return { name: 'home' }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export const navigate = (to: string) => {
  if (window.location.hash !== to) window.location.hash = to
}
