'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from './Avatar'
import Background from './Background'
import AwardFilters from './awardFilters'
import InstallBanner from './InstallBanner'
import AwardIcon from './awardIcons'
import DuelDock from './DuelDock'
import DuelSkeleton from './DuelSkeleton'
import PageSkeleton from './PageSkeleton'
import { repairPush, watchPushRenew } from './push'
import ChallengeSkeleton from './ChallengeSkeleton'
import Chat from './Chat'
import PickName from './PickName'
import Footer from './Footer'
import Landing from './Landing'
import { hadSession, useAuth, type XpRate } from './auth'
import BannerArt from './BannerArt'
import { MARKS } from './Profile'
import { shownTone, watchTone } from './tone'
import HumanCheck from './HumanCheck'
import { AWARDS_FILTER, dropComments, dropCoins, dropFrames, dropQuizzes, dropTitle, dropInvite, dropMentions, dropRequest, freshFeed, refreshFeed, watchFeed, type CoinNews, type DuelInvite, type Feed, type FriendAsk } from './awards'
import { openChat } from './chatEvents'
import { FRAMES, frameUrl, loadTune, tuneStamp, watchTune } from './frames'
import { startAnimGate } from './animGate'
import GemIcon from './GemIcon'
import { MODE_XP, MODE_XP_AFTER, POOL_XP_BASE, TONE_HEX, TRIES_FACTOR, TRIES_REF, levelAt, manualXp, poolXpFactor, poolXp, poolXpPastCap, triesXp, triesXpPastCap, XP_CAPS, XP_DYNAMIC, type ModeId } from '@nanda/game'
import { BRAND } from './brand'
import { metaById, visibleGames, type GameMeta } from './games/meta'
import { LANGS, useI18n, type UiKey } from './i18n'
import { BellIcon, ChatIcon, GoogleIcon, PencilIcon, ChevronIcon, CloseIcon, ExitIcon, GearIcon, GiftIcon, InfoIcon, MedalIcon, PodiumIcon, ShopIcon, TrophyIcon, SwordsIcon, UserIcon, UsersIcon } from './icons'
import { api } from './api'
import { openStream } from './stream'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { MODES } from './modes'
import { useBeforePaint } from './paint'
import { useHref, useNavigate, useVisitTracker } from './router'

const GOOGLE_HIDE_KEY = 'google-hide'

const PUBLIC = new Set(['', 'play', 'privacy', 'terms'])
const SECTIONS = new Set([
  '',
  'achievements',
  'admin',
  'c',
  'duel',
  'duels',
  'friends',
  'leaderboard',
  'levels',
  'login',
  'play',
  'privacy',
  'profile',
  'settings',
  'shop',
  'support',
  'terms',
  'u',
  'worlds',
])

function useDropdown(open: boolean, setOpen: (open: boolean) => void) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open, setOpen])

  return box
}

function NavMenu({ user, section }: { user: boolean; section?: string }) {
  const { t } = useI18n()
  const href = useHref()
  const onDuels = section === 'duels' || section === 'duel'
  const onBoard = section === 'leaderboard'

  return (
    <div className={`topbar-menu ${onDuels || onBoard ? 'is-active' : ''}`}>
      <nav className="topbar-nav">
        {user && (
          <>
            <Link prefetch={false} className={onDuels ? 'active' : ''} href={href.duels} title={t('nav.duels')}>
              <span className="topbar-nav-icon" aria-hidden>
                <SwordsIcon />
              </span>
              <span className="topbar-nav-word">{t('nav.duels')}</span>
            </Link>
            <Link prefetch={false} className={onBoard ? 'active' : ''} href={href.board} title={t('nav.leaderboard')}>
              <span className="topbar-nav-icon" aria-hidden>
                <PodiumIcon />
              </span>
              <span className="topbar-nav-word">{t('nav.leaderboard')}</span>
            </Link>
          </>
        )}
      </nav>
    </div>
  )
}

const pad = (value: number) => String(value).padStart(2, '0')

const untilMidnight = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date())
  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return 86_400 - ((at('hour') % 24) * 3600 + at('minute') * 60 + at('second'))
}

