'use client'

import AuthScreen from './AuthScreen'
import { BRAND } from './brand'
import type { GameMeta } from './games/meta'
import { ChartIcon, MedalIcon, SwordsIcon, TrophyIcon } from './icons'
import { useI18n, type UiKey } from './i18n'

const PERKS: { key: UiKey; hint: UiKey; Icon: typeof ChartIcon }[] = [
  { key: 'login.perk.progress', hint: 'login.perk.progressHint', Icon: ChartIcon },
  { key: 'login.perk.duels', hint: 'login.perk.duelsHint', Icon: SwordsIcon },
  { key: 'login.perk.levels', hint: 'login.perk.levelsHint', Icon: MedalIcon },
  { key: 'login.perk.board', hint: 'login.perk.boardHint', Icon: TrophyIcon },
]

function Marquee({ games, reverse }: { games: GameMeta[]; reverse?: boolean }) {
  const { l } = useI18n()

  return (
    <div className="mq">
      <div className={`mq-track ${reverse ? 'reverse' : ''}`}>
        {[...games, ...games].map((game, index) => (
          <span className="mq-chip" key={`${game.id}-${index}`}>
            <span className="mq-dot" style={{ background: game.accent }} />
            {l(game.label)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing({ games }: { games: GameMeta[] }) {
  const { t } = useI18n()
  const half = Math.ceil(games.length / 2)

  return (
    <main className="login">
      <section className="login-pitch">
        <div className="login-lead">
          <span className="login-eyebrow">{t('login.eyebrow')}</span>
          <h1>
            {BRAND.parts[0]}
            <em>{BRAND.parts[1]}</em>
          </h1>
          <p>{t('brand.tagline')}</p>
        </div>

        <div className="login-rows" aria-hidden>
          <Marquee games={games.slice(0, half)} />
          <Marquee games={games.slice(half)} reverse />
        </div>

        <ul className="login-perks">
          {PERKS.map(({ key, hint, Icon }) => (
            <li key={key}>
              <span className="login-perk-icon">
                <Icon />
              </span>
              <span className="login-perk-text">
                <strong>{t(key)}</strong>
                <small>{t(hint)}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AuthScreen />
    </main>
  )
}
