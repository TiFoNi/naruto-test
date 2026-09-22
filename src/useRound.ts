import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import type { Entity, Game, Judgement } from './games/types'
import type { ModeId } from './modes'
import type { Stats } from './stats'

export type RoundView = {
  id: string
  number: number
  status: 'active' | 'won' | 'lost' | 'skipped'
  guesses: { id: number; judgement?: Record<string, Judgement> }[]
  answerId?: number
  image?: string
}

type RoundResponse = { round?: RoundView; stats?: { key: string; value: Stats } | null }

export type Guess = { entity: Entity; judgement?: Record<string, Judgement> }

export function useRound(game: Game, mode: ModeId, active: boolean) {
  const { setStats, expire } = useAuth()
  const [round, setRound] = useState<RoundView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(game.entities.map((e) => [e.id, e])), [game])

  const accept = useCallback(
    ({ ok, status, data }: { ok: boolean; status: number; data: RoundResponse & { error?: string } }) => {
      if (status === 401) return expire()
      if (!ok || !data.round) return setError(data.error ?? 'server')
      setError(null)
      setRound(data.round)
      if (data.stats) setStats(data.stats.key, data.stats.value)
    },
    [expire, setStats],
  )

  const request = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true)
      try {
        accept(await api<RoundResponse>(path, body))
      } catch {
        setError('network')
      } finally {
        setBusy(false)
      }
    },
    [accept],
  )

  const load = useCallback(() => request('round/current', { game: game.id, mode }), [request, game.id, mode])

  useEffect(() => {
    if (active && !round && !busy && !error) load()
  }, [active, round, busy, error, load])

  const guesses: Guess[] = useMemo(
    () =>
      (round?.guesses ?? [])
        .map((g) => ({ entity: byId.get(g.id)!, judgement: g.judgement }))
        .filter((g) => g.entity)
        .reverse(),
    [round, byId],
  )
  const exclude = useMemo(() => new Set(guesses.map((g) => g.entity.id)), [guesses])
  const over = round ? round.status !== 'active' : false
  const won = round?.status === 'won'
  const skipped = round?.status === 'skipped'
  const answer = round?.answerId !== undefined ? byId.get(round.answerId) : undefined

  const guess = (entity: Entity) => {
    if (!round || over || busy || exclude.has(entity.id)) return
    request('round/guess', { roundId: round.id, entityId: entity.id })
  }

  const giveUp = () => {
    if (round && !over && !busy) request('round/giveup', { roundId: round.id })
  }

  const next = () => {
    setRound(null)
    setError(null)
  }

  const retry = () => setError(null)

  return { round, guesses, exclude, over, won, skipped, answer, busy, error, guess, giveUp, next, retry }
}
