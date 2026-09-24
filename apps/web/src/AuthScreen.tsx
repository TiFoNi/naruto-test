'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { authClient } from './authClient'
import { ArrowIcon, GoogleIcon, MailIcon } from './icons'
import { useI18n } from './i18n'
import { useHref } from './router'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WAIT = 45

export default function AuthScreen() {
  const { t } = useI18n()
  const href = useHref()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'google' | 'link' | null>(null)
  const [sent, setSent] = useState(false)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState<{ where: 'google' | 'link'; text: string } | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const callbackURL = typeof window === 'undefined' ? '/' : window.location.origin
  const valid = EMAIL.test(email)

  const withGoogle = async () => {
    setBusy('google')
    setError(null)
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL })
    if (error) {
      setError({ where: 'google', text: t('auth.googleFailed') })
      setBusy(null)
    }
  }

  const send = async () => {
    setBusy('link')
    setError(null)
    const { error } = await authClient.signIn.magicLink({ email, callbackURL })
    setBusy(null)
    if (error) {
      setError({ where: 'link', text: t(error.status === 429 ? 'err.too_many' : 'auth.failed') })
      return false
    }
    setLeft(WAIT)
    return true
  }

  const withLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return setError({ where: 'link', text: t('auth.badEmail') })
    if (await send()) setSent(true)
  }

  if (sent)
    return (
      <section className="card auth auth-sent">
        <span className="auth-stamp" aria-hidden>
          <MailIcon />
        </span>
        <h2>{t('auth.checkMail')}</h2>
        <p className="auth-sent-text">
          {t('auth.sentTo')}
          <br />
          <strong>{email}</strong>
          <br />
          {t('auth.sentValid')}
        </p>
        {error?.where === 'link' && <div className="auth-error">{error.text}</div>}
        <button className="ghost auth-resend" type="button" disabled={left > 0 || busy !== null} onClick={send}>
          {left > 0 ? t('auth.resendIn', { sec: `0:${String(left).padStart(2, '0')}` }) : t('auth.resend')}
        </button>
        <div className="auth-sent-foot">
          <button type="button" className="auth-link" onClick={() => setSent(false)}>
            {t('auth.otherEmail')}
          </button>
          <span>{t('auth.spam')}</span>
        </div>
      </section>
    )

  return (
    <section className="card auth">
      <div className="auth-head">
        <h2>{t('auth.heading')}</h2>
        <p>{t('auth.autoAccount')}</p>
      </div>

      <button className="google" type="button" onClick={withGoogle} disabled={busy !== null}>
        <GoogleIcon />
        {busy === 'google' ? t('auth.busy') : t('auth.google')}
      </button>
      {error?.where === 'google' && <div className="auth-error">{error.text}</div>}

      <div className="auth-or">
        <span>{t('auth.orMail')}</span>
      </div>

      <form onSubmit={withLink} noValidate>
        <label htmlFor="auth-email">{t('auth.email')}</label>
        <div className={`auth-field ${error?.where === 'link' ? 'bad' : valid ? 'ready' : ''}`}>
          <MailIcon />
          <input
            id="auth-email"
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
          />
        </div>
        {error?.where === 'link' && <div className="auth-error">{error.text}</div>}
        <button className="primary" type="submit" disabled={busy !== null}>
          {busy === 'link' ? t('auth.busy') : t('auth.sendLink')}
          <ArrowIcon />
        </button>
      </form>

      <p className="auth-terms">
        {t('auth.termsWith')} <a href={href.terms}>{t('auth.termsTerms')}</a> {t('auth.termsAnd')} <a href={href.privacy}>{t('auth.termsPrivacy')}</a>
        .
      </p>
    </section>
  )
}
