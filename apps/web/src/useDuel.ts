import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { openStream } from './stream'
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
  focus?: { x: number; y: number }
  shot?: string
  zoom?: number
  size?: number
  sizes?: number[]
  first?: string | null
  youFirst?: boolean
  secret?: number | null
  picking?: boolean
  rivalPicked?: boolean
  cards?: number[]
  struck?: number[]
  rivalLeft?: number
  rivalSecret?: number
  yourAnswer?: number
  rivalAnswer?: number
  options?: number[]
  lines?: { text: string; ru?: string }[]
  linesLeft?: number
  voice?: string
  answerId?: number
  winner?: string | null
  youWon?: boolean
  you?: DuelSide & { guesses: { id: number; judgement?: Record<string, Judgement> }[] }
  rival?: DuelSide & { guessCount: number; board?: Record<string, string>[] }
}

const FALLBACK_MS = 3000
const GUESS_GAP_MS = 1000

export function useDuel(code: string) {
  const { expire, refresh } = useAuth()
  const [duel, setDuel] = useState<DuelView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Entity | null>(null)
  const [cooling, setCooling] = useState(false)
  const [live, setLive] = useState(false)
  const offset = useRef(0)
  const lastStatus = useRef<DuelView['status'] | null>(null)
  const lastGuess = useRef(0)
  const coolTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const apply = useCallback(
    (view: DuelView) => {
      offset.current = view.now - Date.now()
      setError(null)
      if (view.status === 'finished' && lastStatus.current !== 'finished') refresh()
      lastStatus.current = view.status
      setDuel((old) => (view.shot || !old?.shot ? view : { ...view, shot: old.shot }))
      setPending(null)
    },
    [refresh],
  )

  const send = useCallback(
    async (body: Record<string, unknown>, quiet = false) => {
      if (!quiet) setBusy(true)
      try {
        const { ok, status, data } = await api<{ duel?: DuelView; error?: string }>('duel', { code, ...body })
        if (status === 401) return expire()
        if (status === 429) return
        if (!ok || !data.duel) return setError(data.error ?? 'server')
        apply(data.duel)
      } catch {
        if (!quiet) setError('network')
      } finally {
        if (!quiet) setBusy(false)
      }
    },
    [apply, code, expire],
  )

  useEffect(() => {
    send({ action: 'join' })
  }, [send])

  useEffect(
    () =>
      openStream(
        `stream/duel?code=${code}`,
        {
          state: (data) => apply(data as DuelView),
          gone: () => {
            setDuel(null)
            setError('not_found')
          },
        },
        setLive,
      ),
    [apply, code],
  )

  useEffect(() => {
    if (live) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') send({ action: 'state' }, true)
    }, FALLBACK_MS)
    return () => clearInterval(timer)
  }, [live, send])

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
    setup: (patch: { game?: string; mode?: string; best?: number; seconds?: number; size?: number }) =>
      send({
        action: 'setup',
        game: patch.game ?? duel?.game ?? 'naruto',
        mode: patch.mode ?? duel?.mode ?? 'classic',
        best: patch.best ?? duel?.best,
        seconds: patch.seconds ?? duel?.seconds,
        size: patch.size ?? duel?.size,
      }),
    invite: (to: string) => send({ action: 'invite', to }),
    next: () => send({ action: 'next' }),
    toLobby: () => send({ action: 'lobby' }),
    giveUp: () => send({ action: 'giveup' }),
    pick: (entityId: number) => send({ action: 'pick', entityId }),
    strike: (entityId: number) => send({ action: 'strike', entityId }),
    answer: (entityId: number) => send({ action: 'answer', entityId }),
    refresh: () => send({ action: 'state' }),
    guess,
  }
}
