'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Background from './Background'
import Footer from './Footer'
import Landing from './Landing'
import { useAuth } from './auth'
import { BRAND } from './brand'
import { metaById, type GameMeta } from './games/meta'
import { LANGS, useI18n } from './i18n'
import { BellIcon, MenuIcon } from './icons'
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
              {t('nav.duels')}
            </Link>
            <Link className={onBoard ? 'active' : ''} href={href.board} onClick={() => setOpen(false)}>
              {t('nav.leaderboard')}
            </Link>
          </>
        )}
      </nav>
    </div>
  )
}

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const box = useDropdown(open, setOpen)
  const index = Math.max(
    LANGS.findIndex((l) => l.id === lang),
    0,
  )

  return (
    <div
      ref={box}
      className={`lang-switch ${open ? 'open' : ''}`}
      role="group"
      aria-label={t('nav.language')}
      style={{ '--slots': LANGS.length } as CSSProperties}
    >
      <button type="button" className="lang-toggle" aria-expanded={open} aria-label={t('nav.language')} onClick={() => setOpen(!open)}>
        {LANGS[index].label}
      </button>
      <span className="lang-thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
      <div className="lang-list">
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={lang === l.id ? 'active' : ''}
            aria-pressed={lang === l.id}
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
                  <Link className={`account-link ${section === 'profile' ? 'active' : ''}`} href={href.profile} title={t('nav.profile')}>
                    <span className="avatar small" aria-hidden>
                      {user.nickname.charAt(0).toUpperCase()}
                    </span>
                    <span className="account-name">{user.nickname}</span>
                    <span className="account-level">{t('nav.level', { level: user.level })}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {user || open ? children : loading ? <div className="card center muted page-loading">{t('loading')}</div> : <Landing games={games} />}

      <Footer />
    </div>
  )
}
