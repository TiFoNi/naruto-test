'use client'

import AuthScreen from './AuthScreen'
import { BRAND } from './brand'
import type { GameMeta } from './games/meta'
import { useI18n } from './i18n'

const PATCHES = [
  ['naruto', 'onepiece', 'aot', 'jojo'],
  ['bc', 'bleach', 'kny'],
]

export default function Landing({ games }: { games: GameMeta[] }) {
  const { t } = useI18n()

  return (
    <main className="login">
      <section className="login-pitch">
        <div className="login-patches" aria-hidden>
          {PATCHES.map((row) => (
            <div className="login-patch-row" key={row[0]}>
              {row.map((id) => (
                <span className="login-patch" key={id}>
                  <img src={`/worlds/big/${id}.webp`} alt="" width={448} height={448} draggable={false} />
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="login-lead">
          <span className="login-brand">
            <span className="brand-mark" aria-hidden>
              {BRAND.mark}
            </span>
            <span className="brand-name">
              {BRAND.parts[0]}
              <em>{BRAND.parts[1]}</em>
            </span>
          </span>
          <h1>
            {t('login.hero')} <em>{t('login.heroMore')}</em>
          </h1>
          <p>{t('login.heroSub', { count: games.length })}</p>
        </div>
      </section>

      <AuthScreen />
    </main>
  )
}
