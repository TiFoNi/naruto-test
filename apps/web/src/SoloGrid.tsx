'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import DuelRoom from './DuelRoom'
import DuelSkeleton from './DuelSkeleton'
import { useI18n } from './i18n'
import type { GameId } from './games/types'

export default function SoloGrid({ game }: { game: GameId }) {
  const { t, error: errorText } = useI18n()
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setError(null)
    const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'solo', game })
    if (ok && data.duel) setCode(data.duel.code)
    else setError(data.error ?? 'failed')
  }, [game])

  useEffect(() => {
    setCode(null)
    void start()
  }, [start])

  const restart = () => {
    setCode(null)
    void start()
  }

  if (error)
    return (
      <div className="duel">
        <div className="card round-status error">
          <span>{errorText(error)}</span>
          <button className="ghost" onClick={() => void start()}>
            {t('play.retry')}
          </button>
        </div>
      </div>
    )

  if (!code) return <DuelSkeleton />

  return <DuelRoom code={code} onRestart={restart} />
}
