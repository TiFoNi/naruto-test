'use client'

import { useEffect, useState } from 'react'
import DuelFormat from './DuelFormat'
import DuelSkeleton from './DuelSkeleton'
import { activeDuel, setActiveDuel } from './activeDuel'
import { api } from './api'
import { useI18n } from './i18n'
import { useHref, useNavigate } from './router'

export default function DuelLobby() {
  const navigate = useNavigate()
  const href = useHref()
  const { error: errorText } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState(false)

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

      setFresh(true)
    }

    open().catch(() => alive && setError('network'))
    return () => {
      alive = false
    }
  }, [href, navigate])

  if (error) return <div className="card center muted page-loading">{errorText(error)}</div>
  if (fresh) return <DuelFormat />

  return <DuelSkeleton kind="format" />
}
