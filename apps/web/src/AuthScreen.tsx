'use client'

import { useState, type FormEvent } from 'react'
import { authClient } from './authClient'
import { GoogleIcon } from './icons'
import { useI18n } from './i18n'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthScreen() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'google' | 'link' | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<{ where: 'google' | 'link'; text: string } | null>(null)

  const callbackURL = typeof window === 'undefined' ? '/' : window.location.origin

  const withGoogle = async () => {
    setBusy('google')
    setError(null)
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL })
    if (error) {
      setError({ where: 'google', text: t('auth.googleFailed') })
      setBusy(null)
    }
  }

  const withLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(email)) return setError({ where: 'link', text: t('auth.badEmail') })
    setBusy('link')
    setError(null)
    const { error } = await authClient.signIn.magicLink({ email, callbackURL })
    setBusy(null)
    if (error) return setError({ where: 'link', text: t(error.status === 429 ? 'err.too_many' : 'auth.failed') })
    setSent(true)
  }

  if (sent)
    return (
      <div className="card auth">
        <h2>{t('auth.checkMail')}</h2>
        <p className="muted">{t('auth.checkMailHint', { email })}</p>
        <button className="ghost" type="button" onClick={() => setSent(false)}>
          {t('auth.otherEmail')}
        </button>
      </div>
    )

  return (
    <div className="card auth">
      <button className="google" type="button" onClick={withGoogle} disabled={busy !== null}>
        <GoogleIcon />
        {busy === 'google' ? t('auth.busy') : t('auth.google')}
      </button>
      {error?.where === 'google' && <div className="auth-error">{error.text}</div>}

      <div className="auth-or">
        <span>{t('auth.or')}</span>
      </div>

      <form onSubmit={withLink}>
        <label>
          {t('auth.email')}
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            maxLength={120}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            required
          />
        </label>
        {error?.where === 'link' && <div className="auth-error">{error.text}</div>}
        <button className="primary" type="submit" disabled={busy !== null}>
          {busy === 'link' ? t('auth.busy') : t('auth.sendLink')}
        </button>
      </form>

      <p className="auth-note">{t('auth.note')}</p>
    </div>
  )
}
