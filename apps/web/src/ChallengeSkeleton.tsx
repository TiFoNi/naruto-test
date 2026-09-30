'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

export default function ChallengeSkeleton() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="game-view challenge challenge-ghosts">
      <BackButton href={href.home}>{t('play.back')}</BackButton>

      <header className="game-head challenge-head">
        <div className="game-title">
          <div className="game-name">
            <span className="sk mark" />
            <span className="sk line" />
          </div>
        </div>
        <span className="sk line sub" />
      </header>

      <section className="play-layout sk-board">
        <div className="play-main">
          <span className="sk panel" />
          <span className="sk tries" />
        </div>
        <aside className="play-side">
          <span className="sk stats" />
          <span className="sk legend" />
          <span className="sk actions" />
        </aside>
      </section>

      <section className="play-layout sk-result">
        <div className="play-main">
          <span className="sk answer" />
        </div>
        <aside className="play-side">
          <span className="sk linkcard" />
        </aside>
      </section>
    </div>
  )
}
