import { useEffect, useState } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { href, navigate } from './router'
import Picker from './Picker'
import { CalendarIcon, InfinityIcon, MedalIcon } from './icons'

type Sort = 'best' | 'solved' | 'avg' | 'today' | 'streak'

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

type Board = { rows: Row[]; me: Row | null; total: number; minForAvg?: number; number?: number }

type Column = { label: UiKey; sort?: Sort; value: (row: Row) => string | number }

const ENDLESS_SORTS: { id: Sort; label: UiKey }[] = [
  { id: 'best', label: 'lb.sortBest' },
  { id: 'solved', label: 'lb.sortSolved' },
  { id: 'avg', label: 'lb.sortAvg' },
]

const DAILY_SORTS: { id: Sort; label: UiKey }[] = [
  { id: 'today', label: 'daily.sortToday' },
  { id: 'streak', label: 'daily.sortStreak' },
]

const duration = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

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
    { label: 'daily.colTime', value: (r) => duration(r.seconds) },
  ],
  streak: [
    { label: 'daily.colStreak', sort: 'streak', value: (r) => r.streak ?? 0 },
    { label: 'daily.colBest', value: (r) => r.best ?? 0 },
    { label: 'daily.colSolved', value: (r) => r.solved ?? 0 },
  ],
}
COLUMNS.solved = COLUMNS.best
COLUMNS.avg = COLUMNS.best

export default function Leaderboard({ gameId, mode, daily }: { gameId: GameId; mode: ModeId; daily: boolean }) {
  const { t, l, error: errorText } = useI18n()
  const game = gameById(gameId)
  const sorts = daily ? DAILY_SORTS : ENDLESS_SORTS
  const [chosen, setSort] = useState<Sort>('best')
  const sort = sorts.some((s) => s.id === chosen) ? chosen : sorts[0].id
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}${daily ? '&daily=1' : ''}`)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) setBoard(data)
        else setError(data.error ?? 'server')
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('network')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gameId, mode, sort, daily])

  const meOutside = board?.me && !board.rows.some((r) => r.me) ? board.me : null

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
          <Picker
            label={t('lb.sortBy')}
            value={sort}
            onChange={(next) => setSort(next as Sort)}
            options={sorts.map((s) => ({ value: s.id, label: t(s.label) }))}
          />
        </div>
      </div>

      {sort === 'avg' && board && <p className="muted lb-note">{t('lb.avgNote', { min: board.minForAvg ?? 0 })}</p>}
      {daily && board?.number && (
        <p className="muted lb-note">
          {t(sort === 'today' ? 'daily.boardToday' : 'daily.boardStreak', { number: board.number })}
        </p>
      )}

      <section className={`card lb-card ${loading ? 'loading' : ''}`}>
        {error ? (
          <div className="lb-state">{errorText(error)}</div>
        ) : !board ? (
          <div className="lb-state">{t('loading')}</div>
        ) : board.rows.length === 0 ? (
          <div className="lb-empty">
            <p>{t(daily && sort === 'today' ? 'daily.empty' : 'lb.empty')}</p>
            <a className="primary" href={href.play(gameId, mode, daily)}>
              {t('lb.play')}
            </a>
          </div>
        ) : (
          <div className="lb-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('lb.player')}</th>
                  {COLUMNS[sort].map((c) => (
                    <th key={c.label} className={c.sort === sort ? 'sorted' : ''}>
                      {t(c.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...board.rows, ...(meOutside ? [meOutside] : [])].map((row, i) => (
                  <tr key={`${row.rank}-${row.nickname}`} className={`${row.me ? 'me' : ''} ${meOutside && i === board.rows.length ? 'gap' : ''}`}>
                    <td className="lb-rank">
                      {row.rank <= 3 ? <MedalIcon className={`lb-medal ${['gold', 'silver', 'bronze'][row.rank - 1]}`} /> : row.rank}
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
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
