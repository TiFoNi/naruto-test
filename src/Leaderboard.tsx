import { useEffect, useState, type CSSProperties } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { href } from './router'

type Sort = 'best' | 'solved' | 'avg'

type Row = { rank: number; nickname: string; solved: number; best: number; avg: number; me: boolean }

type Board = { rows: Row[]; me: Row | null; total: number; minForAvg: number }

const SORTS: { id: Sort; label: UiKey }[] = [
  { id: 'best', label: 'lb.sortBest' },
  { id: 'solved', label: 'lb.sortSolved' },
  { id: 'avg', label: 'lb.sortAvg' },
]

export default function Leaderboard({ gameId, mode }: { gameId: GameId; mode: ModeId }) {
  const { t, l, error: errorText } = useI18n()
  const game = gameById(gameId)
  const [sort, setSort] = useState<Sort>('best')
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBoard(null)
    setError(null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}`)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) setBoard(data)
        else setError(data.error ?? 'server')
      })
      .catch(() => !cancelled && setError('network'))
    return () => {
      cancelled = true
    }
  }, [gameId, mode, sort])

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
            href={href.leaderboard(g.id, g.modes.includes(mode) ? mode : g.modes[0])}
          >
            <span className="dot" />
            {l(g.label)}
          </a>
        ))}
      </nav>

      <div className="lb-controls">
        <div className="mode-tabs" role="tablist">
          {MODES.filter((m) => game.modes.includes(m.id)).map((m) => (
            <a key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} href={href.leaderboard(gameId, m.id)}>
              {t(m.label)}
            </a>
          ))}
        </div>
        <div className="lb-sort" role="group" aria-label={t('lb.sortBy')}>
          {SORTS.map((s) => (
            <button key={s.id} className={sort === s.id ? 'active' : ''} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      {sort === 'avg' && board && <p className="muted lb-note">{t('lb.avgNote', { min: board.minForAvg })}</p>}

      <section className="card lb-card">
        {error ? (
          <p className="muted">{errorText(error)}</p>
        ) : !board ? (
          <p className="muted">{t('loading')}</p>
        ) : board.rows.length === 0 ? (
          <div className="lb-empty">
            <p>{t('lb.empty')}</p>
            <a className="primary" href={href.play(gameId, mode)}>
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
                  <th className={sort === 'best' ? 'sorted' : ''}>{t('lb.colBest')}</th>
                  <th className={sort === 'solved' ? 'sorted' : ''}>{t('lb.colSolved')}</th>
                  <th className={sort === 'avg' ? 'sorted' : ''}>{t('lb.colAvg')}</th>
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
                    <td>{row.best}</td>
                    <td>{row.solved}</td>
                    <td>{row.avg.toFixed(1)}</td>
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
