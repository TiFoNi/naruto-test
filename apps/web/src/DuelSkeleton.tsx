'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

export default function DuelSkeleton() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="duel duel-ghosts">
      <BackButton href={href.home}>{t('play.back')}</BackButton>

      <div className="duel-setup sk-lobby">
        <header className="duel-setup-head">
          <div>
            <h1>{t('duel.newTitle')}</h1>
            <p className="muted">{t('duel.newLead')}</p>
          </div>
          <span className="sk bar" />
        </header>
        <div className="duel-setup-grid">
          <div className="duel-setup-main">
            <span className="sk tall" />
            <span className="sk mid" />
            <span className="sk mid" />
          </div>
          <aside className="duel-setup-side">
            <span className="sk mid" />
            <span className="sk short" />
          </aside>
        </div>
      </div>

      <div className="sk-play">
        <span className="sk head" />
        <span className="sk tall" />
      </div>
    </div>
  )
}