const toneHex = (tone?: string | null) =>
  GAMES.find((one) => one.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : null)

function MiniMe() {
  const { t } = useI18n()
  const { user } = useAuth()
  if (!user) return null

  const stand = levelAt(user.xp)
  const share = Math.round((stand.into / stand.need) * 100)
  const hue = GAMES.find((one) => one.id === user.tone)?.accent ?? (user.tone && TONE_HEX.test(user.tone) ? user.tone : null)

  return (
    <div className="mini-me" style={(hue ? { '--accent': hue } : {}) as React.CSSProperties}>
      <span className="mini-me-art" aria-hidden>
        {user.banner ? (
          <BannerArt id={user.banner} look={user.bannerLooks?.[user.banner]} place="profile" />
        ) : (
          <i className="mini-me-marks">
            {MARKS.map((mark) => (
              <em
                key={mark.left}
                style={
                  {
                    left: mark.left,
                    top: mark.top,
                    fontSize: Math.round(mark.size * 0.42),
                    transform: `translate(-50%, -50%) rotate(${mark.tilt}deg)`,
                  } as React.CSSProperties
                }
              >
                ?!
              </em>
            ))}
          </i>
        )}
      </span>
      <div className="mini-me-body" aria-hidden />
      <div className="mini-me-level">
        <span>{t('nav.level', { level: stand.level })}</span>
        <em>
          {stand.into} / {stand.need} XP
        </em>
      </div>
      <div className="level-bar" aria-hidden>
        <i style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}

function XpToday() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [left, setLeft] = useState(untilMidnight)

  useEffect(() => {
    const timer = setInterval(() => setLeft(untilMidnight()), 1000)
    return () => clearInterval(timer)
  }, [])

  const today = user?.today
  if (!today) return null

  const hours = Math.floor(left / 3600)
  const time = hours ? `${hours}:${pad(Math.floor((left % 3600) / 60))}` : `${Math.floor(left / 60)}:${pad(left % 60)}`

  return (
    <div className="xp-today">
      <div className="xp-today-head">
        <span>{t('xp.todayTitle')}</span>
        <small>{t('xp.resetIn', { time })}</small>
      </div>
      <div className="xp-today-total">
        <b>{today.earned}</b>
        <span>{today.earned > today.cap ? t('xp.fromGamesOver') : t('xp.fromGames', { cap: today.cap })}</span>
        <span
          className="xp-hint"
          tabIndex={0}
          role="button"
          aria-label={t('xp.rules')}
          onFocus={(event) => {
            const room = window.innerHeight - event.currentTarget.getBoundingClientRect().bottom - 26
            event.currentTarget.style.setProperty('--tip-room', `${Math.round(room)}px`)
          }}
          onMouseDown={(event) => {
            if ((event.target as Element).closest('.xp-tip')) return
            event.preventDefault()
            const hint = event.currentTarget
            if (document.activeElement === hint) hint.blur()
            else hint.focus()
          }}
        >
          <InfoIcon />
          <span className="xp-tip" role="tooltip">
            <b>{t('xp.rules')}</b>
            <table>
              <thead>
                <tr>
                  <th>{t('xp.colMode')}</th>
                  <th>{t('xp.colGame')}</th>
                  <th>{t('xp.colAfter')}</th>
                </tr>
              </thead>
              <tbody>
                {MODES.filter((mode) => mode.id !== 'clue').map((mode) => (
                  <tr key={mode.id}>
                    <td>{t(mode.label)}</td>
                    <td>{liveRange(today.rates?.[mode.id], 'low', 'high') ?? (XP_DYNAMIC && TRIES_REF[mode.id] ? `${triesXp(mode.id, TRIES_FACTOR.min)}–${triesXp(mode.id, TRIES_FACTOR.max)}` : xpRange(manualXp(mode.id, MODE_XP[mode.id]), mode.id))}</td>
                    <td>{liveRange(today.rates?.[mode.id], 'afterLow', 'afterHigh') ?? (XP_DYNAMIC && TRIES_REF[mode.id] ? afterRange(mode.id) : xpRange(manualXp(mode.id, MODE_XP_AFTER[mode.id]), mode.id, poolXpPastCap))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <span className="xp-tip-note">{t(XP_DYNAMIC ? 'xp.paceNote' : 'xp.poolNote')}</span>
            <span className="xp-tip-note">{t('xp.duelNote')}</span>
            <span className="xp-tip-note">{t('xp.dailyNote', { cap: XP_CAPS.daily })}</span>
          </span>
        </span>
      </div>
      <ul className="xp-today-list">
        {today.sources.map(({ source, earned, cap }) => {
          const over = Math.max(0, earned - cap)
          return (
            <li key={source} className={over > 0 ? 'over' : ''}>
              <span>
                {t(`xp.${source}` as UiKey)}
                <b>
                  {Math.min(earned, cap)} / {cap}
                  {over > 0 && <em className="xp-over">+{over}</em>}
                </b>
              </span>
              <i>
                <em style={{ width: `${Math.min(100, Math.round((earned / cap) * 100))}%` }} />
              </i>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AccountMenu({
  nickname,
  section,
  id,
  avatar,
  frame,
  naming,
}: {
  nickname: string
  section?: string
  id?: string
  avatar?: string | null
  frame?: string | null
  naming?: boolean
}) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const href = useHref()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const inside = section === 'profile' || section === 'settings' || section === 'friends'
  const [asks, setAsks] = useState(0)
  const rewards = user?.rewards ?? 0

  useEffect(() => {
    const stop = watchFeed((feed) => setAsks(feed.requests.length))
    return () => {
      stop()
    }
  }, [])

  return (
    <div ref={box} className={`account ${open ? 'open' : ''} ${naming ? 'is-naming' : ''}`}>
      {naming && <PickName />}
      <button
        type="button"
        className={`account-link ${inside ? 'active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="sr-only">{t('nav.profile')}: </span>
        <span className="account-name">{nickname}</span>
        <Avatar className="small" id={id} name={nickname} avatar={avatar} frame={frame} small live />
      </button>

      <div className="account-menu" style={(toneHex(user?.tone) ? { '--accent': toneHex(user?.tone) } : {}) as React.CSSProperties}>
        {open && <MiniMe />}
        {open && <XpToday />}
        <Link href={href.profile} onClick={() => setOpen(false)} prefetch={false}>
          <UserIcon />
          {t('nav.profile')}
        </Link>
        <Link href={href.levels} onClick={() => setOpen(false)} prefetch={false} className={rewards > 0 ? 'is-reward' : undefined}>
          {rewards > 0 ? <GiftIcon /> : <MedalIcon />}
          {t('nav.levels')}
          {rewards > 0 && <span className="account-claim">{t('levels.claimHint')}</span>}
        </Link>
        <Link href={href.achievements} onClick={() => setOpen(false)} prefetch={false}>
          <TrophyIcon />
          {t('ach.title')}
        </Link>
        <Link href={href.friends} onClick={() => setOpen(false)} prefetch={false}>
          <UsersIcon />
          {t('friends.title')}
          {asks > 0 && <i className="account-badge">{asks}</i>}
        </Link>
        <Link href={href.settings} onClick={() => setOpen(false)} prefetch={false}>
          <GearIcon />
          {t('profile.settings')}
        </Link>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            void logout()
          }}
        >
          <ExitIcon />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}

const HIDDEN = 'nanda.seen-awards'
const POLL_MS = 60_000
const TOAST_MS = 10_000

const readHidden = () => {
  try {
    const raw = localStorage.getItem(HIDDEN)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

function Bell() {
  const { t, l } = useI18n()
  const { user, refresh } = useAuth()
  const href = useHref()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const [googleHidden, setGoogleHidden] = useState(false)

  useEffect(() => {
    try {
      setGoogleHidden(sessionStorage.getItem(GOOGLE_HIDE_KEY) === '1')
    } catch {
      setGoogleHidden(false)
    }
  }, [])

  const [feed, setFeed] = useState<Feed>({ awards: [], invites: [], requests: [], frames: [], coins: null, mentions: [], linkGoogle: false, title: null, quizzes: [], comments: [] })
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<DuelInvite | null>(null)
  const known = useRef<Map<string, string> | null>(null)
  const since = useRef(Date.now())
  const [purse, setPurse] = useState<CoinNews | null>(null)

  useEffect(() => {
    setHidden(readHidden())
    void freshFeed()
    const stop = watchFeed(setFeed)
    const tick = () => document.visibilityState === 'visible' && void refreshFeed()
    const timer = setInterval(tick, POLL_MS)
    const close = openStream('stream/notify', { invite: () => void refreshFeed() })
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      stop()
      close()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [])

  useEffect(() => {
    const seen = known.current
    known.current = new Map(feed.invites.map((one) => [one.code, one.at]))
    if (!seen) return

    const latest = feed.invites.find((one) => seen.get(one.code) !== one.at && new Date(one.at).getTime() >= since.current)
    if (latest) setToast(latest)
  }, [feed.invites])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const news = feed.coins
    if (!news) return setPurse(null)
    if (new Date(news.at).getTime() >= since.current) setPurse(news)
  }, [feed.coins])

  useEffect(() => {
    if (!purse) return
    const timer = window.setTimeout(() => setPurse(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [purse])

  useEffect(() => {
    if (!toast) return
    if (open || !feed.invites.some((one) => one.code === toast.code)) setToast(null)
  }, [open, feed.invites, toast])

  const fresh = feed.frames.filter((id) => !(user?.frames ?? []).includes(id)).join(',')
  useEffect(() => {
    if (fresh) void refresh()
  }, [fresh, refresh])

  const hide = (id: string) => {
    const next = new Set(hidden).add(id)
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN, JSON.stringify([...next]))
    } catch {
      /* приватний режим */
    }
  }

  const accept = (code: string) => {
    setOpen(false)
    dropInvite(code)
    navigate(href.duel(code))
  }

  const decline = async (code: string) => {
    setBusy(true)
    dropInvite(code)
    await api('duel', { action: 'decline', code }).catch(() => null)
    setBusy(false)
  }

  const answer = async (id: string, accept: boolean) => {
    setBusy(true)
    dropRequest(id)
    await api('friends', { action: accept ? 'accept' : 'decline', id }).catch(() => null)
    setBusy(false)
    void refreshFeed()
  }

  const seenFrames = () => {
    dropFrames()
    void api('profile', { action: 'seenFrames' }).catch(() => null)
  }

  const seenCoins = () => {
    setPurse(null)
    dropCoins()
    void api('profile', { action: 'seenCoins' }).catch(() => null)
  }

  const hideGoogle = () => {
    setGoogleHidden(true)
    try {
      sessionStorage.setItem(GOOGLE_HIDE_KEY, '1')
    } catch {
      /* приватний режим */
    }
  }

  const seenQuizzes = () => {
    dropQuizzes()
    void api('profile', { action: 'seenQuizzes' }).catch(() => null)
  }

  const seenComments = () => {
    dropComments()
    void api('profile', { action: 'seenComments' }).catch(() => null)
  }

  const seenTitle = () => {
    dropTitle()
    void api('profile', { action: 'seenTitle' }).catch(() => null)
  }

  const seenMentions = () => {
    dropMentions()
    void api('profile', { action: 'seenMentions' }).catch(() => null)
  }

  const googleDue = feed.linkGoogle && !googleHidden
  const awards = feed.awards.filter((award) => !hidden.has(award.id))
  const askKey = (one: FriendAsk) => `friend:${one.id}:${one.at}`
  const requests = feed.requests.filter((one) => !hidden.has(askKey(one)))
  const frames = feed.frames.map((id) => FRAMES.find((one) => one.id === id)).filter((one) => one !== undefined)
  const count = awards.length + feed.invites.length + requests.length + frames.length + (feed.coins ? 1 : 0) + feed.mentions.length + (googleDue ? 1 : 0) + (feed.title ? 1 : 0) + feed.quizzes.length + feed.comments.length

  return (
    <div ref={box} className={`bell-box ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`bell ${count ? 'has-new' : ''}`}
        aria-expanded={open}
        aria-label={t('nav.bell')}
        title={t('nav.bell')}
        onClick={() => setOpen(!open)}
      >
        <BellIcon />
        {count > 0 && <i className="bell-count">{count}</i>}
      </button>

      {toast && !open && (
        <div className="bell-menu bell-pop" role="status" style={{ '--toast': `${TOAST_MS}ms` } as React.CSSProperties}>
          <i className="bell-pop-tip" aria-hidden />
          <div className="bell-item is-duel">
            <div key={`${toast.code}-${toast.at}`} className="bell-card">
              <small>{t('duel.inviteNew')}</small>
              <span className="bell-main">
                <span className="bell-mark" aria-hidden>
                  <SwordsIcon />
                </span>
                <span className="bell-body">
                  <b>{t('duel.inviteFrom', { name: toast.from })}</b>
                  <span className="bell-tags">
                    {toast.game && <em>{l(gameById(toast.game as GameId).label)}</em>}
                    {toast.mode && <em>{t((MODES.find((one) => one.id === toast.mode) ?? MODES[0]).label)}</em>}
                    <em>{t('duel.rounds', { count: toast.best })}</em>
                  </span>
                </span>
              </span>
              <span className="bell-actions">
                <button type="button" className="primary" disabled={busy} onClick={() => accept(toast.code)}>
                  {t('duel.accept')}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => {
                    setToast(null)
                    void decline(toast.code)
                  }}
                >
                  {t('duel.declineInvite')}
                </button>
              </span>
            </div>
            <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} onClick={() => setToast(null)}>
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {purse && !toast && !open && (
        <div className="bell-menu bell-pop" role="status" style={{ '--toast': `${TOAST_MS}ms` } as React.CSSProperties}>
          <i className="bell-pop-tip" aria-hidden />
          <div className="bell-item is-coins">
            <Link
              className="bell-card"
              href={href.shop}
              onClick={() => {
                setOpen(false)
                seenCoins()
              }}
              prefetch={false}
            >
              <small>{t('coins.news')}</small>
              <span className="bell-main">
                <span className="bell-mark bell-purse" aria-hidden>
                  <GemIcon count={3} sparkles={false} />
                </span>
                <span className="bell-body">
                  <b>{t('coins.added', { count: purse.coins })}</b>
                  <span className="bell-hint">{t('coins.toShop')}</span>
                </span>
              </span>
            </Link>
          </div>
        </div>
      )}

      <div className="bell-menu">
        <div className="bell-head">
          <span>{t('nav.bell')}</span>
          {count > 0 && <small>{count}</small>}
        </div>
        {count === 0 ? (
          <p className="bell-empty">{t('nav.bellEmpty')}</p>
        ) : (
          <ul className="bell-list">
            {feed.comments.map((one) => (
              <li key={one.id} className="bell-item is-comment">
                <Link
                  className="bell-card"
                  href={`${href.test(one.game as GameId, one.quizId)}#comments`}
                  onClick={() => {
                    setOpen(false)
                    seenComments()
                  }}
                  prefetch={false}
                >
                  <small>{t(one.reply ? 'commentNews.reply' : 'commentNews.new')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <ChatIcon />
                    </span>
                    <span className="bell-body">
                      <b>{t('commentNews.from', { name: one.from, title: one.title })}</b>
                      <span className="bell-hint">{one.text || t('comments.spoilerHidden')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenComments}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {feed.quizzes.map((one) => (
              <li key={one.id} className="bell-item is-quiz">
                <Link
                  className="bell-card"
                  href={href.myTests}
                  onClick={() => {
                    setOpen(false)
                    seenQuizzes()
                  }}
                  prefetch={false}
                >
                  <small>{t('quizNews.rejected')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <PencilIcon />
                    </span>
                    <span className="bell-body">
                      <b>{one.title}</b>
                      <span className="bell-hint">{one.note ? t('quizNews.why', { note: one.note }) : t('quizNews.noWhy')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenQuizzes}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {feed.title && (
              <li className="bell-item is-title">
                <Link
                  className="bell-card"
                  href={href.profile}
                  onClick={() => {
                    setOpen(false)
                    seenTitle()
                  }}
                  prefetch={false}
                >
                  <small>{t('titleNews.new')}</small>
                  <span className="bell-main">
                    <span className="bell-body">
                      <i className={`player-title is-${feed.title}`}>{t(`title.${feed.title}` as UiKey)}</i>
                      <b>{t(feed.title === 'patron' ? 'titleNews.patron' : 'titleNews.any')}</b>
                      <span className="bell-hint">{t('titleNews.hint')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenTitle}>
                  <CloseIcon />
                </button>
              </li>
            )}
            {googleDue && (
              <li className="bell-item is-google">
                <Link className="bell-card" href={`${href.settings}?tab=account`} onClick={() => setOpen(false)} prefetch={false}>
                  <small>{t('google.news')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <GoogleIcon />
                    </span>
                    <span className="bell-body">
                      <b>{t('google.title')}</b>
                      <span className="bell-hint">{t('google.hint')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={hideGoogle}>
                  <CloseIcon />
                </button>
              </li>
            )}
            {feed.coins && (
              <li className="bell-item is-coins">
                <Link
                  className="bell-card"
                  href={href.shop}
                  onClick={() => {
                    setOpen(false)
                    seenCoins()
                  }}
                  prefetch={false}
                >
                  <small>{t('coins.news')}</small>
                  <span className="bell-main">
                    <span className="bell-mark bell-purse" aria-hidden>
                      <GemIcon count={3} sparkles={false} />
                    </span>
                    <span className="bell-body">
                      <b>{t('coins.added', { count: feed.coins.coins })}</b>
                      <span className="bell-hint">{t('coins.toShop')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenCoins}>
                  <CloseIcon />
                </button>
              </li>
            )}
            {feed.mentions.map((one) => (
              <li key={one.id} className="bell-item is-mention">
                <button
                  type="button"
                  className="bell-card"
                  onClick={() => {
                    setOpen(false)
                    seenMentions()
                    openChat(one.id)
                  }}
                >
                  <small>{t('chat.mentionNew')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <ChatIcon />
                    </span>
                    <span className="bell-body">
                      <b>{t(one.reply ? 'chat.replyFrom' : 'chat.mentionFrom', { name: one.from })}</b>
                      <span className="bell-hint">{one.text}</span>
                    </span>
                  </span>
                </button>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenMentions}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {feed.invites.map((invite) => {
              const game = invite.game ? gameById(invite.game as GameId) : null
              const mode = MODES.find((m) => m.id === invite.mode)
              return (
                <li key={invite.code} className="bell-item is-duel">
                  <div className="bell-card">
                    <small>{t('duel.inviteNew')}</small>
                    <span className="bell-main">
                      <span className="bell-mark" aria-hidden>
                        <SwordsIcon />
                      </span>
                      <span className="bell-body">
                        <b>{t('duel.inviteFrom', { name: invite.from })}</b>
                        <span className="bell-tags">
                          {game && <em>{l(game.label)}</em>}
                          {mode && <em>{t(mode.label)}</em>}
                          <em>{t('duel.rounds', { count: invite.best })}</em>
                        </span>
                      </span>
                    </span>
                    <span className="bell-actions">
                      <button type="button" className="primary" disabled={busy} onClick={() => accept(invite.code)}>
                        {t('duel.accept')}
                      </button>
                      <button type="button" className="ghost" disabled={busy} onClick={() => void decline(invite.code)}>
                        {t('duel.declineInvite')}
                      </button>
                    </span>
                  </div>
                  <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} onClick={() => void decline(invite.code)}>
                    <CloseIcon />
                  </button>
                </li>
              )
            })}
            {requests.map((one) => (
              <li key={one.id} className="bell-item is-friend">
                <div className="bell-card">
                  <small>{t('friends.askNew')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <UserIcon />
                    </span>
                    <span className="bell-body">
                      <b>
                        {one.nickname}
                        {one.tag && <i className="player-tag">#{one.tag}</i>}
                      </b>
                      <span className="bell-hint">{t('friends.wants')}</span>
                    </span>
                  </span>
                  <span className="bell-actions">
                    <button type="button" className="primary" disabled={busy} onClick={() => void answer(one.id, true)}>
                      {t('friends.accept')}
                    </button>
                    <button type="button" className="ghost" disabled={busy} onClick={() => void answer(one.id, false)}>
                      {t('friends.decline')}
                    </button>
                  </span>
                </div>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={() => hide(askKey(one))}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {frames.map((frame) => (
              <li key={frame.id} className="bell-item is-frame">
                <Link
                  className="bell-card"
                  href={href.settings}
                  onClick={() => {
                    setOpen(false)
                    seenFrames()
                  }}
                  prefetch={false}
                >
                  <small>{t('frame.fresh')}</small>
                  <span className="bell-main">
                    <span className="bell-mark bell-frame" aria-hidden style={{ backgroundImage: `url(${frameUrl(frame.id)})` }} />
                    <span className="bell-body">
                      <b>{l(frame.label)}</b>
                      <span className="bell-hint">{t(frame.kind === 'award' ? 'frame.freshAward' : 'frame.freshPick')}</span>
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={seenFrames}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {awards.map((award) => (
              <li key={award.id} className={`bell-item ${award.kind === 'season' ? 'is-season' : `tier-${award.tier}`}`}>
                <Link
                  className="bell-card"
                  href={`${href.achievements}?filter=ready`}
                  onClick={() => {
                    setOpen(false)
                    window.dispatchEvent(new CustomEvent(AWARDS_FILTER, { detail: 'ready' }))
                  }}
                  prefetch={false}
                >
                  <small>{t('ach.fresh')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <AwardIcon family={award.family} award={award.id} />
                    </span>
                    <span className="bell-body">
                      <b>{t(`ach.${award.id}` as UiKey)}</b>
                      <span className="bell-hint">{t(`ach.${award.id}.hint` as UiKey)}</span>
                      {award.kind !== 'season' && (
                        <span className="bell-tags">
                          <em>{t(`achTier.${award.tier}` as UiKey)}</em>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} title={t('nav.bellHide')} onClick={() => hide(award.id)}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  return (
    <div ref={box} className={`lang-switch ${open ? 'open' : ''}`}>
      <button type="button" className="lang-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="sr-only">{t('nav.language')}: </span>
        {current.label}
        <span className="lang-caret" aria-hidden>
          <ChevronIcon />
        </span>
      </button>
      <div className="lang-list" role="listbox" aria-label={t('nav.language')}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="option"
            className={lang === l.id ? 'active' : ''}
            aria-selected={lang === l.id}
            onClick={() => {
              setOpen(false)
              setLang(l.id)
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0

    const check = () => {
      frame = 0
      setScrolled(window.scrollY > 6)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }

    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return scrolled
}

const liveRange = (rate: XpRate | undefined, low: keyof XpRate, high: keyof XpRate) =>
  rate ? (rate[low] === rate[high] ? `${rate[low]}` : `${rate[low]}–${rate[high]}`) : null

const afterRange = (mode: ModeId) => {
  const low = triesXpPastCap(mode, TRIES_FACTOR.min, 1)
  const high = triesXpPastCap(mode, TRIES_FACTOR.max, POOL_XP_BASE)
  return low === high ? `${low}` : `${low}–${high}`
}

const xpRange = (base: number, mode: string, xpFor = poolXp) =>
  poolXpFactor(mode, POOL_XP_BASE) === 1 && poolXpFactor(mode, 1) === 1 ? base : `${xpFor(base, mode, 1)}–${xpFor(base, mode, POOL_XP_BASE * 9)}`

export default function Shell({ children, games: everyGame }: { children: ReactNode; games: GameMeta[] }) {
  const { user, loading } = useAuth()
  const games = useMemo(() => visibleGames(everyGame, Boolean(user?.admin)), [everyGame, user?.admin])
  const bar = useRef<HTMLElement>(null)
  const href = useHref()
  const { t } = useI18n()
  const pathname = usePathname()
  const scrolled = useScrolled()
  const [returning, setReturning] = useState(false)
  useVisitTracker()
  const [, , section, gameId, modeId] = pathname.split('/')
  const open = PUBLIC.has(section ?? '') || !SECTIONS.has(section ?? '')
  const gated = !user && !loading && !open
  const naming = Boolean(user && user.named === false)
  const bare = section === 'login' || gated
  const game = section === 'play' ? metaById(games, gameId as never) : null
  const peek = section === 'leaderboard'
  const tone = useSyncExternalStore(watchTone, shownTone, () => null)
  useSyncExternalStore(watchTune, tuneStamp, () => 0)

  useEffect(() => {
    void loadTune()
  }, [])

  useEffect(() => startAnimGate(), [])

  useBeforePaint(() => {
    const root = document.documentElement
    const signed = user ? true : loading && root.dataset.auth === '1'
    const shown = games.find((one) => one.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : BRAND.accent)
    root.style.setProperty('--accent', signed && game ? game.accent : shown)
  }, [user, loading, game?.accent, games, tone])

  useEffect(() => {
    if (!user) return
    void repairPush().catch(() => undefined)
    return watchPushRenew()
  }, [user])

  useBeforePaint(() => {
    const header = bar.current
    if (!header) return document.documentElement.style.setProperty('--topbar-h', '0px')
    if (typeof ResizeObserver === 'undefined') return
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${Math.round(header.getBoundingClientRect().height)}px`)
    apply()
    const watcher = new ResizeObserver(apply)
    watcher.observe(header)
    return () => watcher.disconnect()
  }, [bare])

  useBeforePaint(() => {
    setReturning(hadSession())
  }, [])

  useBeforePaint(() => {
    const root = document.documentElement
    if (loading) root.dataset.checking = '1'
    else delete root.dataset.checking
    if (user) root.dataset.auth = '1'
    else if (!loading) delete root.dataset.auth
  }, [loading, user])

  return (
    <div className="app">
      <Background />
      <AwardFilters />
      {!bare && (
        <header ref={bar} className={`topbar ${scrolled ? 'is-solid' : ''}`}>
          <div className="topbar-inner">
            <Link className="brand" href={href.home} aria-label={BRAND.name} prefetch={false}>
              <span className="brand-mark" aria-hidden>
                {BRAND.mark}
              </span>
              <span className="brand-name">
                {BRAND.parts[0]}
                <em>{BRAND.parts[1]}</em>
              </span>
            </Link>

            <NavMenu user={!!user} section={section} />

            <div className="topbar-right">
              <LangSwitch />
              <div className="topbar-slot">
                {(section === 'login' || (!loading && !user && !open)) && (
                  <Link prefetch={false} className="topbar-link guest" href={href.home}>
                    <span className="topbar-link-label">{t('login.guest')}</span>
                  </Link>
                )}
                {!loading && !user && open && section !== 'login' && (
                  <Link className="topbar-link" href={href.login} prefetch={false}>
                    <span className="topbar-link-label">{t('nav.signIn')}</span>
                  </Link>
                )}
                {user && (
                  <>
                    <Link prefetch={false}
                      className={`topbar-coins topbar-shop ${section === 'shop' ? 'active' : ''}`}
                      href={href.shop}
                      title={t('nav.shop')}
                      aria-label={t('nav.shop')}
                    >
                      <ShopIcon />
                    </Link>
                    <Bell />
                    <AccountMenu
                      nickname={user.nickname}
                      section={section}
                      id={user.id}
                      avatar={user.avatar}
                      frame={user.frame}
                      naming={naming}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="app-main">
        {peek && (user || loading) ? (
          <>
            <div className={`ssr-peek ${user || returning ? 'is-on' : ''}`}>{children}</div>
            {!user && !returning && (
              <div className="ssr-skel">
                <PageSkeleton section={section} mode={modeId} />
              </div>
            )}
          </>
        ) : user || open || (loading && returning) ? (
          children
        ) : loading ? (
          section === 'duel' || section === 'duels' ? (
            <DuelSkeleton kind={section === 'duels' ? 'format' : 'duel'} />
          ) : section === 'c' ? (
            <ChallengeSkeleton />
          ) : (
            <PageSkeleton section={section} mode={modeId} />
          )
        ) : (
          <Landing games={games} />
        )}
      </main>

      {!bare && <Footer />}
      {!bare && <InstallBanner />}
      {!bare && !naming && <Chat />}
      {user && <DuelDock />}
      <HumanCheck />
    </div>
  )
}
