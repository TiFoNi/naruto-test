'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import { GiftIcon } from './icons'
import { keepPerUser } from './session-cache'

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

let known: Board | null = null

keepPerUser(() => {
  known = null
})

export default function Quests({ onLevel }: { onLevel?: (level: Level) => void }) {
  const { t } = useI18n()
  const [board, setBoard] = useState<Board | null>(known)
  const [claiming, setClaiming] = useState<string | null>(null)

  const remember = (next: Board) => {
    known = next
    setBoard(next)
  }

  const load = useCallback(async () => {
    const { ok, data } = await api<Board>('quests')
    if (ok) remember(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const claim = async (id: string) => {
    setClaiming(id)
    const { ok, data } = await api<Board>('quests/claim', { claim: id })
    setClaiming(null)
    if (!ok) return
    remember(data)
    onLevel?.(data)
  }

  const left = (() => {
    if (!board) return '—'
    const ms = Math.max(board.resetAt - Date.now(), 0)
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}:${String(minutes).padStart(2, '0')}`
  })()

  return (
    <section className="card quests-card">
      <header>
        <h2>{t('profile.questsTitle')}</h2>
        <span className="muted">{t('quests.reset', { time: left })}</span>
      </header>

      <ul className="quests">
        {!board &&
          [0, 1, 2].map((index) => (
            <li key={index}>
              <span className="quest is-skeleton" aria-hidden>
                <span className="quest-head">
                  <span className="quest-name">&nbsp;</span>
                </span>
                <span className="quest-bar">
                  <i style={{ width: 0 }} />
                </span>
                <span className="quest-foot">
                  <span className="muted">&nbsp;</span>
                </span>
              </span>
            </li>
          ))}

        {!board && (
          <li>
            <span className="quest is-skeleton short" aria-hidden>
              <span className="quest-head">
                <span className="quest-name">&nbsp;</span>
              </span>
              <span className="quest-foot">
                <span className="muted">&nbsp;</span>
              </span>
            </span>
          </li>
        )}

        {!board && (
          <li>
            <span className="bonus is-skeleton" aria-hidden>
              <span className="bonus-gift" />
              <span className="bonus-text">
                <span className="bonus-label">&nbsp;</span>
              </span>
              <span className="bonus-count">&nbsp;</span>
              <span className="bonus-steps" />
            </span>
          </li>
        )}

        {(board?.quests ?? []).map((quest) => (
          <li key={quest.id}>
            <button
              type="button"
              className={`quest ${quest.claimed ? 'is-claimed' : quest.done ? 'is-ready' : ''}`}
              disabled={!quest.done || quest.claimed || claiming === quest.id}
              onClick={() => claim(quest.id)}
            >
              <span className="quest-head">
                <span className="quest-name">{t(`quest.${quest.id}` as UiKey)}</span>
                <span className="quest-xp">+{quest.xp} XP</span>
              </span>
              <span className="quest-bar">
                <i style={{ width: `${Math.round((quest.value / quest.goal) * 100)}%` }} />
              </span>
              <span className="quest-foot">
                <span className="muted">
                  {quest.value} / {quest.goal}
                </span>
                {quest.claimed ? (
                  <span className="quest-done">✓ {t('quests.claimed')}</span>
                ) : quest.done ? (
                  <span className="quest-take">{t('quests.take')}</span>
                ) : null}
              </span>
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
              <span className="quest-head">
                <span className="quest-name">{t('quests.free')}</span>
                <span className="quest-xp">+{board.free.xp} XP</span>
              </span>
              <span className="quest-foot">
                <span className="muted">{t('quests.freeHint')}</span>
                <span className={board.free.claimed ? 'quest-done' : 'quest-take'}>
                  {board.free.claimed ? `✓ ${t('quests.claimed')}` : t('quests.take')}
                </span>
              </span>
            </button>
          </li>
        )}

        {board && (
          <li>
            <button
              type="button"
              className={`bonus ${board.bonus.claimed ? 'is-claimed' : board.bonus.ready ? 'is-ready' : ''}`}
              disabled={!board.bonus.ready || board.bonus.claimed || claiming === 'bonus'}
              onClick={() => claim('bonus')}
            >
              <span className="bonus-gift" aria-hidden>
                <GiftIcon />
              </span>
              <span className="bonus-text">
                <span className="bonus-label">
                  {t('quests.bonus')}: <b>+{board.bonus.xp} XP</b>
                </span>
                {board.bonus.claimed ? (
                  <small className="quest-done">✓ {t('quests.claimed')}</small>
                ) : board.bonus.ready ? (
                  <small className="quest-take">{t('quests.take')}</small>
                ) : (
                  <small className="muted">{t('quests.bonusHint')}</small>
                )}
              </span>
              <span className="bonus-count">
                {board.collected}/{board.total}
              </span>
              <span className="bonus-steps">
                {Array.from({ length: board.total }, (_, index) => (
                  <i key={index} className={index < board.collected ? 'on' : ''} />
                ))}
              </span>
            </button>
          </li>
        )}

      </ul>
    </section>
  )
}
