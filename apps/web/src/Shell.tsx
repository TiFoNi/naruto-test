'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import AuthScreen from './AuthScreen'
import { useAuth } from './auth'
import { BRAND } from './brand'
import { GAMES, gameById } from './games'
import { LANGS, useI18n } from './i18n'
import { SwordsIcon, TrophyIcon } from './icons'
import { href } from './router'

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('nav.language')}>
      {LANGS.map((l) => (
        <button key={l.id} className={lang === l.id ? 'active' : ''} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { t, l } = useI18n()
  const pathname = usePathname()
  const [, section, gameId, modeId, tail] = pathname.split('/')
  const game = section === 'play' ? gameById(gameId as never) : null
  const accent = user && game ? game.accent : BRAND.accent

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  const boardHref = href.leaderboard(game?.id ?? 'naruto', (section === 'play' ? modeId : 'classic') as never, section === 'play' && tail === 'daily')

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href.home}>
          <span className="brand-mark" aria-hidden>
            {BRAND.mark}
          </span>
          <span className="brand-name">
            {BRAND.parts[0]}
            <em>{BRAND.parts[1]}</em>
          </span>
        </a>
        <div className="topbar-right">
          {user && (
            <a className={`topbar-link ${section === 'leaderboard' ? 'active' : ''}`} href={boardHref} title={t('nav.leaderboard')}>
              <TrophyIcon />
              <span className="topbar-link-label">{t('nav.leaderboard')}</span>
            </a>
          )}
          {user && (
            <a className={`topbar-link ${section === 'duels' || section === 'duel' ? 'active' : ''}`} href={href.duels} title={t('nav.duels')}>
              <SwordsIcon />
              <span className="topbar-link-label">{t('nav.duels')}</span>
            </a>
          )}
          {user && (
            <div className="account">
              <a className={`account-link ${section === 'profile' ? 'active' : ''}`} href={href.profile} title={t('nav.profile')}>
                <span className="avatar small" aria-hidden>
                  {user.nickname.charAt(0).toUpperCase()}
                </span>
                <span className="account-name">{user.nickname}</span>
              </a>
            </div>
          )}
          <LangSwitch />
        </div>
      </header>

      {loading ? (
        <div className="card center muted">{t('loading')}</div>
      ) : user ? (
        children
      ) : (
        <main className="landing">
          <div className="landing-copy">
            <h1>
              {BRAND.parts[0]}
              <em>{BRAND.parts[1]}</em>
            </h1>
            <p>{t('brand.tagline')}</p>
            <ul className="landing-games">
              {GAMES.map((g) => (
                <li key={g.id} style={{ '--tab-accent': g.accent } as CSSProperties}>
                  <span className="dot" />
                  {l(g.label)}
                </li>
              ))}
            </ul>
          </div>
          <AuthScreen />
        </main>
      )}

      <footer>
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
