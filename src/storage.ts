import { useEffect, useState } from 'react'

export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      return
    }
  }, [key, value])
  return [value, setValue] as const
}

export type Stats = { solved: number; streak: number; best: number; totalGuesses: number }
export const emptyStats: Stats = { solved: 0, streak: 0, best: 0, totalGuesses: 0 }
