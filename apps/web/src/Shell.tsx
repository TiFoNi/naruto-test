'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Background from './Background'
import Footer from './Footer'
import Landing from './Landing'
import { hadSession, useAuth } from './auth'
import { BRAND } from './brand'
import { metaById, type GameMeta } from './games/meta'
import { LANGS, useI18n, type UiKey } from './i18n'
import { BellIcon, ChevronIcon, ExitIcon, GearIcon, MedalIcon, MenuIcon, SwordsIcon, UserIcon } from './icons'
import { useBeforePaint } from './paint'
import { useHref, useVisitTracker } from './router'

const PUBLIC = new Set(['', 'play', 'privacy', 'terms'])

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
                <MedalIcon />
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
          <li key={source} className={earned >= cap ? 'full' : ''}>
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
  const inside = section === 'profile' || section === 'settings'

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
  const open = PUBLIC.has(section ?? '')
  const game = section === 'play' ? metaById(games, gameId as never) : null
  const accent = user && game ? game.accent : BRAND.accent

  useBeforePaint(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

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
                  <button type="button" className="bell" aria-label={t('nav.bell')} title={t('nav.bell')}>
                    <BellIcon />
                  </button>
                  <AccountMenu nickname={user.nickname} level={user.level} section={section} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {user || open || (loading && returning) ? children : loading ? <div className="card center muted page-loading">{t('loading')}</div> : <Landing games={games} />}

      <Footer />
    </div>
  )
}
