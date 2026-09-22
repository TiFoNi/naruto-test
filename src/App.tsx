import { useEffect, type CSSProperties } from 'react'
import AuthScreen from './AuthScreen'
import { statsKey, useAuth } from './auth'
import { dailyKey } from './games/specs'
import { BRAND } from './brand'
import ClassicMode from './ClassicMode'
import Dashboard from './Dashboard'
import DuelLobby from './DuelLobby'
import DuelRoom from './DuelRoom'
import Leaderboard from './Leaderboard'
import ImageMode from './ImageMode'
import AbilityMode from './AbilityMode'
import Profile from './Profile'
import ScrollRow from './ScrollRow'
import { GAMES, gameById } from './games'
import type { Game } from './games/types'
import { LANGS, useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { href, navigate, useRoute } from './router'
import { average, emptyStats, type Stats } from './stats'

function StatsBar({ stats, daily }: { stats: Stats; daily: boolean }) {
  const { t } = useI18n()
  const items = [
    [t('stats.solved'), stats.solved],
    [t(daily ? 'daily.streak' : 'stats.streak'), stats.streak],
    [t(daily ? 'daily.best' : 'stats.best'), stats.best],
    [t('stats.avg'), average(stats)],
  ] as const
  return (
    <dl className="stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function GameView({ game, mode, daily, visible }: { game: Game; mode: ModeId; daily: boolean; visible: boolean }) {
  const { stats } = useAuth()
  const { t, l } = useI18n()
  const statsFor = (m: ModeId, d: boolean) => stats[d ? dailyKey(game.id, m) : statsKey(game.id, m)] ?? emptyStats

  return (
    <div className="game-view" hidden={!visible}>
      <section className="game-head">
        <div className="game-head-top">
          <h1>{l(game.label)}</h1>
          <StatsBar stats={statsFor(mode, daily)} daily={daily} />
        </div>
        <div className="game-head-bar">
          <div className="game-switches">
            <div className="variant-tabs" role="tablist" aria-label={t('daily.variant')}>
              <a role="tab" aria-selected={!daily} className={!daily ? 'active' : ''} href={href.play(game.id, mode)}>
                ∞ {t('daily.endless')}
              </a>
              <a role="tab" aria-selected={daily} className={daily ? 'active' : ''} href={href.play(game.id, mode, true)}>
                📅 {t('daily.daily')}
              </a>
            </div>
            <div className="mode-tabs" role="tablist">
              {MODES.filter((m) => game.modes.includes(m.id)).map((m) => (
                <a
                  key={m.id}
                  role="tab"
                  aria-selected={mode === m.id}
                  className={mode === m.id ? 'active' : ''}
                  href={href.play(game.id, m.id, daily)}
                >
                  {t(m.label)}
                </a>
              ))}
            </div>
          </div>
          <a className="lb-link" href={href.leaderboard(game.id, mode, daily)}>
            🏆 {t('nav.leaderboard')}
          </a>
        </div>
      </section>
      {[false, true].map((d) => (
        <div key={String(d)} hidden={daily !== d}>
          <div hidden={mode !== 'classic'}>
            <ClassicMode game={game} active={visible && daily === d && mode === 'classic'} stats={statsFor('classic', d)} daily={d} />
          </div>
          <div hidden={mode !== 'image'}>
            <ImageMode game={game} active={visible && daily === d && mode === 'image'} stats={statsFor('image', d)} daily={d} />
          </div>
          {game.modes.includes('ability') && (
            <div hidden={mode !== 'ability'}>
              <AbilityMode game={game} active={visible && daily === d && mode === 'ability'} stats={statsFor('ability', d)} daily={d} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

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

export default function App() {
  const { user, loading, logout } = useAuth()
  const { t, l } = useI18n()
  const route = useRoute()
  const game = route.name === 'play' ? gameById(route.game) : null
  const accent = user && game ? game.accent : BRAND.accent

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  useEffect(() => {
    if (!loading && !user) navigate(href.home)
  }, [loading, user])

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
          <LangSwitch />
          {user && (
            <a
              className={`topbar-link ${route.name === 'leaderboard' ? 'active' : ''}`}
              href={href.leaderboard(game?.id ?? 'naruto', route.name === 'play' ? route.mode : 'classic', route.name === 'play' && route.daily)}
              title={t('nav.leaderboard')}
            >
              <span aria-hidden>🏆</span>
              <span className="topbar-link-label">{t('nav.leaderboard')}</span>
            </a>
          )}
          {user && (
            <a className={`topbar-link ${route.name === 'duels' || route.name === 'duel' ? 'active' : ''}`} href={href.duels} title={t('nav.duels')}>
              <span aria-hidden>⚔️</span>
              <span className="topbar-link-label">{t('nav.duels')}</span>
            </a>
          )}
          {user && (
            <div className="account">
              <a className={`account-link ${route.name === 'profile' ? 'active' : ''}`} href={href.profile} title={t('nav.profile')}>
                <span className="avatar small" aria-hidden>
                  {user.nickname.charAt(0).toUpperCase()}
                </span>
                <span className="account-name">{user.nickname}</span>
              </a>
              <button className="logout" onClick={logout}>
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="card center muted">{t('loading')}</div>
      ) : user ? (
        <>
          <div hidden={route.name !== 'home'}>
            <Dashboard />
          </div>
          {route.name === 'profile' && <Profile onBack={() => navigate(href.home)} />}
          {route.name === 'duels' && <DuelLobby />}
          {route.name === 'duel' && <DuelRoom code={route.code} />}
          {route.name === 'leaderboard' && <Leaderboard gameId={route.game} mode={route.mode} daily={route.daily} />}
          <div className="play" hidden={route.name !== 'play'}>
            <div className="play-nav">
              <a className="back" href={href.home}>
                {t('play.back')}
              </a>
              <ScrollRow className="game-tabs" label={t('nav.games')} activeKey={game?.id}>
                {GAMES.map((g) => (
                  <a
                    key={g.id}
                    className={g.id === game?.id ? 'active' : ''}
                    style={{ '--tab-accent': g.accent } as CSSProperties}
                    href={href.play(g.id, route.name === 'play' && g.modes.includes(route.mode) ? route.mode : g.modes[0], route.name === 'play' && route.daily)}
                  >
                    <span className="dot" />
                    {l(g.label)}
                  </a>
                ))}
              </ScrollRow>
            </div>
            <main>
              {GAMES.map((g) => (
                <GameView
                  key={g.id}
                  game={g}
                  mode={route.name === 'play' && route.game === g.id ? route.mode : g.modes[0]}
                  daily={route.name === 'play' && route.game === g.id && route.daily}
                  visible={route.name === 'play' && route.game === g.id}
                />
              ))}
            </main>
          </div>
        </>
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
          {t('footer.data')}: Naruto Wiki, Dattebayo API, Valve, OpenDota, Dota 2 Wiki, Attack on Titan Wiki, Bleach Wiki, Tokyo Ghoul Wiki, Berserk Wiki, Kimetsu no Yaiba Wiki, One Piece Wiki, Mortal Kombat Wiki, Hunterpedia, Black Clover Wiki, JoJo's Bizarre Encyclopedia, Soul Eater Wiki, Fire Force Wiki, MyAnimeList.
        </p>
      </footer>
    </div>
  )
}
