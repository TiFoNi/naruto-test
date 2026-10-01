'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Background from './Background'
import DuelDock from './DuelDock'
import DuelSkeleton from './DuelSkeleton'
import PageSkeleton from './PageSkeleton'
import { repairPush, watchPushRenew } from './push'
import ChallengeSkeleton from './ChallengeSkeleton'
import Footer from './Footer'
import Landing from './Landing'
import { hadSession, useAuth } from './auth'
import { dropInvite, dropRequest, freshFeed, refreshFeed, watchFeed, type Feed } from './awards'
import { BRAND } from './brand'
import { metaById, type GameMeta } from './games/meta'
import { LANGS, useI18n, type UiKey } from './i18n'
import { BellIcon, ChevronIcon, CloseIcon, ExitIcon, GearIcon, MenuIcon, PodiumIcon, SwordsIcon, TrophyIcon, UserIcon, UsersIcon } from './icons'
import { api } from './api'
import { openStream } from './stream'
import { gameById } from './games'
import type { GameId } from './games/types'
import { MODES } from './modes'
import { useBeforePaint } from './paint'
import { useHref, useNavigate, useVisitTracker } from './router'

const PUBLIC = new Set(['', 'play', 'privacy', 'terms'])
const SECTIONS = new Set(['', 'achievements', 'admin', 'c', 'duel', 'duels', 'friends', 'leaderboard', 'login', 'play', 'privacy', 'profile', 'settings', 'terms', 'u'])

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
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const onDuels = section === 'duels' || section === 'duel'
  const onBoard = section === 'leaderboard'

  return (
    <div ref={box} className={`topbar-menu ${open ? 'open' : ''} ${onDuels || onBoard ? 'is-active' : ''}`}>
      {user && (
        <button
          type="button"
          className="topbar-menu-toggle"
          aria-expanded={open}
          aria-label={t('nav.menu')}
          title={t('nav.menu')}
          onClick={() => setOpen(!open)}
        >
          <MenuIcon />
        </button>
      )}
      <nav className="topbar-nav">
        {user && (
          <>
            <Link className={onDuels ? 'active' : ''} href={href.duels} onClick={() => setOpen(false)}>
              <span className="topbar-nav-icon" aria-hidden>
                <SwordsIcon />
              </span>
              {t('nav.duels')}
            </Link>
            <Link className={onBoard ? 'active' : ''} href={href.board} onClick={() => setOpen(false)}>
              <span className="topbar-nav-icon" aria-hidden>
                <PodiumIcon />
              </span>
              {t('nav.leaderboard')}
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
      <p className="xp-today-total">
        <b>{today.earned}</b>
        <span>{t('xp.fromGames', { cap: today.cap })}</span>
      </p>
      <ul className="xp-today-list">
        {today.sources.map(({ source, earned, cap }) => (
          <li key={source}>
            <span>
              {t(`xp.${source}` as UiKey)}
              <b>
                {earned} / {cap}
              </b>
            </span>
            <i>
              <em style={{ width: `${Math.min(100, Math.round((earned / cap) * 100))}%` }} />
            </i>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AccountMenu({ nickname, level, section }: { nickname: string; level: number; section?: string }) {
  const { t } = useI18n()
  const { logout } = useAuth()
  const href = useHref()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const inside = section === 'profile' || section === 'settings' || section === 'friends'
  const [asks, setAsks] = useState(0)

  useEffect(() => {
    const stop = watchFeed((feed) => setAsks(feed.requests.length))
    return () => {
      stop()
    }
  }, [])

  return (
    <div ref={box} className={`account ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`account-link ${inside ? 'active' : ''}`}
        aria-expanded={open}
        aria-label={t('nav.profile')}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar small" aria-hidden>
          {nickname.charAt(0).toUpperCase()}
        </span>
        <span className="account-name">{nickname}</span>
        <span className="account-level">{t('nav.level', { level })}</span>
      </button>

      <div className="account-menu">
        {open && <XpToday />}
        <Link href={href.profile} onClick={() => setOpen(false)} prefetch={false}>
          <UserIcon />
          {t('nav.profile')}
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
  const href = useHref()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const [feed, setFeed] = useState<Feed>({ awards: [], invites: [], requests: [] })
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)

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

  const awards = feed.awards.filter((award) => !hidden.has(award.id))
  const count = awards.length + feed.invites.length + feed.requests.length

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

      <div className="bell-menu">
        <div className="bell-head">
          <span>{t('nav.bell')}</span>
          {count > 0 && <small>{count}</small>}
        </div>
        {count === 0 ? (
          <p className="bell-empty">{t('nav.bellEmpty')}</p>
        ) : (
          <ul className="bell-list">
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
            {feed.requests.map((one) => (
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
                <button type="button" className="bell-hide" aria-label={t('nav.bellHide')} onClick={() => void answer(one.id, false)}>
                  <CloseIcon />
                </button>
              </li>
            ))}
            {awards.map((award) => (
              <li key={award.id} className={`bell-item tier-${award.tier}`}>
                <Link className="bell-card" href={href.achievements} onClick={() => setOpen(false)} prefetch={false}>
                  <small>{t('ach.fresh')}</small>
                  <span className="bell-main">
                    <span className="bell-mark" aria-hidden>
                      <TrophyIcon />
                    </span>
                    <span className="bell-body">
                      <b>{t(`ach.${award.id}` as UiKey)}</b>
                      <span className="bell-hint">{t(`ach.${award.id}.hint` as UiKey)}</span>
                      <span className="bell-tags">
                        <em>{t(`achTier.${award.tier}` as UiKey)}</em>
                      </span>
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
      <button type="button" className="lang-toggle" aria-expanded={open} aria-label={t('nav.language')} onClick={() => setOpen(!open)}>
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

export default function Shell({ children, games }: { children: ReactNode; games: GameMeta[] }) {
  const { user, loading } = useAuth()
  const bar = useRef<HTMLElement>(null)
  const href = useHref()
  const { t } = useI18n()
  const pathname = usePathname()
  const scrolled = useScrolled()
  const [returning, setReturning] = useState(false)
  useVisitTracker()
  const [, , section, gameId] = pathname.split('/')
  const open = PUBLIC.has(section ?? '') || !SECTIONS.has(section ?? '')
  const game = section === 'play' ? metaById(games, gameId as never) : null
  useBeforePaint(() => {
    const root = document.documentElement
    const signed = user ? true : loading && root.dataset.auth === '1'
    root.style.setProperty('--accent', signed && game ? game.accent : BRAND.accent)
  }, [user, loading, game?.accent])

  useEffect(() => {
    if (!user) return
    void repairPush().catch(() => undefined)
    return watchPushRenew()
  }, [user])

  useBeforePaint(() => {
    const header = bar.current
    if (!header || typeof ResizeObserver === 'undefined') return
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${Math.round(header.getBoundingClientRect().height)}px`)
    apply()
    const watcher = new ResizeObserver(apply)
    watcher.observe(header)
    return () => watcher.disconnect()
  }, [])

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
                <Link className="topbar-link guest" href={href.home}>
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
                  <Bell />
                  <AccountMenu nickname={user.nickname} level={user.level} section={section} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {user || open || (loading && returning) ? (
        children
      ) : loading ? (
        section === 'duel' || section === 'duels' ? (
          <DuelSkeleton />
        ) : section === 'c' ? (
          <ChallengeSkeleton />
        ) : (
          <PageSkeleton section={section} />
        )
      ) : (
        <Landing games={games} />
      )}

      <Footer />
      {user && <DuelDock />}
    </div>
  )
}
