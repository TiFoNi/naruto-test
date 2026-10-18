import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import Link from 'next/link'
import Avatar from './Avatar'
import AvatarPicker from './AvatarPicker'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { type Level } from './Quests'
import type { UiKey } from './i18n/ui'
import { MODES } from './modes'
import { ProfileGhost } from './PageSkeleton'
import { ArrowIcon, CloseIcon, GripIcon, PlusIcon, SwordsIcon, TrophyIcon, UserIcon } from './icons'
import AwardIcon from './awardIcons'
import { useHref, useNavigate } from './router'
import { SHOWCASE_MAX } from './showcase'
import { keepPerUser } from './session-cache'
import { refreshFeed } from './awards'
import { PROFILE_BLOCKS, PROFILE_BLOCKS_DEFAULT, type ProfileBlock } from '@nanda/game'

type Held = { block: ProfileBlock; x: number; y: number; dx: number; dy: number; w: number; h: number }

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  pinned: { id: string | null; family: string | null; tier: string; at: string | null; hidden?: boolean }[]
  awards: number
  awardsTotal: number
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
  frame?: string | null
  friend?: FriendState
  blocks?: string[]
  gamePlaces: { game: GameId; mode: string; position: number }[]
  showcase: string[]
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
    hidden?: boolean
  }[]
}

