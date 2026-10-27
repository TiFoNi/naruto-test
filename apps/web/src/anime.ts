'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Game } from './games/types'

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

export function useOnlyView(game: Game, on: boolean) {
  const { columns, only, entities } = game
  return useMemo(() => {
    if (!on || !only) return game
    return { ...game, columns: columns.map((column) => only[column.key] ?? column), entities: entities.filter((one) => one.anime !== false) }
  }, [game, columns, only, entities, on])
}
