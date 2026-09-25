import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import Quests, { type Level } from './Quests'
import type { UiKey } from './i18n/ui'
import { MODES } from './modes'
import { CalendarIcon, CheckIcon, TrophyIcon } from './icons'
import { useHref } from './router'
import { kyivToday } from './stats'

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  pinned: string[]
  level: Level
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

const DAYS = {
  ru: ['день подряд', 'дня подряд', 'дней подряд'],
  uk: ['день поспіль', 'дні поспіль', 'днів поспіль'],
  en: ['day in a row', 'days in a row', 'days in a row'],
} as const

const ROUNDS = {
  ru: ['игра', 'игры', 'игр'],
  uk: ['гра', 'гри', 'ігор'],
  en: ['round', 'rounds', 'rounds'],
} as const

const pluralOf = (count: number, lang: keyof typeof ROUNDS, forms: typeof ROUNDS | typeof DAYS = ROUNDS) => {
  if (lang === 'en') return forms.en[count === 1 ? 0 : 1]
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return forms[lang][0]
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return forms[lang][1]
  return forms[lang][2]
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export default function Profile({ onBack }: { onBack: () => void }) {
  const { user, setNickname, resetStats, logout } = useAuth()
  const { t, l, lang, error: errorText } = useI18n()
  const href = useHref()
  const today = kyivToday()

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

  useEffect(() => {
    if (!settings) return
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setSettings(false)
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [settings])

  useEffect(() => {
    if (!nickMessage) return
    const timer = setTimeout(() => setNickMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [nickMessage])

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
      <BackButton href="/" onClick={onBack}>
        {t('profile.back')}
      </BackButton>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="card profile-card">
            <div className="profile-id">
              <span className="avatar" aria-hidden>
                {user.nickname.charAt(0).toUpperCase()}
                <b>{summary?.level.level ?? 1}</b>
              </span>
              <div className="profile-names">
                <h1>{user.nickname}</h1>
                <span className="muted">{user.username}</span>
              </div>
            </div>

            <div className="level-panel">
              <div className="level-line">
                <span className="level-rank">
                  <b>{t(`rank.${summary?.level.rank ?? 'rookie'}` as UiKey)}</b>
                </span>
                <small>
                  {summary?.level.next ? (
                    <>
                      {t('level.next')} <b>{t(`rank.${summary.level.next.id}` as UiKey)}</b>
                    </>
                  ) : (
                    t('level.top')
                  )}
                </small>
              </div>
              <div className="level-bar">
                <i style={{ width: `${Math.round(((summary?.level.into ?? 0) / (summary?.level.need ?? 1)) * 100)}%` }} />
              </div>
              <div className="level-line">
                <span className="level-xp">
                  <b>{summary?.level.into ?? 0}</b> / {summary?.level.need ?? 0} XP
                </span>
                <small className="muted">
                  {t('level.toNext', {
                    level: (summary?.level.level ?? 1) + 1,
                    xp: (summary?.level.need ?? 0) - (summary?.level.into ?? 0),
                  })}
                </small>
              </div>
            </div>

            <div className="profile-facts">
              <div>
                <span>{t('profile.rank')}</span>
                {summary?.rank ? <b>#{summary.rank.position}</b> : <b className="empty">—</b>}
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
                <span>{pluralOf(summary?.streak.current ?? 0, lang, DAYS)}</span>
                <small className={summary?.streak.week.find((d) => d.day === today)?.played ? 'ok' : 'muted'}>{summary?.streak.week.find((d) => d.day === today)?.played ? t('profile.streakToday') : t('profile.streakIdle')}</small>
              </div>
            </div>
            <ul className="streak-week">
              {(summary?.streak.week ?? []).map((day) => (
                <li key={day.day} className={`${day.played ? 'on' : ''} ${day.day === today ? 'now' : day.day > today ? 'future' : ''}`}>
                  <span aria-hidden>{day.played ? <CheckIcon /> : null}</span>
                  <small>{WEEKDAYS[lang][(new Date(`${day.day}T00:00:00Z`).getUTCDay() + 6) % 7]}</small>
                </li>
              ))}
            </ul>
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
                  <div className="card-title">
                    <h2>{t('profile.worlds')}</h2>
                    <p className="muted">{t('profile.worldsHint')}</p>
                  </div>
                </header>
                {summary?.games.length ? (
                  <ul className="worlds">
                    {summary.games.map((row) => {
                      const game = GAMES.find((g) => g.id === row.game)
                      return (
                        <li key={row.game} className={row.solved ? '' : 'is-empty'}>
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
                            {!!row.solved && (
                              <i
                                style={{
                                  width: `${Math.max(percent(row.solved, row.pool), 2)}%`,
                                  background: game?.accent ?? 'var(--accent)',
                                }}
                              />
                            )}
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
                <ul className="modes-list">
                  {MODES.map((mode) => {
                    const row = summary?.modes.find((item) => item.mode === mode.id)
                    const played = row?.played ?? 0
                    const share = percent(row?.won ?? 0, played)
                    return (
                      <li key={mode.id} className={played ? '' : 'is-empty'}>
                        <span className="mode-name">{t(mode.label)}</span>
                        <span className="mode-count muted">
                          {played} {pluralOf(played, lang)}
                        </span>
                        <b>{share}%</b>
                        <span className="mode-bar">{!!played && <i style={{ width: `${Math.max(share, 2)}%` }} />}</span>
                      </li>
                    )
                  })}
                </ul>
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
          <Quests onLevel={(level) => setSummary((current) => (current ? { ...current, level } : current))} />

          <section className="card soon-card">
            <header>
              <h2>
                <TrophyIcon /> {t('profile.awardsTitle')}
              </h2>
            </header>
            {summary?.pinned?.length ? (
              <ul className="profile-pins">
                {summary.pinned.map((id) => (
                  <li key={id}>
                    <span className="award-mark" aria-hidden>
                      <TrophyIcon />
                    </span>
                    <b>{t(`ach.${id}` as UiKey)}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('profile.awardsSoon')}</p>
            )}
            <Link className="lb-link awards-open" href={href.achievements}>
              <TrophyIcon /> {t('ach.open')}
            </Link>
          </section>
        </div>
      </div>

      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)} role="presentation">
          <section
            className="card modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('profile.settings')}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{t('profile.settings')}</h2>
              <button type="button" className="modal-close" onClick={() => setSettings(false)} aria-label={t('profile.cancel')}>
                ✕
              </button>
            </header>

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
          </section>
        </div>
      )}
    </div>
  )
}
