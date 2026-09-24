import { useEffect, useState } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { useNavigate, useHref } from './router'
import Picker from './Picker'
import { CalendarIcon, ChevronIcon, InfinityIcon, MedalIcon, SortIcon } from './icons'

type Sort = 'best' | 'solved' | 'avg' | 'today' | 'time' | 'streak' | 'maxStreak'

type Row = {
  rank: number
  nickname: string
  me: boolean
  solved?: number
  best?: number
  avg?: number
  guesses?: number
  seconds?: number
  streak?: number
}

type Board = { rows: Row[]; me: Row | null; total: number; number?: number }

type Column = { label: UiKey; sort?: Sort; value: (row: Row) => string | number }

const duration = (seconds = 0) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

const COLUMNS: Record<Sort, Column[]> = {
  best: [
    { label: 'lb.colBest', sort: 'best', value: (r) => r.best ?? 0 },
    { label: 'lb.colSolved', sort: 'solved', value: (r) => r.solved ?? 0 },
    { label: 'lb.colAvg', sort: 'avg', value: (r) => (r.avg ?? 0).toFixed(1) },
  ],
  solved: [],
  avg: [],
  today: [
    { label: 'daily.colGuesses', sort: 'today', value: (r) => r.guesses ?? 0 },
    { label: 'daily.colTime', sort: 'time', value: (r) => duration(r.seconds) },
    { label: 'daily.colStreak', sort: 'streak', value: (r) => r.streak ?? 0 },
    { label: 'daily.colBest', sort: 'maxStreak', value: (r) => r.best ?? 0 },
  ],
  time: [],
  streak: [],
  maxStreak: [],
}
COLUMNS.solved = COLUMNS.best
COLUMNS.avg = COLUMNS.best
COLUMNS.time = COLUMNS.today
COLUMNS.streak = COLUMNS.today
COLUMNS.maxStreak = COLUMNS.today

const PAGE_SIZE = 10
const SKELETON_ROWS = 5
const lastSize = new Map<string, number>()

