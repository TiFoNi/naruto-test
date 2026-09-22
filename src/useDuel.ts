import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import type { Entity } from './games/types'
import type { Judgement } from './games/specs'

export type DuelSide = { nickname: string; ready: boolean; solved: boolean; gaveUp: boolean }

export type DuelView = {
  code: string
  game: string
  mode: string
  status: 'waiting' | 'playing' | 'finished'
  now: number
  startedAt?: number
  endsAt?: number
  hintAt?: number
  ability?: { ru: string; uk: string; en: string }
  image?: string
  answerId?: number
  winner?: string | null
  youWon?: boolean
  you?: DuelSide & { guesses: { id: number; judgement?: Record<string, Judgement> }[] }
  rival?: DuelSide & { guessCount: number }
}

const POLL_MS = 2000
const GUESS_GAP_MS = 1000

export function useDuel(code: string) {
  const { expire } = useAuth()
  const [duel, setDuel] = useState<DuelView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Entity | null>(null)
  const [cooling, setCooling] = useState(false)
  const offset = useRef(0)
  const lastGuess = useRef(0)
  const coolTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const send = useCallback(
    async (body: Record<string, unknown>, quiet = false) => {
      if (!quiet) setBusy(true)
      try {
        const { ok, status, data } = await api<{ duel?: DuelView; error?: string }>('duel', { code, ...body })
        if (status === 401) return expire()
        if (status === 429) return
        if (!ok || !data.duel) return setError(data.error ?? 'server')
        offset.current = data.duel.now - Date.now()
        setError(null)
        setDuel(data.duel)
        setPending(null)
      } catch {
        if (!quiet) setError('network')
      } finally {
        if (!quiet) setBusy(false)
      }
    },
    [code, expire],
  )

  useEffect(() => {
    send({ action: 'join' })
  }, [send])

  useEffect(() => {
    if (duel?.status === 'finished') return
    const timer = setInterval(() => send({ action: 'state' }, true), POLL_MS)
    return () => clearInterval(timer)
  }, [send, duel?.status])

  useEffect(() => () => clearTimeout(coolTimer.current), [])

  const guess = (entity: Entity) => {
    if (busy || cooling || duel?.status !== 'playing') return
    const now = Date.now()
    if (now - lastGuess.current < GUESS_GAP_MS) return
    lastGuess.current = now
    setCooling(true)
    clearTimeout(coolTimer.current)
    coolTimer.current = setTimeout(() => setCooling(false), GUESS_GAP_MS)
    setPending(entity)
    send({ action: 'guess', entityId: entity.id })
  }

  return {
    duel,
    error,
    busy: busy || cooling,
    pending,
    serverNow: () => Date.now() + offset.current,
    ready: () => send({ action: 'ready' }),
    giveUp: () => send({ action: 'giveup' }),
    refresh: () => send({ action: 'state' }),
    guess,
  }
}
