'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

export default function DuelSkeleton({ code }: { code: string }) {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="duel duel-ghosts">
      <BackButton href={href.home}>{t('play.back')}</BackButton>

      <div className="ghost-lobby">
        <header className="duel-setup-head">
          <div>
            <h1>{t('duel.newTitle')}</h1>
            <p className="muted">{t('duel.newLead')}</p>
          </div>
          <div className="duel-code">
            <span className="muted">{t('duel.codeLabel')}</span>
            <b>{code}</b>
          </div>
        </header>
        <div className="duel-setup-grid">
          <div className="duel-setup-main">
            <span className="ghost tall" />
            <span className="ghost mid" />
            <span className="ghost mid" />
          </div>
          <aside className="duel-setup-side">
            <span className="ghost mid" />
            <span className="ghost short" />
          </aside>
        </div>
      </div>

      <div className="ghost-play">
        <span className="ghost head" />
        <span className="ghost tall" />
      </div>
    </div>
  )
}
