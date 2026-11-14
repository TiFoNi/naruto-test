'use client'

import { useCallback, useEffect, useState } from 'react'
import { ARENA_CARD_COST, ARENA_HERO_SLOTS, ARENA_HP, ARENA_SUMMON_SLOTS } from '@nanda/game'
import { api } from './api'
import type { ArenaView } from './ArenaCard'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { SwordsIcon } from './icons'
import { useHref, useNavigate } from './router'

export default function ArenaPanel({ game }: { game: Game }) {
  const { t, error: errorText } = useI18n()
  const href = useHref()
  const go = useNavigate()
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await api<{ arena?: ArenaView | null }>('arena')
    setLive(data.arena?.status === 'playing')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const start = async () => {
    if (live) return go(href.arena(game.id))
    setBusy(true)
    setError('')
    const { ok, data } = await api<{ arena?: ArenaView; error?: string }>('arena', { action: 'start', game: game.id })
    setBusy(false)
    if (ok && data.arena) return go(href.arena(game.id))
    setError(data.error ?? 'server')
  }

  return (
    <section className="arena-panel">
      <span className="arena-mark" aria-hidden>
        <SwordsIcon />
      </span>

      <span className="arena-panel-title">
        <h2>{t('arena.title')}</h2>
        <small>{t('arena.desc')}</small>
        <em>{t('arena.ruleLine', { heroes: ARENA_HERO_SLOTS, summons: ARENA_SUMMON_SLOTS, hp: ARENA_HP, cost: ARENA_CARD_COST })}</em>
      </span>

      {error && <p className="arena-fail">{errorText(error)}</p>}

      <button type="button" className="arena-btn is-go" disabled={busy} onClick={() => void start()}>
        {t(live ? 'arena.resume' : 'arena.start')}
      </button>
    </section>
  )
}
