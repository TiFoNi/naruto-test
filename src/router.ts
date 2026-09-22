import { useEffect, useState } from 'react'
import { GAMES } from './games'
import type { GameId } from './games/types'
import type { ModeId } from './modes'

export type Route = { name: 'home' } | { name: 'profile' } | { name: 'play'; game: GameId; mode: ModeId }

export const href = {
  home: '#/',
  profile: '#/profile',
  play: (game: GameId, mode: ModeId) => `#/play/${game}/${mode}`,
}

function parse(hash: string): Route {
  const [, section, gameId, modeId] = hash.replace(/^#/, '').split('/')
  if (section === 'profile') return { name: 'profile' }
  if (section === 'play') {
    const game = GAMES.find((g) => g.id === gameId)
    if (game) {
      const mode = game.modes.includes(modeId as ModeId) ? (modeId as ModeId) : game.modes[0]
      return { name: 'play', game: game.id, mode }
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
