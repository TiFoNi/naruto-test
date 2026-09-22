import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { href, navigate } from './router'

type HistoryRow = {
  code: string
  game: string
  mode: string
  at: number
  you: { nickname: string; guesses: number; solved: boolean }
  rival?: { nickname: string; guesses: number; solved: boolean }
  result: 'win' | 'loss' | 'draw'
}

type DuelStats = { played?: number; wins?: number; losses?: number; draws?: number }

export default function DuelLobby() {
  const { t, l, error: errorText } = useI18n()
  const [gameId, setGameId] = useState<GameId>(GAMES[0].id)
  const [mode, setMode] = useState<ModeId>('classic')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [stats, setStats] = useState<DuelStats | null>(null)

  const game = gameById(gameId)
  const modes = MODES.filter((m) => game.modes.includes(m.id))

  useEffect(() => {
    if (!game.modes.includes(mode)) setMode(game.modes[0])
  }, [game, mode])

  useEffect(() => {
    api<{ history: HistoryRow[]; stats: DuelStats | null }>('duel', { action: 'history' }).then(({ ok, data }) => {
      if (!ok) return
      setHistory(data.history)
      setStats(data.stats)
    })
  }, [])

  const create = async () => {
    setBusy(true)
    const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create', game: gameId, mode })
    setBusy(false)
    if (ok && data.duel) navigate(href.duel(data.duel.code))
    else setError(data.error ?? 'server')
  }

  const join = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(clean)) navigate(href.duel(clean))
    else setError('not_found')
  }

  return (
    <div className="duels">
      <a className="back" href={href.home}>
        {t('play.back')}
      </a>
      <header className="lb-head">
        <h1>⚔️ {t('duel.title')}</h1>
        <p className="muted">{t('duel.lead')}</p>
        <p className="muted small">{t('duel.rules')}</p>
      </header>

      {stats && (
        <p className="duel-score">
          {t('duel.score', { wins: stats.wins ?? 0, losses: stats.losses ?? 0, draws: stats.draws ?? 0 })}
        </p>
      )}

      <section className="card duel-create">
        <h2>{t('duel.create')}</h2>
        <div className="duel-picker">
          <label>
            <span className="muted">{t('duel.game')}</span>
            <select value={gameId} onChange={(e) => setGameId(e.target.value as GameId)}>
              {GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {l(g.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="muted">{t('duel.mode')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as ModeId)}>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.label)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={create} disabled={busy}>
            {busy ? t('duel.creating') : t('duel.create')}
          </button>
        </div>
      </section>

      <form className="card duel-join" onSubmit={join}>
        <h2>{t('duel.joinTitle')}</h2>
        <div className="inline-field">
          <input value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="primary" type="submit">
            {t('duel.join')}
          </button>
        </div>
      </form>

      {error && <div className="notice error">{errorText(error)}</div>}

      <section className="card stats-table-card">
        <h2>{t('duel.history')}</h2>
        {!history ? (
          <p className="muted">{t('loading')}</p>
        ) : history.length === 0 ? (
          <p className="muted">{t('duel.empty')}</p>
        ) : (
          <div className="stats-table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>{t('duel.game')}</th>
                  <th>{t('duel.mode')}</th>
                  <th>{t('duel.opponent')}</th>
                  <th>{t('daily.colGuesses')}</th>
                  <th>{t('duel.result')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const g = gameById(row.game as GameId)
                  return (
                    <tr key={row.code + row.at}>
                      <th scope="row" style={{ '--tab-accent': g.accent } as CSSProperties}>
                        <span className="dot" />
                        {l(g.label)}
                      </th>
                      <td>{t(MODES.find((m) => m.id === row.mode)?.label ?? 'mode.classic')}</td>
                      <td>{row.rival?.nickname ?? '—'}</td>
                      <td>
                        {row.you.guesses} : {row.rival?.guesses ?? '—'}
                      </td>
                      <td className={`duel-result ${row.result}`}>
                        {t(row.result === 'win' ? 'duel.win' : row.result === 'loss' ? 'duel.loss' : 'duel.drawShort')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
