import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Avatar from './Avatar'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import WorldMark from './WorldMark'
import { useI18n } from './i18n'
import { type Level } from './Quests'
import type { UiKey } from './i18n/ui'
import { MODES } from './modes'
import { CalendarIcon, CheckIcon, SwordsIcon, TrophyIcon, UserIcon } from './icons'
import { useHref, useNavigate } from './router'
import { kyivToday } from './stats'
import { keepPerUser } from './session-cache'
import { refreshFeed } from './awards'

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  pinned: { id: string | null; tier: string; at: string | null; hidden?: boolean }[]
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
  nickname?: string
  tag?: string | null
  avatar?: string | null
  friend?: FriendState
  gamePlaces: { game: GameId; mode: string; position: number }[]
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
    answerId?: number
    status: string
    guessCount?: number
    daily?: string
    challenge?: string
    finishedAt?: string
    name?: Named | null
  }[]
}

type FriendState = 'none' | 'out' | 'in' | 'friends'

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

let knownSummary: Summary | null = null

keepPerUser(() => {
  knownSummary = null
})

export default function Profile({ onBack, id }: { onBack: () => void; id?: string }) {
  const { user } = useAuth()
  const own = !id
  const { t, l, lang } = useI18n()
  const href = useHref()
  const today = kyivToday()

  const [summary, setSummary] = useState<Summary | null>(own ? knownSummary : null)
  const [places, setPlaces] = useState(false)
  const factsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!places) return
    const away = (event: MouseEvent) => {
      if (!factsRef.current?.contains(event.target as Node)) setPlaces(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setPlaces(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [places])

  const [friend, setFriend] = useState<FriendState>('none')

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>(own ? 'profile/summary' : `profile/summary?id=${id}`)
    if (!ok) return
    if (own) knownSummary = data
    setSummary(data)
  }, [id, own])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setFriend(summary?.friend ?? 'none')
  }, [summary?.friend])

  const askFriend = async (target: string) => {
    const { ok, data } = await api<{ state?: FriendState }>('friends', { action: 'ask', id: target })
    if (ok) setFriend(data.state ?? 'out')
  }

  const answerFriend = async (target: string, accept: boolean) => {
    const { ok, data } = await api<{ state?: FriendState }>('friends', { action: accept ? 'accept' : 'decline', id: target })
    if (ok) setFriend(data.state ?? 'none')
    void refreshFeed()
  }

  const removeFriend = async (target: string) => {
    const { ok } = await api('friends', { action: 'remove', id: target })
    if (ok) setFriend('none')
  }

  const nickname = (own ? user?.nickname : summary?.nickname) ?? ''
  const tag = (own ? user?.tag : summary?.tag) ?? null

  const pinned = summary?.pinned ?? []
  const best = summary?.gamePlaces?.[0] ?? null

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

  const medal = (position: number) => (position === 1 ? 'gold' : position === 2 ? 'silver' : position === 3 ? 'bronze' : '')

  const gameLabel = (id: string) => GAMES.find((g) => g.id === id)?.label
  const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label ?? 'mode.classic'
  const navigate = useNavigate()
  const [calling, setCalling] = useState(false)


  const challenge = async (target: string) => {
    setCalling(true)
    const { ok, data } = await api<{ duel?: { code: string } }>('duel', { action: 'challenge', to: target })
    setCalling(false)
    if (ok && data.duel) navigate(href.duel(data.duel.code))
  }

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
              <Avatar id={id ?? user?.id} name={nickname} avatar={own ? user?.avatar : summary?.avatar}>
                <b>{summary?.level.level ?? 1}</b>
              </Avatar>
              <div className="profile-names">
                <h1>
                  {nickname}
                  {tag && <i className="player-tag">#{tag}</i>}
                </h1>
                {own && <span className="muted">{user?.username ?? ''}</span>}
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

            <div className="profile-facts" ref={factsRef}>
              <div className={`fact fact-rank ${summary?.rank ? medal(summary.rank.position) : ''}`}>
                <span>{t('profile.rank')}</span>
                {summary?.rank ? (
                  <p className="fact-place">
                    <b>#{summary.rank.position}</b>
                    <small>{t('lb.outOf', { total: summary.rank.players })}</small>
                  </p>
                ) : (
                  <b className="empty">—</b>
                )}
                {summary?.rank && (
                  <Link className="fact-more" href={href.board}>
                    {t('profile.placesMore')}
                  </Link>
                )}
              </div>
              <div className={`fact fact-rank ${best ? medal(best.position) : ''} ${places ? 'open' : ''}`}>
                <span>{t('profile.bestGame')}</span>
                {best ? (
                  <>
                    <p className="fact-place">
                      <b>#{best.position}</b>
                    </p>
                    <button type="button" className="fact-more" aria-expanded={places} onClick={() => setPlaces(!places)}>
                      {t('profile.placesMore')}
                    </button>
                  </>
                ) : (
                  <b className="empty">—</b>
                )}
              </div>

              {places && summary && (
                <div className="places-pop" role="dialog" aria-label={t('profile.placesTitle')}>
                  <span className="places-pop-title">{t('profile.placesTitle')}</span>
                  <ol className="places-list">
                    {summary.gamePlaces.map((row) => (
                      <li key={`${row.game}_${row.mode}`} className={medal(row.position)}>
                        <b>#{row.position}</b>
                        <span>
                          {l(gameLabel(row.game)!)}
                          <small>{t(modeLabel(row.mode))}</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="fact">
                <span>{t('profile.favourite')}</span>
                {summary?.favourite ? (
                  <b className="small" title={l(gameLabel(summary.favourite)!)}>
                    {l(gameLabel(summary.favourite)!)}
                  </b>
                ) : (
                  <b className="empty">—</b>
                )}
              </div>
              <div className="fact">
                <span>{t('profile.since')}</span>
                {summary?.since ? <b className="small">{date(summary.since, true)}</b> : <b className="empty">—</b>}
              </div>
            </div>

            {!own && id && (
              <div className="profile-acts">
                <button type="button" className="primary big duel-call" disabled={calling} onClick={() => void challenge(id)}>
                  <SwordsIcon />
                  {t('duel.challenge')}
                </button>
                {friend === 'in' ? (
                  <div className="profile-friend-ask">
                    <button type="button" className="ghost" onClick={() => void answerFriend(id, true)}>
                      {t('friends.accept')}
                    </button>
                    <button type="button" className="ghost" onClick={() => void answerFriend(id, false)}>
                      {t('friends.decline')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ghost profile-friend"
                    onClick={() => void (friend === 'none' ? askFriend(id) : removeFriend(id))}
                  >
                    <UserIcon />
                    {t(friend === 'friends' ? 'friends.remove' : friend === 'out' ? 'friends.cancel' : 'friends.add')}
                  </button>
                )}
              </div>
            )}
          </section>

          {own && (
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
          )}

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
                        {round.challenge ? ` · ${t('profile.fromFriend')}` : ''}
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
                          <WorldMark
                            game={row.game as GameId}
                            className="world-tag"
                            style={{ background: game?.accent ?? 'var(--accent)' }}
                          />
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

              <section className="card soon-card">
                <header>
                  <h2>
                    <TrophyIcon /> {t('profile.awardsTitle')}
                    <span className="soon-count">{pinned.length}/6</span>
                  </h2>
                </header>
                <p className="muted">{pinned.length ? t('profile.awardsSoon') : own ? t('profile.awardsPinHint') : t('profile.awardsNone')}</p>
                <ul className="soon-badges">
                  {Array.from({ length: 6 }, (_, index) => {
                    const award = pinned[index]
                    if (!award) return <li key={index} />
                    return (
                      <li key={award.id ?? `secret-${index}`} className={`on tier-${award.tier}`}>
                        <TrophyIcon />
                        <b>{award.hidden || !award.id ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                      </li>
                    )
                  })}
                </ul>
                {own && (
                  <Link className="lb-link awards-open" href={href.achievements}>
                    <TrophyIcon /> {t('ach.open')}
                  </Link>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
