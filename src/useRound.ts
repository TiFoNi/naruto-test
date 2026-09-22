import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import type { Entity, Game } from './games/types'
import type { ModeId } from './modes'
import { pickAnswer } from './util'

const storage = {
  has: (key: string) => {
    try {
      return localStorage.getItem(key) !== null
    } catch {
      return false
    }
  },
  set: (key: string) => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      return
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {
      return
    }
  },
}

type Options = { game: Game; mode: ModeId; onSolved: (guesses: number) => void; onGaveUp: () => void }

export function useRound({ game, mode, onSolved, onGaveUp }: Options) {
  const { user } = useAuth()
  const pendingKey = `round-in-progress:${user?.id ?? 'anon'}:${game.id}:${mode}`
  const [answer, setAnswer] = useState(() => pickAnswer(game))
  const [guesses, setGuesses] = useState<Entity[]>([])
  const [gaveUp, setGaveUp] = useState(false)
  const [round, setRound] = useState(1)
  const onGaveUpRef = useRef(onGaveUp)
  onGaveUpRef.current = onGaveUp

  useEffect(() => {
    if (!storage.has(pendingKey)) return
    storage.remove(pendingKey)
    onGaveUpRef.current()
  }, [pendingKey])

  const won = guesses[0]?.id === answer.id
  const over = won || gaveUp
  const exclude = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses])

  const guess = (e: Entity) => {
    if (over) return
    const next = [e, ...guesses]
    setGuesses(next)
    if (e.id === answer.id) {
      storage.remove(pendingKey)
      onSolved(next.length)
    } else {
      storage.set(pendingKey)
    }
  }

  const giveUp = () => {
    setGaveUp(true)
    storage.remove(pendingKey)
    onGaveUp()
  }

  const next = (nextAnswer: Entity = pickAnswer(game)) => {
    setAnswer(nextAnswer)
    setGuesses([])
    setGaveUp(false)
    setRound((r) => r + 1)
  }

  return { answer, guesses, won, over, round, exclude, guess, giveUp, next }
}
