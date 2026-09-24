'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Background from './Background'
import Landing from './Landing'
import { useAuth } from './auth'
import { BRAND } from './brand'
import { metaById, type GameMeta } from './games/meta'
import { LANGS, useI18n } from './i18n'
import { BellIcon } from './icons'
import { useHref } from './router'

const PUBLIC = new Set(['', 'play', 'privacy', 'terms'])

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  const index = Math.max(
    LANGS.findIndex((l) => l.id === lang),
    0,
  )

  return (
    <div className="lang-switch" role="group" aria-label={t('nav.language')} style={{ '--slots': LANGS.length } as CSSProperties}>
      <span className="lang-thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
      {LANGS.map((l) => (
        <button key={l.id} className={lang === l.id ? 'active' : ''} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
          {l.label}
        </button>
      ))}
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
  const href = useHref()
  const { t } = useI18n()
  const pathname = usePathname()
  const scrolled = useScrolled()
  const [, , section, gameId, modeId, tail] = pathname.split('/')
  const open = PUBLIC.has(section ?? '')
  const game = section === 'play' ? metaById(games, gameId as never) : null
  const accent = user && game ? game.accent : BRAND.accent

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  const boardHref = href.leaderboard(game?.id ?? 'naruto', (section === 'play' ? modeId : 'classic') as never, section === 'play' && tail === 'daily')

  return (
    <div className="app">
      <Background />
      <header className={`topbar ${scrolled ? 'is-solid' : ''}`}>
        <div className="topbar-inner">
          <Link className="brand" href={href.home}>
            <span className="brand-mark" aria-hidden>
              {BRAND.mark}
            </span>
            <span className="brand-name">
              {BRAND.parts[0]}
              <em>{BRAND.parts[1]}</em>
            </span>
          </Link>

          <nav className={`topbar-nav ${user ? '' : 'is-empty'}`}>
            {user && (
              <>
                <Link className={section === 'duels' || section === 'duel' ? 'active' : ''} href={href.duels}>
                  {t('nav.duels')}
                </Link>
                <Link className={section === 'leaderboard' ? 'active' : ''} href={boardHref}>
                  {t('nav.leaderboard')}
                </Link>
              </>
            )}
          </nav>

          <div className="topbar-right">
            <LangSwitch />
            <div className="topbar-slot">
              {section === 'login' && (
                <Link className="topbar-link guest" href={href.home}>
                  <span className="topbar-link-label">{t('login.guest')}</span>
                </Link>
              )}
              {!loading && !user && section !== 'login' && (
                <Link className="topbar-link" href={href.login}>
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

      {user || open ? children : loading ? <div className="card center muted">{t('loading')}</div> : <Landing games={games} />}

      <footer>
        <p className="footer-links">
          <a href={href.privacy}>{t('footer.privacy')}</a>
          <a href={href.terms}>{t('footer.terms')}</a>
        </p>
        <p>{t('footer.disclaimer')}</p>
        <p>
          {t('footer.data')}: Naruto Wiki, Dattebayo API, Valve, OpenDota, Dota 2 Wiki, Attack on Titan Wiki, Bleach Wiki, Tokyo Ghoul Wiki, Berserk Wiki,
          Kimetsu no Yaiba Wiki, One Piece Wiki, Mortal Kombat Wiki, Hunterpedia, Black Clover Wiki, JoJo&apos;s Bizarre Encyclopedia, Soul Eater Wiki, Fire
          Force Wiki, Death Note Wiki, MangaDex, MyAnimeList.
        </p>
      </footer>
    </div>
  )
}
