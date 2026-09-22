import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { api } from './api'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { href, navigate } from './router'

type HistoryRow = {
  code: string
  game: string | null
  mode: string | null
  at: number
  rounds: number
  draws: number
  you: { nickname: string; wins: number }
  rival?: { nickname: string; wins: number }
}

type DuelStats = { played?: number; wins?: number; losses?: number; draws?: number }

const score = (row: HistoryRow) => {
  const mine = row.you.wins
  const theirs = row.rival?.wins ?? 0
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw'
}

export default function DuelLobby() {
  const { t, l, error: errorText } = useI18n()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [stats, setStats] = useState<DuelStats | null>(null)



  useEffect(() => {
    api<{ history: HistoryRow[]; stats: DuelStats | null }>('duel', { action: 'history' }).then(({ ok, data }) => {
      if (!ok) return
      setHistory(data.history)
      setStats(data.stats)
    })
  }, [])

  const create = async () => {
    setBusy(true)
    const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create' })
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
        <p className="muted">{t('duel.createHint')}</p>
        <button className="primary big" onClick={create} disabled={busy}>
          {busy ? t('duel.creating') : t('duel.create')}
        </button>
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
                  <th>{t('duel.rounds')}</th>
                  <th>{t('duel.series')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const g = gameById((row.game ?? 'naruto') as GameId)
                  return (
                    <tr key={row.code + row.at}>
                      <th scope="row" style={{ '--tab-accent': g.accent } as CSSProperties}>
                        <span className="dot" />
                        {l(g.label)}
                      </th>
                      <td>{t(MODES.find((m) => m.id === row.mode)?.label ?? 'mode.classic')}</td>
                      <td>{row.rival?.nickname ?? '—'}</td>
                      <td>{row.rounds}</td>
                      <td className={`duel-result ${score(row)}`}>
                        {row.you.wins} : {row.rival?.wins ?? 0}
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