export default function Leaderboard({ gameId, mode, daily }: { gameId: GameId; mode: ModeId; daily: boolean }) {
  const { t, l, error: errorText } = useI18n()
  const href = useHref()
  const game = gameById(gameId)
  const [chosen, setSort] = useState<Sort>('best')
  const [reversed, setReversed] = useState(false)
  const allowed: Sort[] = daily ? ['today', 'time', 'streak', 'maxStreak'] : ['best', 'solved', 'avg']
  const sort: Sort = allowed.includes(chosen) ? chosen : allowed[0]

  const pick = (next: Sort) => {
    if (next === sort) return setReversed((r) => !r)
    setSort(next)
    setReversed(false)
  }
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const slow = setTimeout(() => !cancelled && setLoading(true), 300)
    setError(null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}${reversed ? '&dir=rev' : ''}${daily ? '&daily=1' : ''}`)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) setBoard(data)
        else setError(data.error ?? 'server')
        clearTimeout(slow)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('network')
        clearTimeout(slow)
        setLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(slow)
    }
  }, [gameId, mode, sort, reversed, daily])

  useEffect(() => setPage(1), [gameId, mode, sort, reversed, daily])

  useEffect(() => {
    if (board) lastSize.set(`${gameId}:${mode}:${daily}`, Math.min(board.rows.length, PAGE_SIZE))
  }, [board, gameId, mode, daily])

  const boardKey = `${gameId}:${mode}:${daily}`
  const all = board?.rows ?? []
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const shown = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const meOutside = board?.me && !shown.some((r) => r.me) ? board.me : null
  const fillers = Math.max(0, PAGE_SIZE - shown.length - (meOutside ? 1 : 0))
  const span = COLUMNS[sort].length + 2

  return (
    <div className="leaderboard">
      <a className="back" href={href.home}>
        {t('play.back')}
      </a>
      <header className="lb-head">
        <h1>{t('lb.title')}</h1>
        <p className="muted">{t('lb.hint')}</p>
      </header>

      <div className="lb-pickers card">
        <div className="variant-tabs" role="tablist" aria-label={t('daily.variant')}>
          <a role="tab" aria-selected={!daily} className={!daily ? 'active' : ''} href={href.leaderboard(gameId, mode)}>
            <InfinityIcon /> {t('daily.endless')}
          </a>
          <a role="tab" aria-selected={daily} className={daily ? 'active' : ''} href={href.leaderboard(gameId, mode, true)}>
            <CalendarIcon /> {t('daily.daily')}
          </a>
        </div>

        <div className="lb-picker-row">
          <Picker
            label={t('duel.game')}
            value={gameId}
            onChange={(next) => {
              const picked = gameById(next as GameId)
              navigate(href.leaderboard(picked.id, picked.modes.includes(mode) ? mode : picked.modes[0], daily))
            }}
            options={GAMES.map((g) => ({ value: g.id, label: l(g.label), accent: g.accent }))}
          />
          <Picker
            label={t('duel.mode')}
            value={mode}
            onChange={(next) => navigate(href.leaderboard(gameId, next as ModeId, daily))}
            options={MODES.filter((m) => game.modes.includes(m.id)).map((m) => ({
              value: m.id,
              label: (
                <>
                  {m.icon} {t(m.label)}
                </>
              ),
            }))}
          />
        </div>
      </div>

      <section className={`card lb-card ${loading ? 'loading' : ''}`}>
        {error ? (
          <div className="lb-state">{errorText(error)}</div>
        ) : (
          <div className="lb-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('lb.player')}</th>
                  {COLUMNS[sort].map((c) =>
                    c.sort ? (
                      <th key={c.label} className={c.sort === sort ? 'sorted' : 'sortable'}>
                        <button type="button" onClick={() => pick(c.sort!)}>
                          {t(c.label)}
                          {c.sort === sort && <SortIcon className={reversed ? 'up' : ''} />}
                        </button>
                      </th>
                    ) : (
                      <th key={c.label}>{t(c.label)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {!board &&
                  Array.from({ length: lastSize.get(boardKey) ?? SKELETON_ROWS }, (_, i) => (
                    <tr key={`skeleton-${i}`} className="lb-skeleton-row">
                      {Array.from({ length: span }, (_, c) => (
                        <td key={c}>
                          <span className="lb-skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {board && all.length === 0 && (
                  <tr className="lb-blank">
                    <td colSpan={COLUMNS[sort].length + 2}>
                      <div className="lb-blank-inner">
                        <span>{t(daily && sort === 'today' ? 'daily.empty' : 'lb.empty')}</span>
                        <a className="primary" href={href.play(gameId, mode, daily)}>
                          {t('lb.play')}
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
                {[...shown, ...(meOutside ? [meOutside] : [])].map((row, i) => (
                  <tr key={`${row.rank}-${row.nickname}`} className={`${row.me ? 'me' : ''} ${meOutside && i === shown.length ? 'gap' : ''}`}>
                    <td className="lb-rank">
                      {!reversed && row.rank <= 3 ? (
                        <MedalIcon className={`lb-medal ${['gold', 'silver', 'bronze'][row.rank - 1]}`} />
                      ) : (
                        row.rank
                      )}
                    </td>
                    <td className="lb-name">
                      {row.nickname}
                      {row.me && <span className="lb-you">{t('lb.you')}</span>}
                    </td>
                    {COLUMNS[sort].map((c) => (
                      <td key={c.label} className={c.sort === sort ? 'sorted' : ''}>
                        {c.value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {board &&
                  pages > 1 &&
                  Array.from({ length: fillers }, (_, i) => (
                    <tr key={`filler-${i}`} className="lb-filler">
                      <td colSpan={span} />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="lb-pager">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label={t('lb.prev')}>
              <ChevronIcon className="left" />
            </button>
            <span>{t('lb.page', { page, pages })}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} aria-label={t('lb.next')}>
              <ChevronIcon className="right" />
            </button>
          </div>
        )}

        {daily && board?.number && (
          <p className="lb-note">{t('daily.boardToday', { number: board.number })}</p>
        )}
      </section>
    </div>
  )
}
