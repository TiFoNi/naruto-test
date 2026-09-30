'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { BellIcon, CloseIcon, MailIcon, ShieldIcon, UserIcon } from './icons'
import { useHref } from './router'
import { keepPerUser } from './session-cache'
import { disablePush, enablePush, pushState, pushSupported, type PushState } from './push'

type Tab = 'profile' | 'account' | 'notifications' | 'privacy'

const mask = (mail: string) => {
  const [name, domain] = mail.split('@')
  if (!domain) return mail
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(3, Math.min(6, name.length - 2)))}@${domain}`
}

const TABS: { id: Tab; label: UiKey; icon: typeof UserIcon }[] = [
  { id: 'profile', label: 'settings.profile', icon: UserIcon },
  { id: 'account', label: 'settings.account', icon: MailIcon },
  { id: 'notifications', label: 'settings.notifications', icon: BellIcon },
  { id: 'privacy', label: 'settings.privacy', icon: ShieldIcon },
]

let lastTab: Tab = 'profile'

keepPerUser(() => {
  lastTab = 'profile'
})

export default function Settings() {
  const { user, setNickname, resetStats, logout } = useAuth()
  const { t, error: errorText } = useI18n()
  const href = useHref()

  const [tab, setTab] = useState<Tab>(lastTab)
  const current = user?.nickname ?? ''
  const [nickname, setDraft] = useState(current)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [message])

  const filled = useRef(false)

  useEffect(() => {
    if (filled.current || !user) return
    filled.current = true
    setDraft(user.nickname)
  }, [user])

  useEffect(() => {
    if (!confirmReset) return
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setConfirmReset(false)
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [confirmReset])


  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const code = await setNickname(nickname)
    setSaving(false)
    setMessage(code ? { ok: false, text: errorText(code) } : { ok: true, text: t('profile.saved') })
  }

  const reset = async () => {
    setResetting(true)
    await resetStats()
    setResetting(false)
    setConfirmReset(false)
  }

  return (
    <div className="settings">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      <h1>{t('settings.title')}</h1>

      <div className="settings-layout">
        <nav className="settings-nav" role="tablist" aria-label={t('settings.title')}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : ''}
              onClick={() => {
                lastTab = id
                setTab(id)
              }}
            >
              <Icon /> {t(label)}
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {tab === 'profile' && (
            <section className="settings-block">
              <span className="settings-eyebrow">{t('settings.profile')}</span>
              <div className="settings-who">
                <span className="avatar" aria-hidden>
                  {current.charAt(0).toUpperCase()}
                </span>
                <div>
                  <b>{current}</b>
                  <span className="muted">{user?.username ?? ''}</span>
                </div>
              </div>

              <form onSubmit={save}>
                <label htmlFor="nickname">{t('profile.nickname')}</label>
                <p className="muted">{t('profile.nicknameHint')}</p>
                <div className="inline-field">
                  <input
                    id="nickname"
                    value={nickname}
                    maxLength={24}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setMessage(null)
                    }}
                  />
                  <button className="primary" type="submit" disabled={saving || !user || nickname.trim() === current}>
                    {saving ? '…' : t('profile.save')}
                  </button>
                </div>
                {message && <div className={message.ok ? 'notice ok' : 'notice error'}>{message.text}</div>}
              </form>
            </section>
          )}

          {tab === 'account' && (
            <section className="settings-block">
              <span className="settings-eyebrow">{t('settings.account')}</span>

              <div className="account-mail">
                <span className="muted">{t('settings.signedIn')}</span>
                <b>{user ? mask(user.username) : ''}</b>
              </div>

              <div className="settings-row">
                <div>
                  <label>{t('nav.logout')}</label>
                  <p className="muted">{t('settings.logoutHint')}</p>
                </div>
                <div className="settings-actions">
                  <button type="button" className="ghost" onClick={logout}>
                    {t('nav.logout')}
                  </button>
                </div>
              </div>

              <div className="settings-row danger-row">
                <div>
                  <label>{t('profile.resetTitle')}</label>
                  <p className="muted">{t('profile.resetHint')}</p>
                </div>
                <div className="settings-actions">
                  <button type="button" className="ghost danger-ghost" onClick={() => setConfirmReset(true)}>
                    {t('profile.resetButton')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {confirmReset && (
            <div className="modal-backdrop" onClick={() => !resetting && setConfirmReset(false)} role="presentation">
              <section
                className="card modal danger-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('profile.resetSure')}
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" className="modal-close" onClick={() => setConfirmReset(false)} aria-label={t('profile.cancel')}>
                  <CloseIcon />
                </button>
                <h2>{t('profile.resetSure')}</h2>
                <p className="muted">{t('profile.resetForever')}</p>
                <div className="modal-actions">
                  <button type="button" className="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>
                    {t('profile.cancel')}
                  </button>
                  <button type="button" className="danger-button" onClick={reset} disabled={resetting}>
                    {resetting ? t('profile.resetting') : t('profile.resetYes')}
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === 'notifications' && <PushBlock />}

          {tab === 'privacy' && (
            <section className="settings-block">
              <span className="settings-eyebrow">{t('settings.privacy')}</span>
              <p className="muted">{t('settings.soon')}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function PushBlock() {
  const { t } = useI18n()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void pushState().then((next) => alive && setState(next))
    return () => {
      alive = false
    }
  }, [])

  const toggle = async () => {
    if (!state || busy) return
    setBusy(true)
    if (state.on) await disablePush()
    else if (state.key) await enablePush(state.key)
    setState(await pushState())
    setBusy(false)
  }

  const blocked = state?.permission === 'denied'
  const ready = Boolean(state?.supported && state?.key)

  return (
    <section className="settings-block">
      <span className="settings-eyebrow">{t('settings.notifications')}</span>
      <div className="push-row">
        <div>
          <b>{t('push.duelTitle')}</b>
          <p className="muted">{t('push.duelHint')}</p>
        </div>
        <button
          type="button"
          className={`push-switch ${state?.on ? 'on' : ''}`}
          role="switch"
          aria-checked={Boolean(state?.on)}
          aria-label={t('push.duelTitle')}
          disabled={!ready || blocked || busy || !state}
          onClick={() => void toggle()}
        >
          <i />
        </button>
      </div>
      {!pushSupported() && <p className="muted small">{t('push.unsupported')}</p>}
      {blocked && <p className="muted small">{t('push.blocked')}</p>}
      {pushSupported() && !blocked && <p className="muted small">{t('push.iosHint')}</p>}
      {state?.supported && !state.key && <p className="muted small">{t('push.offline')}</p>}
    </section>
  )
}
