'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { authClient } from './authClient'
import { ArrowIcon, GoogleIcon, KeyIcon, MailIcon } from './icons'
import { useI18n } from './i18n'
import { useHref } from './router'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WAIT = 45

export default function AuthScreen() {
  const { t } = useI18n()
  const href = useHref()
  const callbackURL = typeof window === 'undefined' ? '/' : window.location.origin
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'google' | 'link' | 'passkey' | null>(null)
  const [hasPasskeys, setHasPasskeys] = useState(false)
  const [sent, setSent] = useState(false)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState<{ where: 'google' | 'link' | 'passkey'; text: string } | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  useEffect(() => {
    void authClient()
  }, [])

  useEffect(() => {
    let alive = true
    const credentials = typeof window === 'undefined' ? null : window.PublicKeyCredential
    if (!credentials) return
    setHasPasskeys(true)
    void credentials
      .isConditionalMediationAvailable?.()
      .then(async (ready) => {
        if (!ready || !alive) return
        const client = await authClient()
        const { error } = await client.signIn.passkey({ autoFill: true })
        if (!error && alive) window.location.assign(callbackURL)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [callbackURL])

  useEffect(() => {
    const revive = () => document.visibilityState === 'visible' && setBusy(null)
    window.addEventListener('pageshow', revive)
    document.addEventListener('visibilitychange', revive)
    return () => {
      window.removeEventListener('pageshow', revive)
      document.removeEventListener('visibilitychange', revive)
    }
  }, [])

  const valid = EMAIL.test(email)

  const withPasskey = async () => {
    setBusy('passkey')
    setError(null)
    const { error } = await (await authClient()).signIn.passkey()
    if (error) {
      setBusy(null)
      if (error.status !== 0) setError({ where: 'passkey', text: t('auth.passkeyFailed') })
      return
    }
    window.location.assign(callbackURL)
  }

  const withGoogle = async () => {
    setBusy('google')
    setError(null)
    const { error } = await (await authClient()).signIn.social({ provider: 'google', callbackURL })
    if (error) {
      setError({ where: 'google', text: t('auth.googleFailed') })
      setBusy(null)
    }
  }

  const send = async () => {
    setBusy('link')
    setError(null)
    const { error } = await (await authClient()).signIn.magicLink({ email, callbackURL })
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

      {hasPasskeys && (
        <button className="ghost auth-passkey" type="button" onClick={withPasskey} disabled={busy !== null}>
          <KeyIcon />
          {busy === 'passkey' ? t('auth.busy') : t('auth.passkey')}
        </button>
      )}
      {error?.where === 'passkey' && <div className="auth-error">{error.text}</div>}

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
            autoComplete="email webauthn"
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
        {t('auth.termsWith')} <Link href={href.terms}>{t('auth.termsTerms')}</Link> {t('auth.termsAnd')} <Link href={href.privacy}>{t('auth.termsPrivacy')}</Link>
        .
      </p>
    </section>
  )
}
