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
  daily?: string
  nextAt?: number
  yesterdayId?: number | null
}

type RoundResponse = { round?: RoundView; stats?: { key: string; value: Stats } | null }

export type Guess = { entity: Entity; judgement?: Record<string, Judgement>; pending?: boolean }

export function useRound(game: Game, mode: ModeId, active: boolean, daily = false) {
  const { setStats, expire } = useAuth()
  const [round, setRound] = useState<RoundView | null>(null)
  const [pending, setPending] = useState<Entity | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(game.entities.map((e) => [e.id, e])), [game])

  const accept = useCallback(
    ({ ok, status, data }: { ok: boolean; status: number; data: RoundResponse & { error?: string } }) => {
      if (status === 401) return expire()
      if (!ok || !data.round) return setError(data.error ?? 'server')
      setError(null)
      const next = data.round
      setRound((prev) =>
        prev && prev.id === next.id
          ? { ...prev, ...next, number: next.number ?? prev.number, nextAt: next.nextAt ?? prev.nextAt, yesterdayId: next.yesterdayId ?? prev.yesterdayId, daily: next.daily ?? prev.daily }
          : next,
      )
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
        setPending(null)
      }
    },
    [accept],
  )

  const load = useCallback(() => request('round/current', { game: game.id, mode, daily }), [request, game.id, mode, daily])

  useEffect(() => {
    if (active && !round && !busy && !error) load()
  }, [active, round, busy, error, load])

  const guesses: Guess[] = useMemo(() => {
    const done = (round?.guesses ?? [])
      .map((g) => ({ entity: byId.get(g.id)!, judgement: g.judgement }))
      .filter((g) => g.entity)
      .reverse()
    return pending && !done.some((g) => g.entity.id === pending.id) ? [{ entity: pending, pending: true }, ...done] : done
  }, [round, byId, pending])
  const exclude = useMemo(() => new Set(guesses.map((g) => g.entity.id)), [guesses])
  const over = round ? round.status !== 'active' : false
  const won = round?.status === 'won'
  const skipped = round?.status === 'skipped'
  const answer = round?.answerId !== undefined ? byId.get(round.answerId) : undefined
  const yesterday = round?.yesterdayId != null ? byId.get(round.yesterdayId) : undefined

  const guess = (entity: Entity) => {
    if (!round || over || busy || exclude.has(entity.id)) return
    setPending(entity)
    request('round/guess', { roundId: round.id, entityId: entity.id, game: game.id })
  }

  const giveUp = () => {
    if (round && !over && !busy) request('round/giveup', { roundId: round.id })
  }

  const next = () => {
    setRound(null)
    setError(null)
  }

  const retry = () => setError(null)

  return { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry }
}
