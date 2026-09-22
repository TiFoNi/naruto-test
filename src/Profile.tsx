import { useState, type CSSProperties, type FormEvent } from 'react'
import { statsKey, useAuth } from './auth'
import { dailyKey } from './games/specs'
import { GAMES } from './games'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { average, emptyStats } from './stats'

export default function Profile({ onBack }: { onBack: () => void }) {
  const { user, stats, duels, setNickname, resetStats, logout } = useAuth()
  const { t, l, error: errorText } = useI18n()
  const [nickname, setNicknameDraft] = useState(user?.nickname ?? '')
  const [nickMessage, setNickMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingNick, setSavingNick] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (!user) return null

  const all = GAMES.flatMap((g) => g.modes.map((m) => stats[statsKey(g.id, m)] ?? emptyStats))
  const totalSolved = all.reduce((sum, s) => sum + s.solved, 0)
  const bestStreak = all.reduce((max, s) => Math.max(max, s.best), 0)
  const totalGuesses = all.reduce((sum, s) => sum + s.totalGuesses, 0)

  const saveNickname = async (e: FormEvent) => {
    e.preventDefault()
    setSavingNick(true)
    const code = await setNickname(nickname)
    setSavingNick(false)
    setNickMessage(code ? { ok: false, text: errorText(code) } : { ok: true, text: t('profile.saved') })
  }

  const reset = async () => {
    setResetting(true)
    const code = await resetStats()
    setResetting(false)
    setConfirmReset(false)
    setResetMessage(code ? { ok: false, text: errorText(code) } : { ok: true, text: t('profile.resetDone') })
  }

  return (
    <div className="profile">
      <button className="back" onClick={onBack}>
        {t('profile.back')}
      </button>

      <section className="card profile-head">
        <div className="avatar" aria-hidden>
          {user.nickname.charAt(0).toUpperCase()}
        </div>
        <div className="profile-names">
          <h1>{user.nickname}</h1>
          <span className="muted">{user.username}</span>
        </div>
        <button className="ghost" onClick={logout}>
          {t('nav.logout')}
        </button>
      </section>

      <form className="card nickname-form" onSubmit={saveNickname}>
        <label htmlFor="nickname">{t('profile.nickname')}</label>
        <p className="muted">{t('profile.nicknameHint')}</p>
        <div className="inline-field">
          <input
            id="nickname"
            value={nickname}
            maxLength={24}
            onChange={(e) => {
              setNicknameDraft(e.target.value)
              setNickMessage(null)
            }}
          />
          <button className="primary" type="submit" disabled={savingNick || nickname.trim() === user.nickname}>
            {savingNick ? '…' : t('profile.save')}
          </button>
        </div>
        {nickMessage && <div className={nickMessage.ok ? 'notice ok' : 'notice error'}>{nickMessage.text}</div>}
      </form>

      <section className="totals">
        <div className="card">
          <span>{t('profile.total')}</span>
          <b>{totalSolved}</b>
        </div>
        <div className="card">
          <span>{t('profile.bestStreak')}</span>
          <b>{bestStreak}</b>
        </div>
        <div className="card">
          <span>{t('profile.duelWins')}</span>
          <b>{duels.wins}</b>
        </div>
        <div className="card">
          <span>{t('stats.avg')}</span>
          <b>{totalSolved ? (totalGuesses / totalSolved).toFixed(1) : '–'}</b>
        </div>
      </section>

      <section className="card stats-table-card">
        <h2>{t('profile.byGame')}</h2>
        <div className="stats-table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t('profile.game')}</th>
                <th>{t('profile.mode')}</th>
                <th>{t('stats.solved')}</th>
                <th>{t('stats.streak')}</th>
                <th>{t('stats.best')}</th>
                <th>{t('stats.avg')}</th>
              </tr>
            </thead>
            <tbody>
              {GAMES.map((g) =>
                MODES.filter((m) => g.modes.includes(m.id))
                  .flatMap((m) => [
                    { id: m.id, label: t(m.label), key: statsKey(g.id, m.id) },
                    { id: `${m.id}-daily`, label: `📅 ${t(m.label)}`, key: dailyKey(g.id, m.id) },
                  ])
                  .map((m, i, list) => {
                  const s = stats[m.key] ?? emptyStats
                  return (
                    <tr key={`${g.id}-${m.id}`} className={i === 0 ? 'group-start' : ''}>
                      {i === 0 && (
                        <th rowSpan={list.length} scope="rowgroup" style={{ '--tab-accent': g.accent } as CSSProperties}>
                          <span className="dot" />
                          {l(g.label)}
                        </th>
                      )}
                      <td>{m.label}</td>
                      <td>{s.solved}</td>
                      <td>{s.streak}</td>
                      <td>{s.best}</td>
                      <td>{average(s)}</td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card danger">
        <div>
          <h2>{t('profile.resetTitle')}</h2>
          <p className="muted">{t('profile.resetHint')}</p>
        </div>
        {confirmReset ? (
          <div className="confirm" role="alertdialog" aria-label={t('profile.resetTitle')}>
            <p>{t('profile.resetConfirm')}</p>
            <div className="confirm-actions">
              <button className="danger-button" onClick={reset} disabled={resetting}>
                {resetting ? t('profile.resetting') : t('profile.resetYes')}
              </button>
              <button className="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>
                {t('profile.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="danger-button outline"
            onClick={() => {
              setConfirmReset(true)
              setResetMessage(null)
            }}
          >
            {t('profile.resetButton')}
          </button>
        )}
        {resetMessage && <div className={resetMessage.ok ? 'notice ok' : 'notice error'}>{resetMessage.text}</div>}
      </section>
    </div>
  )
}
