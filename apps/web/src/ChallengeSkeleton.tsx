'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

export default function ChallengeSkeleton() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="game-view challenge">
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

      <section className="play-layout">
        <div className="play-main">
          <span className="sk tall" />
        </div>
        <aside className="play-side">
          <span className="sk mid" />
          <span className="sk short" />
        </aside>
      </section>
    </div>
  )
}
