'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import { CheckIcon, GiftIcon } from './icons'

const BONUS = 120

export type Level = { xp: number; level: number; into: number; need: number; rank: string; next: { from: number; id: string } | null }

export type Board = {
  day: string
  resetAt: number
  quests: { id: string; goal: number; xp: number; value: number; done: boolean; claimed: boolean }[]
  free: { xp: number; claimed: boolean }
  bonus: { xp: number; claimed: boolean; ready: boolean }
  collected: number
  total: number
} & Level

export default function Quests({ onLevel }: { onLevel?: (level: Level) => void }) {
  const { t } = useI18n()
  const [board, setBoard] = useState<Board | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await api<Board>('quests')
    if (ok) setBoard(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const claim = async (id: string) => {
    setClaiming(id)
    const { ok, data } = await api<Board>('quests/claim', { claim: id })
    setClaiming(null)
    if (!ok) return
    setBoard(data)
    onLevel?.(data)
  }

  const left = (() => {
    if (!board) return '—'
    const ms = Math.max(board.resetAt - Date.now(), 0)
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}:${String(minutes).padStart(2, '0')}`
  })()

  const rows = board?.quests ?? []
  const ring = board ? Math.round((board.collected / board.total) * 100) : 0

  return (
    <section className="card quests-card">
      <header className="quests-head">
        <span className="quests-ring" style={{ '--filled': `${ring}%` } as CSSProperties} aria-hidden>
          <b>
            {board?.collected ?? 0}/{board?.total ?? 4}
          </b>
        </span>
        <span className="quests-title">
          <h2>{t('profile.questsTitle')}</h2>
          <small className="muted">{t('quests.reset', { time: left })}</small>
        </span>
        <span className={`quests-gift ${board?.bonus.ready && !board.bonus.claimed ? 'is-ready' : ''}`}>
          <GiftIcon />+{board?.bonus.xp ?? BONUS}
        </span>
      </header>

      <ul className="quests">
        {rows.map((quest) => (
          <li key={quest.id}>
            <button
              type="button"
              className={`quest ${quest.claimed ? 'is-claimed' : quest.done ? 'is-ready' : ''}`}
              disabled={!quest.done || quest.claimed || claiming === quest.id}
              onClick={() => claim(quest.id)}
            >
              <span className={`quest-mark ${quest.claimed ? 'done' : quest.done ? 'ready' : ''}`} aria-hidden>
                {quest.claimed ? <CheckIcon /> : null}
              </span>
              <span className="quest-name">{t(`quest.${quest.id}` as UiKey)}</span>
              <span className="quest-xp">+{quest.xp} XP</span>
              {!quest.claimed && !quest.done && (
                <>
                  <span className="quest-bar">
                    <i style={{ width: `${Math.round((quest.value / quest.goal) * 100)}%` }} />
                  </span>
                  <span className="quest-count muted">
                    {quest.value}/{quest.goal}
                  </span>
                </>
              )}
            </button>
          </li>
        ))}

        {board && (
          <li>
            <button
              type="button"
              className={`quest ${board.free.claimed ? 'is-claimed' : 'is-ready'}`}
              disabled={board.free.claimed || claiming === 'free'}
              onClick={() => claim('free')}
            >
              <span className={`quest-mark ${board.free.claimed ? 'done' : 'ready'}`} aria-hidden>
                {board.free.claimed ? <CheckIcon /> : null}
              </span>
              <span className="quest-name">{t('quests.free')}</span>
              <span className="quest-xp">+{board.free.xp} XP</span>
            </button>
          </li>
        )}
      </ul>

      {board && (
        <button
          type="button"
          className={`quests-bonus ${board.bonus.claimed ? 'is-claimed' : board.bonus.ready ? 'is-ready' : ''}`}
          disabled={!board.bonus.ready || board.bonus.claimed || claiming === 'bonus'}
          onClick={() => claim('bonus')}
        >
          <span className="muted">{t('quests.bonus')}</span>
          <span className="bonus-steps">
            {Array.from({ length: board.total }, (_, index) => (
              <i key={index} className={index < board.collected ? 'on' : ''} />
            ))}
          </span>
          <span className="quests-more">{t('quests.all')}</span>
        </button>
      )}
    </section>
  )
}
