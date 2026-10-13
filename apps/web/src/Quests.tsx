'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import { CalendarIcon, CheckIcon, GiftIcon, GlobeIcon, GridIcon, MedalIcon, PageIcon, PictureIcon, PlayIcon, PuzzleIcon, SparkIcon, SwordsIcon, TrophyIcon } from './icons'
import { keepPerUser } from './session-cache'

export type Level = { xp: number; level: number; into: number; need: number; rank: string; next: { from: number; id: string } | null }

export type Board = {
  day: string
  resetAt: number
  quests: { id: string; goal: number; xp: number; value: number; done: boolean; claimed: boolean }[]
  free: { xp: number; claimed: boolean }
  bonus: { xp: number; coins: number; claimed: boolean; ready: boolean }
  collected: number
  total: number
} & Level

let known: Board | null = null

keepPerUser(() => {
  known = null
})

const ICONS: Record<string, ReactNode> = {
  play: <PlayIcon />,
  solve: <TrophyIcon />,
  games: <GlobeIcon />,
  daily: <CalendarIcon />,
  perfect: <MedalIcon />,
  duel: <SwordsIcon />,
  classic: <GridIcon />,
  image: <PictureIcon />,
  ability: <SparkIcon />,
  page: <PageIcon />,
  odd: <PuzzleIcon />,
  free: <CalendarIcon />,
}

const iconOf = (id: string) => ICONS[id.replace(/\d+$/, '')] ?? <PlayIcon />

export default function Quests({ onLevel }: { onLevel?: (level: Level) => void }) {
  const { refresh } = useAuth()
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
    const refresh = () => document.visibilityState === 'visible' && void load()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const claim = async (id: string) => {
    setClaiming(id)
    const { ok, data } = await api<Board & { coins?: number }>('quests/claim', { claim: id })
    setClaiming(null)
    if (!ok) return
    remember(data)
    onLevel?.(data)
    if (data.coins) void refresh()
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
          [0, 1, 2, 3].map((index) => (
            <li key={index}>
              <span className="quest is-skeleton" aria-hidden>
                <span className="quest-icon" />
                <span className="quest-main">
                  <span className="quest-head">
                    <span className="quest-name">&nbsp;</span>
                  </span>
                  <span className="quest-bar">
                    <i style={{ width: 0 }} />
                  </span>
                </span>
                <span className="quest-count">&nbsp;</span>
              </span>
            </li>
          ))}

        {!board && (
          <li>
            <span className="bonus is-skeleton" aria-hidden>
              <span className="bonus-gift" />
              <span className="bonus-label">&nbsp;</span>
              <span className="bonus-count">&nbsp;</span>
            </span>
          </li>
        )}

        {(board?.quests ?? []).map((quest) => (
          <li key={quest.id}>
            <button
              type="button"
              className={`quest ${quest.claimed ? 'is-claimed' : quest.done ? 'is-ready' : ''}`}
              disabled={!quest.done || quest.claimed || claiming === quest.id}
              title={quest.done && !quest.claimed ? t('quests.take') : undefined}
              onClick={() => claim(quest.id)}
            >
              <span className="quest-icon" aria-hidden>
                {quest.claimed ? <CheckIcon /> : iconOf(quest.id)}
              </span>
              <span className="quest-main">
                <span className="quest-head">
                  <span className="quest-name">{t(`quest.${quest.id}` as UiKey)}</span>
                  <span className="quest-xp">+{quest.xp}</span>
                </span>
                <span className="quest-bar">
                  <i style={{ width: `${Math.round((quest.value / quest.goal) * 100)}%` }} />
                </span>
              </span>
              <span className="quest-count">
                {quest.value}/{quest.goal}
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
              title={board.free.claimed ? undefined : t('quests.take')}
              onClick={() => claim('free')}
            >
              <span className="quest-icon" aria-hidden>
                {board.free.claimed ? <CheckIcon /> : <CalendarIcon />}
              </span>
              <span className="quest-main">
                <span className="quest-head">
                  <span className="quest-name">{t('quests.free')}</span>
                  <span className="quest-xp">+{board.free.xp}</span>
                </span>
                <span className="quest-bar">
                  <i style={{ width: board.free.claimed ? '100%' : '0%' }} />
                </span>
              </span>
              <span className="quest-count">{board.free.claimed ? '1/1' : '0/1'}</span>
            </button>
          </li>
        )}

        {board && (
          <li>
            <button
              type="button"
              className={`bonus ${board.bonus.claimed ? 'is-claimed' : board.bonus.ready ? 'is-ready' : ''}`}
              disabled={!board.bonus.ready || board.bonus.claimed || claiming === 'bonus'}
              title={board.bonus.ready && !board.bonus.claimed ? t('quests.take') : undefined}
              onClick={() => claim('bonus')}
            >
              <span className="bonus-gift" aria-hidden>
                {board.bonus.claimed ? <CheckIcon /> : <GiftIcon />}
              </span>
              <span className="bonus-label">
                {t('quests.bonus')} — <b>+{board.bonus.xp} XP</b>
                {board.bonus.coins > 0 && <b className="bonus-coins">{t('quest.coins', { count: board.bonus.coins })}</b>}
              </span>
              <span className="bonus-count">
                {board.collected}/{board.total}
              </span>
            </button>
          </li>
        )}

      </ul>
    </section>
  )
}
