import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { useHref } from './router'
import { CalendarIcon, ChevronIcon, TrophyIcon } from './icons'

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  totals: {
    solved: number
    played: number
    gaveUp: number
    guesses: number
    characters: number
  }
  duels: { played: number; wins: number; losses: number; draws: number }
  challenges: { solved: number }
  favourite: GameId | null
  rank: { position: number; players: number } | null
  streak: {
    current: number
    best: number
    week: { day: string; played: boolean }[]
  }
  games: { game: GameId; pool: number; solved: number }[]
  modes: { mode: string; played: number; won: number; guesses: number }[]
  recent: {
    game: string
    mode: string
    answerId: number
    status: string
    guessCount?: number
    daily?: string
    finishedAt?: string
    name: Named | null
  }[]
}

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const
const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
} as const

const ROUNDS = {
  ru: ['игра', 'игры', 'игр'],
  uk: ['гра', 'гри', 'ігор'],
  en: ['round', 'rounds', 'rounds'],
} as const

const pluralOf = (count: number, lang: keyof typeof ROUNDS) => {
  if (lang === 'en') return ROUNDS.en[count === 1 ? 0 : 1]
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return ROUNDS[lang][0]
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return ROUNDS[lang][1]
  return ROUNDS[lang][2]
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export default function Profile({ onBack }: { onBack: () => void }) {
  const { user, setNickname, resetStats, logout } = useAuth()
  const { t, l, lang, error: errorText } = useI18n()
  const href = useHref()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [nickname, setNicknameDraft] = useState(user?.nickname ?? '')
  const [nickMessage, setNickMessage] = useState<{
    ok: boolean
    text: string
  } | null>(null)
  const [savingNick, setSavingNick] = useState(false)
  const [settings, setSettings] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>('profile/summary')
    if (ok) setSummary(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null

  const saveNickname = async (event: FormEvent) => {
    event.preventDefault()
    setSavingNick(true)
    const code = await setNickname(nickname)
    setSavingNick(false)
    setNickMessage(code ? { ok: false, text: errorText(code) } : { ok: true, text: t('profile.saved') })
  }

  const reset = async () => {
    setResetting(true)
    await resetStats()
    setResetting(false)
    setConfirmReset(false)
    void load()
  }

  const date = (value?: string, long = false) => {
    if (!value) return '—'
    const when = new Date(value)
    if (long) {
      const parts = new Intl.DateTimeFormat(LOCALES[lang], { month: 'short', year: 'numeric' }).formatToParts(when)
      const month = parts.find((part) => part.type === 'month')?.value ?? ''
      const year = parts.find((part) => part.type === 'year')?.value ?? ''
      return `${month} ${year}`
    }
    const today = new Date().toDateString() === when.toDateString()
    return today
      ? when.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })
      : when.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' })
  }

  const gameLabel = (id: string) => GAMES.find((g) => g.id === id)?.label
  const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label ?? 'mode.classic'
  const accuracy = summary ? percent(summary.totals.solved, summary.totals.played) : 0
  const average = summary && summary.totals.solved ? (summary.totals.guesses / summary.totals.solved).toFixed(1) : '—'

  return (
    <div className="profile">
      <button className="back" onClick={onBack}>
        {t('profile.back')}
      </button>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="card profile-card">
            <div className="profile-id">
              <span className="avatar" aria-hidden>
                {user.nickname.charAt(0).toUpperCase()}
              </span>
              <div className="profile-names">
                <h1>{user.nickname}</h1>
                <span className="muted">{user.username}</span>
              </div>
            </div>

            <div className="profile-facts">
              <div>
                <span>{t('profile.rank')}</span>
                {summary?.rank ? <b>#{summary.rank.position}</b> : <b className="empty">—</b>}
                {summary?.rank && <small>{`${lang === 'en' ? 'of' : lang === 'uk' ? 'з' : 'из'} ${summary.rank.players}`}</small>}
              </div>
              <div>
                <span>{t('profile.played')}</span>
                <b>{summary?.totals.played ?? 0}</b>
              </div>
              <div>
                <span>{t('profile.favourite')}</span>
                {summary?.favourite ? <b className="small">{l(gameLabel(summary.favourite)!)}</b> : <b className="empty">—</b>}
              </div>
              <div>
                <span>{t('profile.since')}</span>
                {summary?.since ? <b className="small">{date(summary.since, true)}</b> : <b className="empty">—</b>}
              </div>
            </div>

            <div className="profile-actions">
              <button type="button" className="ghost" onClick={() => setSettings((open) => !open)}>
                {t('profile.settings')}
              </button>
              <button type="button" className="ghost" onClick={logout}>
                {t('nav.logout')}
              </button>
            </div>

            {settings && (
              <div className="profile-settings">
                <form onSubmit={saveNickname}>
                  <label htmlFor="nickname">{t('profile.nickname')}</label>
                  <p className="muted">{t('profile.nicknameHint')}</p>
                  <div className="inline-field">
                    <input
                      id="nickname"
                      value={nickname}
                      maxLength={24}
                      onChange={(event) => {
                        setNicknameDraft(event.target.value)
                        setNickMessage(null)
                      }}
                    />
                    <button className="primary" type="submit" disabled={savingNick || nickname.trim() === user.nickname}>
                      {savingNick ? '…' : t('profile.save')}
                    </button>
                  </div>
                  {nickMessage && <div className={nickMessage.ok ? 'notice ok' : 'notice error'}>{nickMessage.text}</div>}
                </form>

                <div className="profile-reset">
                  <label>{t('profile.resetTitle')}</label>
                  <p className="muted">{t('profile.resetHint')}</p>
                  {confirmReset ? (
                    <div className="inline-field">
                      <button type="button" className="danger" onClick={reset} disabled={resetting}>
                        {resetting ? t('profile.resetting') : t('profile.resetYes')}
                      </button>
                      <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                        {t('profile.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="ghost" onClick={() => setConfirmReset(true)}>
                      {t('profile.resetButton')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="card streak-card">
            <header>
              <h2>{t('profile.streakTitle')}</h2>
              <span className="muted">{t('profile.streakRecord', { days: summary?.streak.best ?? 0 })}</span>
            </header>
            <div className="streak-now">
              <span className="streak-flame" aria-hidden>
                <CalendarIcon />
              </span>
              <b>{summary?.streak.current ?? 0}</b>
              <div>
                <span>{t('profile.streakDays')}</span>
                <small className={summary?.streak.week.at(-1)?.played ? 'ok' : 'muted'}>
                  {summary?.streak.week.at(-1)?.played ? t('profile.streakToday') : t('profile.streakIdle')}
                </small>
              </div>
            </div>
            <ul className="streak-week">
              {(summary?.streak.week ?? []).map((day, index) => (
                <li key={day.day} className={day.played ? 'on' : ''}>
                  <span aria-hidden>{day.played ? '✓' : ''}</span>
                  <small>{WEEKDAYS[lang][(new Date(`${day.day}T00:00:00Z`).getUTCDay() + 6) % 7] ?? index}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="card soon-card">
            <header>
              <h2>{t('profile.levelTitle')}</h2>
            </header>
            <p className="muted">{t('profile.levelSoon')}</p>
          </section>
        </div>

        <div className="profile-middle">
          <section className="profile-metrics">
            <div className="card">
              <span>{t('profile.characters')}</span>
              <b>{summary?.totals.characters ?? 0}</b>
            </div>
            <div className="card">
              <span>{t('profile.duelWins')}</span>
              <b>{summary?.duels.wins ?? 0}</b>
              {!!summary?.duels.played && (
                <small>
                  {percent(summary.duels.wins, summary.duels.played)}% · {summary.duels.wins}–{summary.duels.losses}
                </small>
              )}
            </div>
            <div className="card">
              <span>{t('profile.accuracy')}</span>
              <b>{summary?.totals.played ? `${accuracy}%` : '—'}</b>
              {!!summary?.totals.played && (
                <small>
                  {summary.totals.solved} / {summary.totals.played}
                </small>
              )}
            </div>
            <div className="card">
              <span>{t('profile.avgGuesses')}</span>
              <b>{average}</b>
            </div>
          </section>

          <div className="profile-middle-cols">
            <div className="profile-column">
              <section className="card worlds-card">
                <header>
                  <h2>{t('profile.worlds')}</h2>
                  <a className="card-link" href={href.home}>
                    {t('nav.games')} <ChevronIcon />
                  </a>
                </header>
                <p className="muted">{t('profile.worldsHint')}</p>
                {summary?.games.length ? (
                  <ul className="worlds">
                    {summary.games.map((row) => {
                      const game = GAMES.find((g) => g.id === row.game)
                      return (
                        <li key={row.game}>
                          <span
                            className="world-tag"
                            style={{
                              background: game?.accent ?? 'var(--accent)',
                            }}
                            aria-hidden
                          >
                            {l(game?.label ?? { ru: '', uk: '', en: '' }).slice(0, 2)}
                          </span>
                          <span className="world-name">{game ? l(game.label) : row.game}</span>
                          <span className="world-count">
                            <b>{row.solved}</b> / {row.pool} · {percent(row.solved, row.pool)}%
                          </span>
                          <span className="world-bar">
                            <i
                              style={{
                                width: `${Math.max(percent(row.solved, row.pool), 2)}%`,
                                background: game?.accent ?? 'var(--accent)',
                              }}
                            />
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="muted center">{t('profile.activityEmpty')}</p>
                )}
              </section>
            </div>

            <div className="profile-column">
              <section className="card modes-card">
                <header>
                  <h2>{t('profile.modes')}</h2>
                  <span className="muted">{t('profile.accuracy')}</span>
                </header>
                {summary?.modes.length ? (
                  <ul className="modes-list">
                    {summary.modes.map((row) => (
                      <li key={row.mode}>
                        <span className="mode-name">{t(modeLabel(row.mode))}</span>
                        <span className="mode-count muted">
                          {row.played} {pluralOf(row.played, lang)}
                        </span>
                        <b>{percent(row.won, row.played)}%</b>
                        <span className="mode-bar">
                          <i
                            style={{
                              width: `${Math.max(percent(row.won, row.played), 2)}%`,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted center">{t('profile.activityEmpty')}</p>
                )}
              </section>

              <section className="card activity-card">
                <header>
                  <h2>{t('profile.activity')}</h2>
                </header>
                {summary?.recent.length ? (
                  <ul className="activity">
                    {summary.recent.map((round, index) => (
                      <li key={`${round.game}-${round.answerId}-${index}`}>
                        <span className={`activity-dot ${round.status}`} aria-hidden />
                        <span className="activity-text">
                          {t(round.status === 'won' ? 'profile.won' : round.status === 'skipped' ? 'profile.gaveUp' : 'profile.lost', {
                            name: round.name ? round.name[lang] : `#${round.answerId}`,
                          })}
                          <small>
                            {gameLabel(round.game) ? l(gameLabel(round.game)!) : round.game} · {t(modeLabel(round.mode))}
                            {round.guessCount ? ` · ${t('profile.tries', { count: round.guessCount })}` : ''}
                          </small>
                        </span>
                        <span className="activity-when muted">{date(round.finishedAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted center">{t('profile.activityEmpty')}</p>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="profile-column">
          <section className="card soon-card">
            <header>
              <h2>{t('profile.questsTitle')}</h2>
            </header>
            <p className="muted">{t('profile.questsSoon')}</p>
            <ul className="soon-rows">
              <li />
              <li />
              <li />
            </ul>
          </section>

          <section className="card soon-card">
            <header>
              <h2>
                <TrophyIcon /> {t('profile.awardsTitle')}
              </h2>
            </header>
            <p className="muted">{t('profile.awardsSoon')}</p>
            <ul className="soon-badges">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
