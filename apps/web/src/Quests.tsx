'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import { CalendarIcon, CheckIcon, GiftIcon, GlobeIcon, GridIcon, MedalIcon, PageIcon, PictureIcon, PlayIcon, CloseIcon, PuzzleIcon, RefreshIcon, SparkIcon, SwapIcon, SwordsIcon, TrophyIcon } from './icons'
import { keepPerUser } from './session-cache'
import Ticker from './Ticker'

export type Level = { xp: number; level: number; into: number; need: number }

export type Board = {
  day: string
  resetAt: number
  quests: { id: string; goal: number; xp: number; value: number; done: boolean; claimed: boolean }[]
  free: { xp: number; claimed: boolean }
  bonus: { xp: number; coins: number; claimed: boolean; ready: boolean }
  collected: number
  total: number
  swap: boolean
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

export function QuestsGhost() {
  const { t } = useI18n()

  return (
    <section className="card quests-card">
      <header>
        <h2>{t('profile.questsTitle')}</h2>
      </header>

      <ul className="quests">
        {[0, 1, 2, 3].map((index) => (
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
              <span className="quest-count">
                <i aria-hidden>12/12</i>&nbsp;
              </span>
            </span>
          </li>
        ))}

        <li>
          <span className="bonus is-skeleton" aria-hidden>
            <span className="bonus-gift" />
            <span className="bonus-label">&nbsp;</span>
            <span className="bonus-count">
              <i aria-hidden>12/12</i>&nbsp;
            </span>
          </span>
        </li>
      </ul>
    </section>
  )
}

const widestCount = (board: Board) => {
  const all = [...board.quests.map((quest) => `${quest.value}/${quest.goal}`), board.free.claimed ? '1/1' : '0/1', `${board.collected}/${board.total}`]
  return all.reduce((best, one) => (one.length > best.length ? one : best), '')
}

export default function Quests() {
  const { refresh } = useAuth()
  const { t } = useI18n()
  const [board, setBoard] = useState<Board | null>(known)
  const [swapping, setSwapping] = useState(false)
  const [poke, setPoke] = useState({ id: '', turn: 0 })
  const [asking, setAsking] = useState<string | null>(null)
  const [tip, setTip] = useState(false)

  const remember = (next: Board) => {
    known = next
    setBoard(next)
  }

  const load = useCallback(async () => {
    const { ok, data } = await api<Board>('quests')
    if (!ok) return
    if (data.bonus.claimed && !known?.bonus.claimed) void refresh()
    remember(data)
  }, [refresh])

  useEffect(() => {
    void load()
    const reload = () => document.visibilityState === 'visible' && void load()
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', reload)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', reload)
    }
  }, [load])

  const swap = async (id: string) => {
    setSwapping(true)
    const { ok, data } = await api<Board>('quests/swap', { swap: id })
    setSwapping(false)
    if (ok) remember(data)
  }

  const widest = board ? widestCount(board) : '12/12'
  const nudge = (id: string) => setPoke((one) => ({ id, turn: one.id === id ? one.turn + 1 : 1 }))
  const turnOf = (id: string) => (poke.id === id ? poke.turn : 0)

  return (
    <section className="card quests-card">
      <header className="quests-head">
        <h2>{t('profile.questsTitle')}</h2>
        {board?.quests.some((quest) => !quest.done) && (
          <span className={`quests-swap ${tip ? 'is-open' : ''} ${board.swap ? '' : 'is-used'}`}>
            <button
              type="button"
              aria-label={t(board.swap ? 'quests.swapTip' : 'quests.swapUsed')}
              aria-expanded={tip}
              onClick={() => setTip((was) => !was)}
              onBlur={() => setTip(false)}
            >
              <SwapIcon />
              {board.swap && <i>1</i>}
            </button>
            <span className="quests-swap-tip" role="tooltip">
              {t(board.swap ? 'quests.swapTip' : 'quests.swapUsed')}
            </span>
          </span>
        )}
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
                <span className="quest-count">
                  <i aria-hidden>12/12</i>&nbsp;
                </span>
              </span>
            </li>
          ))}

        {!board && (
          <li>
            <span className="bonus is-skeleton" aria-hidden>
              <span className="bonus-gift" />
              <span className="bonus-label">&nbsp;</span>
              <span className="bonus-count">
              <i aria-hidden>12/12</i>&nbsp;
            </span>
            </span>
          </li>
        )}

        {(board?.quests ?? []).map((quest) => (
          <li key={quest.id}>
            <button
              type="button"
              className={`quest ${quest.claimed ? 'is-claimed' : board?.swap && !quest.done ? 'is-swappable' : ''}`}
              title={board?.swap && !quest.claimed && !quest.done ? t('quests.swapTitle') : undefined}
              onClick={() => (board?.swap && !quest.claimed && !quest.done ? setAsking(quest.id) : nudge(quest.id))}
            >
              <span className="quest-icon" aria-hidden>
                {quest.claimed ? <CheckIcon /> : iconOf(quest.id)}
              </span>
              <span className="quest-main">
                <span className="quest-head">
                  <Ticker className="quest-name" play={turnOf(quest.id)}>
                    {t(`quest.${quest.id}` as UiKey)}
                  </Ticker>
                  <span className="quest-xp">+{quest.xp}</span>
                </span>
                <span className="quest-bar">
                  <i style={{ width: `${Math.round((quest.value / quest.goal) * 100)}%` }} />
                </span>
              </span>
              <span className="quest-count">
                <i aria-hidden>{widest}</i>
                {quest.value}/{quest.goal}
              </span>
            </button>
          </li>
        ))}

        {board && (
          <li>
            <button
              type="button"
              className={`quest ${board.free.claimed ? 'is-claimed' : ''}`}
              onClick={() => nudge('free')}
            >
              <span className="quest-icon" aria-hidden>
                {board.free.claimed ? <CheckIcon /> : <CalendarIcon />}
              </span>
              <span className="quest-main">
                <span className="quest-head">
                  <Ticker className="quest-name" play={turnOf('free')}>
                    {t('quests.free')}
                  </Ticker>
                  <span className="quest-xp">+{board.free.xp}</span>
                </span>
                <span className="quest-bar">
                  <i style={{ width: board.free.claimed ? '100%' : '0%' }} />
                </span>
              </span>
              <span className="quest-count">
                <i aria-hidden>{widest}</i>
                {board.free.claimed ? '1/1' : '0/1'}
              </span>
            </button>
          </li>
        )}

        {board && (
          <li>
            <button
              type="button"
              className={`bonus ${board.bonus.claimed ? 'is-claimed' : ''}`}
              onClick={() => nudge('bonus')}
            >
              <span className="bonus-gift" aria-hidden>
                {board.bonus.claimed ? <CheckIcon /> : <GiftIcon />}
              </span>
              <Ticker className="bonus-label" play={turnOf('bonus')}>
                {t('quests.bonus')}: <b>+{board.bonus.xp} XP</b>
                {board.bonus.coins > 0 && <b className="bonus-coins">{t('quest.coins', { count: board.bonus.coins })}</b>}
              </Ticker>
              <span className="bonus-count">
                <i aria-hidden>{widest}</i>
                {board.collected}/{board.total}
              </span>
            </button>
          </li>
        )}

      </ul>

      {asking &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setAsking(null)} role="presentation">
            <section
              className="card modal give-up-ask"
              role="dialog"
              aria-modal="true"
              aria-label={t('quests.swapTitle')}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" onClick={() => setAsking(null)} aria-label={t('quests.swapNo')}>
                <CloseIcon />
              </button>
              <span className="quest-swap-art" aria-hidden>
                {iconOf(asking)}
                <RefreshIcon />
              </span>
              <h2>{t('quests.swapTitle')}</h2>
              <p className="muted">{t('quests.swapHint').replace('{name}', t(`quest.${asking}` as UiKey))}</p>
              <div className="give-up-actions">
                <button type="button" className="ghost" onClick={() => setAsking(null)}>
                  {t('quests.swapNo')}
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={swapping}
                  onClick={() => {
                    const id = asking
                    setAsking(null)
                    void swap(id)
                  }}
                >
                  {t('quests.swapYes')}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </section>
  )
}
