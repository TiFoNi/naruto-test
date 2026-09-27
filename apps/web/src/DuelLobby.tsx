'use client'

import { useEffect, useState } from 'react'
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
    api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create' })
      .then(({ ok, data }) => {
        if (!alive) return
        if (ok && data.duel) navigate.replace(href.duel(data.duel.code))
        else setError(data.error ?? 'server')
      })
      .catch(() => alive && setError('network'))
    return () => {
      alive = false
    }
  }, [href, navigate])

  return <div className="card center muted page-loading">{error ? errorText(error) : t('loading')}</div>
}
