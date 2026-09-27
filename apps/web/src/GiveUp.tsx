'use client'

import { useState, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { CloseIcon } from './icons'

type Props = { className?: string; disabled?: boolean; children: ReactNode; onConfirm: () => void }

export default function GiveUp({ className = 'give-up', disabled, children, onConfirm }: Props) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>
        {children}
      </button>

      {asking && (
        <div className="modal-backdrop" onClick={() => setAsking(false)} role="presentation">
          <section
            className="card modal give-up-ask"
            role="dialog"
            aria-modal="true"
            aria-label={t('giveUp.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setAsking(false)} aria-label={t('giveUp.stay')}>
              <CloseIcon />
            </button>
            <h2>{t('giveUp.title')}</h2>
            <p className="muted">{t('giveUp.hint')}</p>
            <div className="give-up-actions">
              <button type="button" className="ghost" onClick={() => setAsking(false)}>
                {t('giveUp.stay')}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setAsking(false)
                  onConfirm()
                }}
              >
                {t('giveUp.yes')}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
