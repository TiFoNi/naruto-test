'use client'

import type { CSSProperties } from 'react'
import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

const PICKS = [0, 1, 2, 3, 4]

export default function DuelSkeleton() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="duel duel-ghosts">
      <BackButton href={href.home}>{t('play.back')}</BackButton>

      <div className="duel-setup sk-lobby">
        <header className="duel-top">
          <div className="duel-top-name">
            <h1>{t('duel.newTitle')}</h1>
            <p className="muted">{t('duel.newLead')}</p>
          </div>
          <span className="sk room" />
        </header>

        <section className="duel-arena">
          <div className="duel-corner is-you">
            <span className="sk team-name" />
            <ul className="duel-team" style={{ '--seats': 1 } as CSSProperties}>
              <li className="sk slot" />
            </ul>
            <span className="sk note" />
          </div>
          <span className="duel-vs" aria-hidden>
            VS
          </span>
          <div className="duel-corner is-rival">
            <span className="sk team-name" />
            <ul className="duel-team" style={{ '--seats': 1 } as CSSProperties}>
              <li className="sk slot" />
            </ul>
            <span className="sk note" />
          </div>
        </section>

        <div className="duel-picks">
          {PICKS.map((one) => (
            <span key={one} className="sk pick" />
          ))}
        </div>

        <footer className="duel-bar">
          <span className="sk go" />
        </footer>
      </div>

      <div className="sk-play">
        <span className="sk head" />
        <span className="sk tall" />
      </div>
    </div>
  )
}
