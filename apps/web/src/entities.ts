'use client'

import { useEffect, useState } from 'react'
import { api } from './api'
import type { Entity, Game } from './games/types'

const loaded = new Set<string>()
const pending = new Map<string, Promise<void>>()

async function fetchInto(game: Game) {
  const { ok, data } = await api<{ entities?: Entity[]; updated?: string }>(`entities?game=${game.id}`)
  if (!ok || !Array.isArray(data.entities)) throw new Error('entities')
  game.entities = data.entities
  game.updated = data.updated
  loaded.add(game.id)
}

export function useEntities(game: Game | null | undefined) {
  const [ready, setReady] = useState(() => !game || loaded.has(game.id))

  useEffect(() => {
    if (!game || loaded.has(game.id)) {
      setReady(!game || loaded.has(game.id))
      return
    }

    setReady(false)
    let alive = true
    let run = pending.get(game.id)
    if (!run) {
      run = fetchInto(game).finally(() => pending.delete(game.id))
      pending.set(game.id, run)
    }
    run.then(() => alive && setReady(true)).catch(() => alive && setReady(false))
    return () => {
      alive = false
    }
  }, [game])

  return ready
}
