'use client'

import { useEffect, useState } from 'react'
import { api } from './api'
import type { Entity, Game } from './games/types'

const RETRY_MS = 2_000
const RETRY_MAX_MS = 10_000

const loaded = new Set<string>()
const pending = new Map<string, Promise<void>>()

async function fetchInto(game: Game) {
  const { ok, data } = await api<{ entities?: Entity[]; updated?: string; atlas?: string }>(`entities?game=${game.id}`)
  if (!ok || !Array.isArray(data.entities)) throw new Error('entities')
  game.entities = data.entities
  game.updated = data.updated
  if (data.atlas) game.atlas = { ...game.atlas, version: data.atlas }
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
    let tries = 0
    let timer = 0
    const load = () => {
      let run = pending.get(game.id)
      if (!run) {
        run = fetchInto(game).finally(() => pending.delete(game.id))
        pending.set(game.id, run)
      }
      run
        .then(() => alive && setReady(true))
        .catch(() => {
          if (!alive) return
          tries += 1
          timer = window.setTimeout(load, Math.min(RETRY_MS * tries, RETRY_MAX_MS))
        })
    }
    load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [game])

  return ready
}
