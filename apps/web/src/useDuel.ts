import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import type { Entity } from './games/types'
import type { Judgement } from '@nanda/game'

export type DuelSide = { nickname: string; ready: boolean; wantsNext: boolean; wins: number; solved: boolean; gaveUp: boolean }

export type DuelView = {
  code: string
  game: string | null
  mode: string | null
  status: 'lobby' | 'playing' | 'finished'
  best: number
  seconds: number
  needed: number
  matchDone: boolean
  invited: string | null
  declined: boolean
  left: string | null
  round: number
  draws: number
  host: boolean
  now: number
  startedAt?: number
  endsAt?: number
  hintAt?: number
  ability?: { ru: string; uk: string; en: string }
  image?: string
  options?: number[]
  lines?: { text: string; ru?: string }[]
  linesLeft?: number
  voice?: string
  answerId?: number
  winner?: string | null
  youWon?: boolean
  you?: DuelSide & { guesses: { id: number; judgement?: Record<string, Judgement> }[] }
  rival?: DuelSide & { guessCount: number }
}

const POLL_MS = 2000
const HIDDEN_EVERY = 3
const GUESS_GAP_MS = 1000

export function useDuel(code: string) {
  const { expire, refresh } = useAuth()
  const [duel, setDuel] = useState<DuelView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Entity | null>(null)
  const [cooling, setCooling] = useState(false)
  const offset = useRef(0)
  const lastStatus = useRef<DuelView['status'] | null>(null)
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
        if (data.duel.status === 'finished' && lastStatus.current !== 'finished') refresh()
        lastStatus.current = data.duel.status
        setDuel(data.duel)
        setPending(null)
      } catch {
        if (!quiet) setError('network')
      } finally {
        if (!quiet) setBusy(false)
      }
    },
    [code, expire, refresh],
  )

  useEffect(() => {
    send({ action: 'join' })
  }, [send])

  useEffect(() => {
    let ticks = 0
    const timer = setInterval(() => {
      ticks += 1
      if (document.visibilityState === 'visible' || ticks % HIDDEN_EVERY === 0) send({ action: 'state' }, true)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [send])

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
    setup: (patch: { game?: string; mode?: string; best?: number; seconds?: number }) =>
      send({
        action: 'setup',
        game: patch.game ?? duel?.game ?? 'naruto',
        mode: patch.mode ?? duel?.mode ?? 'classic',
        best: patch.best ?? duel?.best,
        seconds: patch.seconds ?? duel?.seconds,
      }),
    invite: (to: string) => send({ action: 'invite', to }),
    next: () => send({ action: 'next' }),
    toLobby: () => send({ action: 'lobby' }),
    giveUp: () => send({ action: 'giveup' }),
    refresh: () => send({ action: 'state' }),
    guess,
  }
}
