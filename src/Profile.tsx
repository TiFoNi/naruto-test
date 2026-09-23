import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { statsKey, useAuth } from './auth'
import { dailyKey } from './games/specs'
import { GAMES } from './games'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { average, emptyStats } from './stats'
import { CalendarIcon, ChevronIcon, InfinityIcon } from './icons'

export default function Profile({ onBack }: { onBack: () => void }) {
  const { user, stats, duels, challenges, setNickname, resetStats, logout, refresh } = useAuth()
  const { t, l, error: errorText } = useI18n()
  const [nickname, setNicknameDraft] = useState(user?.nickname ?? '')
  const [nickMessage, setNickMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingNick, setSavingNick] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!user) return null

  const all = GAMES.flatMap((g) => g.modes.map((m) => stats[statsKey(g.id, m)] ?? emptyStats))
  const totalSolved = all.reduce((sum, s) => sum + s.solved, 0)
  const bestStreak = all.reduce((max, s) => Math.max(max, s.best), 0)
  const totalGuesses = all.reduce((sum, s) => sum + s.totalGuesses, 0)

  const rows = GAMES.map((game) => {
    const own = game.modes.flatMap((m) => [stats[statsKey(game.id, m)], stats[dailyKey(game.id, m)]].map((s) => s ?? emptyStats))
    const solved = own.reduce((sum, s) => sum + s.solved, 0)
    const best = own.reduce((max, s) => Math.max(max, s.best), 0)
    return { game, solved, best, played: own.some((s) => s.solved > 0 || s.streak > 0) }
  }).sort((a, b) => b.solved - a.solved)

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

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
          <span>{t('profile.challengeSolved')}</span>
          <b>{challenges.solved}</b>
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

      <section className="card stats-card">
        <div className="stats-card-head">
          <h2>{t('profile.byGame')}</h2>
          <button className="ghost small" onClick={() => setOpen(open.size ? new Set() : new Set(GAMES.map((g) => g.id)))}>
            {open.size ? t('profile.collapseAll') : t('profile.expandAll')}
          </button>
        </div>

        <ul className="game-stats">
          {rows.map(({ game, solved, best, played }) => {
            const expanded = open.has(game.id)
            return (
              <li
                key={game.id}
                className={`game-stat ${expanded ? 'open' : ''} ${played ? '' : 'idle'}`}
                style={{ '--tab-accent': game.accent } as CSSProperties}
              >
                <button className="game-stat-head" aria-expanded={expanded} onClick={() => toggle(game.id)}>
                  <span className="dot" />
                  <b>{l(game.label)}</b>
                  {played ? (
                    <span className="game-stat-sum">
                      <i>{solved}</i> {t('stats.solved').toLowerCase()}
                      <em>·</em>
                      <i>{best}</i> {t('stats.best').toLowerCase()}
                    </span>
                  ) : (
                    <span className="game-stat-sum muted">{t('profile.notPlayed')}</span>
                  )}
                  <ChevronIcon className="chev" />
                </button>

                <div className="game-stat-panel">
                  <div className="game-stat-clip">
                    <div className="game-stat-body">
                    {MODES.filter((m) => game.modes.includes(m.id)).map((m) => {
                      const endless = stats[statsKey(game.id, m.id)] ?? emptyStats
                      const daily = stats[dailyKey(game.id, m.id)] ?? emptyStats
                      return (
                        <div key={m.id} className="mode-stat">
                          <h3>
                            <span aria-hidden>{m.icon}</span> {t(m.label)}
                          </h3>
                          <table>
                            <thead>
                              <tr>
                                <th />
                                <th title={t('daily.endless')}>
                                  <InfinityIcon />
                                </th>
                                <th title={t('daily.daily')}>
                                  <CalendarIcon />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <th>{t('stats.solved')}</th>
                                <td>{endless.solved}</td>
                                <td>{daily.solved}</td>
                              </tr>
                              <tr>
                                <th>{t('stats.streak')}</th>
                                <td>{endless.streak}</td>
                                <td>{daily.streak}</td>
                              </tr>
                              <tr>
                                <th>{t('stats.best')}</th>
                                <td>{endless.best}</td>
                                <td>{daily.best}</td>
                              </tr>
                              <tr>
                                <th>{t('stats.avg')}</th>
                                <td>{average(endless)}</td>
                                <td>{average(daily)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
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
