import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import { MODES } from './modes'
import { CalendarIcon, TrophyIcon } from './icons'

type Named = { ru: string; uk: string; en: string }

type Level = { xp: number; level: number; into: number; need: number; rank: string; next: { from: number; id: string } | null }

type Board = {
  day: string
  resetAt: number
  quests: { id: string; goal: number; xp: number; value: number; done: boolean; claimed: boolean }[]
  free: { xp: number; claimed: boolean }
  bonus: { xp: number; claimed: boolean; ready: boolean }
  collected: number
  total: number
} & Level

type Summary = {
  since: string
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

  const [summary, setSummary] = useState<Summary | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
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
    const [profile, quests] = await Promise.all([api<Summary>('profile/summary'), api<Board>('quests')])
    if (profile.ok) setSummary(profile.data)
    if (quests.ok) setBoard(quests.data)
  }, [])

  const claim = async (id: string) => {
    setClaiming(id)
    const { ok, data } = await api<Board>('quests/claim', { claim: id })
    setClaiming(null)
    if (!ok) return
    setBoard(data)
    setSummary((current) => (current ? { ...current, level: data } : current))
  }

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

  const left = (() => {
    if (!board) return '—'
    const ms = Math.max(board.resetAt - Date.now(), 0)
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}:${String(minutes).padStart(2, '0')}`
  })()

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
                <span>{pluralOf(summary?.streak.current ?? 0, lang, DAYS)}</span>
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

          <section className="card level-card">
            <header>
              <div className="card-title">
                <h2>{t('level.title', { level: summary?.level.level ?? 1 })}</h2>
                <p className="muted">{t('level.hint')}</p>
              </div>
            </header>

            <div className="level-rank">
              <span className="level-rank-name">{t(`rank.${summary?.level.rank ?? 'rookie'}` as UiKey)}</span>
              <small className="muted">
                {summary?.level.next
                  ? `${t('level.next', { rank: t(`rank.${summary.level.next.id}` as UiKey) })} · ${t('level.nextAt', { level: summary.level.next.from })}`
                  : t('level.top')}
              </small>
            </div>

            <div className="level-bar">
              <i style={{ width: `${Math.round(((summary?.level.into ?? 0) / (summary?.level.need ?? 1)) * 100)}%` }} />
            </div>
            <div className="level-numbers">
              <span>{t('level.xp', { into: summary?.level.into ?? 0, need: summary?.level.need ?? 0 })}</span>
              <span className="muted">
                {t('level.toNext', {
                  level: (summary?.level.level ?? 1) + 1,
                  xp: (summary?.level.need ?? 0) - (summary?.level.into ?? 0),
                })}
              </span>
            </div>
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
          <section className="card quests-card">
            <header>
              <h2>{t('profile.questsTitle')}</h2>
              <span className="muted">{t('quests.reset', { time: left })}</span>
            </header>

            <ul className="quests">
              {(board?.quests ?? []).map((quest) => (
                <li key={quest.id} className={quest.claimed ? 'is-claimed' : quest.done ? 'is-ready' : ''}>
                  <div className="quest-head">
                    <span className="quest-name">{t(`quest.${quest.id}` as UiKey)}</span>
                    <span className="quest-xp">+{quest.xp} XP</span>
                  </div>
                  <div className="quest-bar">
                    <i style={{ width: `${Math.round((quest.value / quest.goal) * 100)}%` }} />
                  </div>
                  <div className="quest-foot">
                    <span className="muted">
                      {quest.value} / {quest.goal}
                    </span>
                    {quest.claimed ? (
                      <span className="quest-done">✓ {t('quests.claimed')}</span>
                    ) : quest.done ? (
                      <button type="button" className="quest-claim" disabled={claiming === quest.id} onClick={() => claim(quest.id)}>
                        {t('quests.claim', { xp: quest.xp })}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}

              {board && (
                <li className={`quest-free ${board.free.claimed ? 'is-claimed' : 'is-ready'}`}>
                  <div className="quest-head">
                    <span className="quest-name">{t('quests.free')}</span>
                    <span className="quest-xp">+{board.free.xp} XP</span>
                  </div>
                  <div className="quest-foot">
                    <span className="muted">{t('quests.freeHint')}</span>
                    {board.free.claimed ? (
                      <span className="quest-done">✓ {t('quests.claimed')}</span>
                    ) : (
                      <button type="button" className="quest-claim" disabled={claiming === 'free'} onClick={() => claim('free')}>
                        {t('quests.claim', { xp: board.free.xp })}
                      </button>
                    )}
                  </div>
                </li>
              )}
            </ul>

            {board && (
              <div className={`quest-bonus ${board.bonus.claimed ? 'is-claimed' : board.bonus.ready ? 'is-ready' : ''}`}>
                <div className="quest-head">
                  <span className="quest-name">{t('quests.bonus')}</span>
                  <span className="quest-xp">+{board.bonus.xp} XP</span>
                </div>
                <div className="quest-bar">
                  <i style={{ width: `${Math.round((board.collected / board.total) * 100)}%` }} />
                </div>
                <div className="quest-foot">
                  <span className="muted">
                    {board.collected} / {board.total}
                  </span>
                  {board.bonus.claimed ? (
                    <span className="quest-done">✓ {t('quests.claimed')}</span>
                  ) : board.bonus.ready ? (
                    <button type="button" className="quest-claim" disabled={claiming === 'bonus'} onClick={() => claim('bonus')}>
                      {t('quests.claim', { xp: board.bonus.xp })}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
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
