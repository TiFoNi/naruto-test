'use client'

import { useState } from 'react'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { CheckIcon } from './icons'

const SHAPE = /^[\p{L}\p{N} _.\-]{2,24}$/u

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')

export default function PickName() {
  const { t } = useI18n()
  const { user, setNickname } = useAuth()
  const [draft, setDraft] = useState(user?.nickname ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = tidy(draft)
  const fits = SHAPE.test(clean)

  const save = async () => {
    if (!fits || busy) return
    setBusy(true)
    const code = await setNickname(clean)
    setBusy(false)
    if (code) setError(t('name.bad'))
  }

  return (
    <section className="pick-pop" role="dialog" aria-label={t('name.title')}>
        <h1>{t('name.title')}</h1>
        <p className="muted">{t('name.hint')}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="pick-field">
            <input
              value={draft}
              maxLength={24}
              autoFocus
              aria-label={t('name.title')}
              onChange={(event) => {
                setDraft(event.target.value)
                setError('')
              }}
            />
            {user?.tag && <span className="pick-tag">#{user.tag}</span>}
          </div>

          {!fits && <p className="pick-rules">{t('name.rules')}</p>}

          <button type="submit" className="primary" disabled={!fits || busy}>
            <CheckIcon />
            {t('name.save')}
          </button>
        </form>

        {error && <p className="pick-error">{error}</p>}
    </section>
  )
}