type FriendState = 'none' | 'out' | 'in' | 'friends'

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

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

  const [summary, setSummary] = useState<Summary | null>(own ? knownSummary : null)
  const [places, setPlaces] = useState(false)
  const [edit, setEdit] = useState(false)
  const [layout, setLayout] = useState<ProfileBlock[] | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const list = useRef<ProfileBlock[]>(PROFILE_BLOCKS_DEFAULT)

  useEffect(() => {
    if (!held) return
    const move = (event: PointerEvent) => {
      setHeld((was) => (was ? { ...was, x: event.clientX, y: event.clientY } : was))
      const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.profile-slot') as HTMLElement | null
      const over = under?.dataset.block as ProfileBlock | undefined
      if (!over || over === held.block) return
      const from = list.current.indexOf(held.block)
      const to = list.current.indexOf(over)
      if (from < 0 || to < 0 || from === to) return
      const next = [...list.current]
      next.splice(to, 0, ...next.splice(from, 1))
      list.current = next
      setLayout(next)
    }
    const drop = () => {
      setHeld(null)
      void api('profile', { action: 'blocks', blocks: list.current })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
  }, [held?.block])
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

  const [tip, setTip] = useState(false)
  const modesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tip) return
    const away = (event: MouseEvent) => {
      if (!modesRef.current?.contains(event.target as Node)) setTip(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setTip(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [tip])

  const [friend, setFriend] = useState<FriendState>('none')

  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>(own ? 'profile/summary' : `profile/summary?id=${id}`)
    if (!ok) return setFailed(true)
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

  const games = summary?.games ?? []
  const picked = (summary?.showcase ?? [])
    .map((id) => games.find((row) => row.game === id))
    .filter((row): row is NonNullable<typeof row> => !!row)
    .slice(0, SHOWCASE_MAX)
  const shelf = picked.length ? picked : games.slice(0, SHOWCASE_MAX)
  const blanks = Math.max(0, SHOWCASE_MAX - shelf.length)

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

  if (!summary && !failed) return <ProfileGhost own={own} />

  const shown = layout ?? (summary?.blocks?.length ? (summary.blocks as ProfileBlock[]) : PROFILE_BLOCKS_DEFAULT)
  const rest = PROFILE_BLOCKS.filter((block) => !shown.includes(block))

  const keep = (next: ProfileBlock[]) => {
    setLayout(next)
    void api('profile', { action: 'blocks', blocks: next })
  }

  const hide = (block: ProfileBlock) => shown.length > 1 && keep(shown.filter((one) => one !== block))

  list.current = shown

  const grab = (block: ProfileBlock) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    const node = (event.currentTarget.closest('.profile-slot') as HTMLElement | null) ?? null
    if (!node) return
    const box = node.getBoundingClientRect()
    event.preventDefault()
    setHeld({ block, x: event.clientX, y: event.clientY, dx: event.clientX - box.left, dy: event.clientY - box.top, w: box.width, h: box.height })
  }

  const show = (block: ProfileBlock) => keep([...shown, block])

  const panels: Record<ProfileBlock, ReactNode> = {
    facts: (
      <section className="card profile-card">
        <div className="profile-facts" ref={factsRef}>
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
        </div>

      </section>
    ),
    activity: (
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
                    name: round.name ? round.name[lang] : round.hidden ? t('profile.secret') : `#${round.answerId}`,
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
    ),
    worlds: (
      <section className="card worlds-card">
        <header>
          <h2>{t('profile.worlds')}</h2>
          {!!user && (
            <Link className="worlds-all" href={own || !id ? href.worlds : href.playerWorlds(id)}>
              {t('profile.worldsAll', { count: summary?.games.length ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        {shelf.length || own ? (
          <ul className="world-shelf">
            {shelf.map((row) => {
              const game = GAMES.find((g) => g.id === row.game)
              const share = percent(row.solved, row.pool)
              return (
                <li key={row.game} style={{ '--world-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}>
                  <Link href={href.world(row.game as GameId)} prefetch={false}>
                    <span className="world-pic" style={{ '--fill': `${share}%` } as CSSProperties}>
                      <img
                        className="world-art"
                        src={`/worlds/big/${row.game}.webp`}
                        alt=""
                        width={448}
                        height={448}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className="world-lit" style={{ backgroundImage: `url(/worlds/big/${row.game}.webp)` }} />
                      {share > 0 && share < 100 && <i className="world-edge" />}
                      <em className={`world-share ${share >= 100 ? 'is-full' : ''}`}>
                        {share}%
                      </em>
                      <b className="world-count">
                        {row.solved}
                        <small>/ {row.pool}</small>
                      </b>
                    </span>
                    <span className="world-line">
                      <b>{game ? l(game.label) : row.game}</b>
                    </span>
                  </Link>
                </li>
              )
            })}
            {Array.from({ length: blanks }, (_, index) => (
              <li key={`blank-${index}`} className="is-blank">
                {own && user ? (
                  <Link
                    className="world-blank"
                    href={href.worlds}
                    aria-label={t('worlds.pin')}
                    title={t('worlds.pin')}
                    prefetch={false}
                  >
                    <span className="world-pic is-empty">
                      <PlusIcon />
                    </span>
                    <span className="world-line" aria-hidden />
                  </Link>
                ) : (
                  <span className="world-blank" aria-hidden>
                    <span className="world-pic is-empty" />
                    <span className="world-line" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted center">{t('profile.activityEmpty')}</p>
        )}
      </section>
    ),
    awards: (
      <section className="card soon-card">
        <header>
          <h2>
            {t('profile.awardsTitle')}
            <small>
              {summary?.awards ?? 0} / {summary?.awardsTotal ?? 0}
            </small>
          </h2>
          {!!user && (
            <Link className="worlds-all" href={own || !id ? href.achievements : href.playerAwards(id)}>
              {t('profile.worldsAll', { count: summary?.awardsTotal ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        <ul className="soon-badges">
          {Array.from({ length: SHOWCASE_MAX }, (_, index) => {
            const award = pinned[index]
            if (!award)
              return (
                <li key={index} className="free">
                  {own && user ? (
                    <Link href={href.achievements} aria-label={t('profile.awardsFreeHint')} prefetch={false}>
                      <span className="soon-mark" aria-hidden>
                        <PlusIcon />
                      </span>
                      <b aria-hidden />
                    </Link>
                  ) : (
                    <>
                      <span className="soon-mark" aria-hidden />
                      <b aria-hidden />
                    </>
                  )}
                </li>
              )
            const secret = award.hidden || !award.id
            return (
              <li key={award.id ?? `secret-${index}`} className={`on tier-${award.tier}`}>
                {user ? (
                  <Link href={own || !id ? href.achievements : href.playerAwards(id)} prefetch={false}>
                    <span className="soon-mark" aria-hidden>
                      {award.family ? <AwardIcon family={award.family} award={award.id} /> : <TrophyIcon />}
                    </span>
                    <b>{secret ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                  </Link>
                ) : (
                  <>
                    <span className="soon-mark" aria-hidden>
                      {award.family ? <AwardIcon family={award.family} award={award.id} /> : <TrophyIcon />}
                    </span>
                    <b>{secret ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    ),
  }

  return (
    <div className="profile">
      <BackButton href="/" onClick={onBack}>
        {t('profile.back')}
      </BackButton>

      {own && (
        <div className="profile-tune">
          <button type="button" className={`ghost small ${edit ? 'on' : ''}`} onClick={() => setEdit((was) => !was)}>
            {t(edit ? 'profile.tuneDone' : 'profile.tune')}
          </button>
        </div>
      )}

      <section className="profile-hero">
        <div className="profile-hero-id">
          {own ? <AvatarPicker /> : <Avatar id={id} name={nickname} avatar={summary?.avatar} frame={summary?.frame} />}
          <div className="profile-hero-main">
            <div className="profile-hero-name">
              <h1>{nickname}</h1>
              {tag && <i className="player-tag">#{tag}</i>}
              <span className="profile-hero-level">{t('nav.level', { level: summary?.level.level ?? 1 })}</span>
            </div>
            <div className="level-panel">
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
            {!own && id && (
              <div className="profile-hero-acts">
                <button type="button" className="primary profile-duel" disabled={calling} onClick={() => void challenge(id)}>
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
          </div>
        </div>

        <div className="profile-hero-tiles">
          <div className={`hero-tile is-modes ${tip ? 'is-open' : ''}`} ref={modesRef}>
            <button type="button" className="hero-tile-open" aria-expanded={tip} onClick={() => setTip(!tip)}>
              <span>{t('profile.characters')}</span>
              <b>{summary?.totals.solved ?? 0}</b>
            </button>
            {tip && (
              <div className="modes-pop" role="dialog">
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
              </div>
            )}
          </div>
          <div className="hero-tile">
            <span>{t('profile.duelsTitle')}</span>
            <b>{summary?.duels.played ? `${percent(summary.duels.wins, summary.duels.played)}%` : '—'}</b>
            <small>{t('profile.duelScore', { wins: summary?.duels.wins ?? 0, losses: summary?.duels.losses ?? 0 })}</small>
          </div>
          {summary?.rank ? (
            <Link className={`hero-tile is-link ${medal(summary.rank.position)}`} href={href.board}>
              <span>{t('profile.rank')}</span>
              <b>#{summary.rank.position}</b>
              <small>{t('lb.outOf', { total: summary.rank.players })}</small>
            </Link>
          ) : (
            <div className="hero-tile">
              <span>{t('profile.rank')}</span>
              <b>—</b>
              <small> </small>
            </div>
          )}
          <div className="hero-tile is-streak">
            <span>{t('profile.streakTitle')}</span>
            <b>{summary?.streak.current ?? 0}</b>
            <small>{t('profile.streakRecord', { days: summary?.streak.best ?? 0 })}</small>
          </div>
        </div>
      </section>

      <div className={`profile-grid ${edit ? 'is-edit' : ''}`}>
        {shown.map((block) => (
          <div
            className={`profile-slot slot-${block} ${held?.block === block ? 'is-held' : ''}`}
            key={block}
            data-block={block}
          >
            {edit && (
              <div className="slot-bar" onPointerDown={grab(block)}>
                <span className="slot-grip" aria-hidden>
                  <GripIcon />
                </span>
                <b>{t(`profile.block.${block}` as UiKey)}</b>
                <button
                  type="button"
                  className="slot-off"
                  aria-label={t('profile.blockHide')}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => hide(block)}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            {panels[block]}
          </div>
        ))}
      </div>

      {held && (
        <div
          className="profile-ghost"
          style={{ left: held.x - held.dx, top: held.y - held.dy, width: held.w, height: held.h }}
          aria-hidden
        >
          {panels[held.block]}
        </div>
      )}

      {edit && (
        <div className="card profile-add">
          <b>{t('profile.blockAdd')}</b>
          <div className="profile-add-row">
            {rest.length ? (
              rest.map((block) => (
                <button type="button" key={block} className="ghost" onClick={() => show(block)}>
                  <PlusIcon />
                  {t(`profile.block.${block}` as UiKey)}
                </button>
              ))
            ) : (
              <span className="muted">{t('profile.blockAll')}</span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
