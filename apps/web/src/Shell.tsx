'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Landing from './Landing'
import { useAuth } from './auth'
import { BRAND } from './brand'
import { metaById, type GameMeta } from './games/meta'
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

export default function Shell({ children, games }: { children: ReactNode; games: GameMeta[] }) {
  const { user, loading } = useAuth()
  const { t } = useI18n()
  const pathname = usePathname()
  const [, section, gameId, modeId, tail] = pathname.split('/')
  const open = section === 'play' || section === '' || section === undefined
  const game = section === 'play' ? metaById(games, gameId as never) : null
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
          {!loading && !user && (
            <a className="topbar-link" href={href.login}>
              <span className="topbar-link-label">{t('nav.signIn')}</span>
            </a>
          )}
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

      {user || open ? children : <Landing games={games} />}

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
