'use client'

import { useEffect, useState } from 'react'
import { activeDuel, setActiveDuel } from './activeDuel'
import { api } from './api'
import { useI18n } from './i18n'
import { useHref, useNavigate } from './router'

export default function DuelLobby() {
  const navigate = useNavigate()
  const href = useHref()
  const { t, error: errorText } = useI18n()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const open = async () => {
      const held = activeDuel()
      if (held) {
        const seat = await api<{ duel?: { you?: unknown } }>('duel', { code: held, action: 'state' }).catch(() => null)
        if (!alive) return
        if (seat?.ok && seat.data.duel?.you) return navigate.replace(href.duel(held))
        setActiveDuel(null)
      }

      const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create' })
      if (!alive) return
      if (ok && data.duel) navigate.replace(href.duel(data.duel.code))
      else setError(data.error ?? 'server')
    }

    open().catch(() => alive && setError('network'))
    return () => {
      alive = false
    }
  }, [href, navigate])

  return <div className="card center muted page-loading">{error ? errorText(error) : t('loading')}</div>
}
