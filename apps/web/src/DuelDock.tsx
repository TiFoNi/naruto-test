'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { activeDuel, setActiveDuel, watchActiveDuel } from './activeDuel'
import { api } from './api'
import { useI18n } from './i18n'
import { CloseIcon, SwordsIcon } from './icons'
import { useHref, useNavigate } from './router'
import { openStream } from './stream'
import type { DuelView } from './useDuel'

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelDock() {
  const { t } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const path = usePathname()
  const [code, setCode] = useState<string | null>(null)
  const [duel, setDuel] = useState<DuelView | null>(null)
  const [, redraw] = useState(0)

  useEffect(() => {
    setCode(activeDuel())
    return watchActiveDuel(setCode)
  }, [])

  const inRoom = Boolean(code && path?.endsWith(`/duel/${code}`))

  useEffect(() => {
    if (!code || inRoom) return setDuel(null)
    return openStream(`stream/duel?code=${code}`, {
      state: (data) => {
        const view = data as DuelView | null
        if (!view?.you) return setActiveDuel(null)
        setDuel(view)
      },
    })
  }, [code, inRoom])

  useEffect(() => {
    if (!duel || duel.status !== 'playing') return
    const timer = setInterval(() => redraw((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [duel])

  if (!code || inRoom || !duel) return null

  const left = duel.endsAt ? duel.endsAt - Date.now() : 0
  const note =
    duel.status === 'playing'
      ? `${duel.rival?.nickname ?? ''} · ${clock(left)}`
      : duel.status === 'finished'
        ? t('duel.dockRound')
        : t('duel.dockLobby')

  const quit = async () => {
    await api('duel', { code, action: 'leave' }).catch(() => null)
    setActiveDuel(null)
  }

  return (
    <aside className="duel-dock">
      <button type="button" className="duel-dock-open" onClick={() => navigate(href.duel(code))}>
        <span className="duel-dock-mark" aria-hidden>
          <SwordsIcon />
        </span>
        <span className="duel-dock-text">
          <b>{t('duel.dockTitle')}</b>
          <small>{note}</small>
        </span>
      </button>
      <button type="button" className="duel-dock-quit" aria-label={t('duel.leave')} title={t('duel.leave')} onClick={() => void quit()}>
        <CloseIcon />
      </button>
    </aside>
  )
}
