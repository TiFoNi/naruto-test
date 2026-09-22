import { useEffect, useState, type CSSProperties } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { href } from './router'

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

  useEffect(() => {
    let cancelled = false
    setBoard(null)
    setError(null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}${daily ? '&daily=1' : ''}`)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) setBoard(data)
        else setError(data.error ?? 'server')
      })
      .catch(() => !cancelled && setError('network'))
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

      <nav className="game-tabs" aria-label={t('nav.games')}>
        {GAMES.map((g) => (
          <a
            key={g.id}
            className={g.id === gameId ? 'active' : ''}
            style={{ '--tab-accent': g.accent } as CSSProperties}
            href={href.leaderboard(g.id, g.modes.includes(mode) ? mode : g.modes[0], daily)}
          >
            <span className="dot" />
            {l(g.label)}
          </a>
        ))}
      </nav>

      <div className="lb-controls">
        <div className="game-switches">
          <div className="variant-tabs" role="tablist" aria-label={t('daily.variant')}>
            <a role="tab" aria-selected={!daily} className={!daily ? 'active' : ''} href={href.leaderboard(gameId, mode)}>
              ∞ {t('daily.endless')}
            </a>
            <a role="tab" aria-selected={daily} className={daily ? 'active' : ''} href={href.leaderboard(gameId, mode, true)}>
              📅 {t('daily.daily')}
            </a>
          </div>
          <div className="mode-tabs" role="tablist">
            {MODES.filter((m) => game.modes.includes(m.id)).map((m) => (
              <a
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={mode === m.id ? 'active' : ''}
                href={href.leaderboard(gameId, m.id, daily)}
              >
                {t(m.label)}
              </a>
            ))}
          </div>
        </div>
        <div className="lb-sort" role="group" aria-label={t('lb.sortBy')}>
          {sorts.map((s) => (
            <button key={s.id} className={sort === s.id ? 'active' : ''} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      {sort === 'avg' && board && <p className="muted lb-note">{t('lb.avgNote', { min: board.minForAvg ?? 0 })}</p>}
      {daily && board?.number && (
        <p className="muted lb-note">
          {t(sort === 'today' ? 'daily.boardToday' : 'daily.boardStreak', { number: board.number })}
        </p>
      )}

      <section className="card lb-card">
        {error ? (
          <p className="muted">{errorText(error)}</p>
        ) : !board ? (
          <p className="muted">{t('loading')}</p>
        ) : board.rows.length === 0 ? (
          <div className="lb-empty">
            <p>{t(daily && sort === 'today' ? 'daily.empty' : 'lb.empty')}</p>
            <a className="primary" href={href.play(gameId, mode, daily)}>
              {t('lb.play')}
            </a>
          </div>
        ) : (
          <div className="stats-table-scroll">
            <table className="stats-table lb-table">
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
                    <td className="lb-rank">{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}</td>
                    <td className="lb-name">
                      {row.nickname}
                      {row.me && <span className="lb-you">{t('lb.you')}</span>}
                    </td>
                    {COLUMNS[sort].map((c) => (
                      <td key={c.label}>{c.value(row)}</td>
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
