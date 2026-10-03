'use client'

import { useCallback, useEffect, useState } from 'react'

const key = (game: string) => `anime-only:${game}`

const listeners = new Set<() => void>()

export function animeOnly(game: string) {
  try {
    return localStorage.getItem(key(game)) === '1'
  } catch {
    return false
  }
}

export function useAnimeOnly(game: string) {
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? false : animeOnly(game)))

  useEffect(() => {
    const sync = () => setOn(animeOnly(game))
    sync()
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [game])

  const set = useCallback(
    (value: boolean) => {
      try {
        localStorage.setItem(key(game), value ? '1' : '0')
      } catch {
        return
      }
      listeners.forEach((sync) => sync())
    },
    [game],
  )

  return [on, set] as const
}
