'use client'

import { useEffect, useState, type FormEvent } from 'react'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { BellIcon, MailIcon, ShieldIcon, UserIcon } from './icons'
import { useHref } from './router'
import { keepPerUser } from './session-cache'

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
  const [nickname, setDraft] = useState(user?.nickname ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [message])


  if (!user) return null

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
                  {user.nickname.charAt(0).toUpperCase()}
                </span>
                <div>
                  <b>{user.nickname}</b>
                  <span className="muted">{user.username}</span>
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
                  <button className="primary" type="submit" disabled={saving || nickname.trim() === user.nickname}>
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
                <b>{mask(user.username)}</b>
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
                  <label>{t(confirmReset ? 'profile.resetSure' : 'profile.resetTitle')}</label>
                  <p className="muted danger-note">
                    <span>{t(confirmReset ? 'profile.resetForever' : 'profile.resetHint')}</span>
                    <span className="danger-note-hold" aria-hidden>
                      {t('profile.resetHint')}
                    </span>
                  </p>
                </div>
                <div className="settings-actions">
                  {confirmReset ? (
                    <>
                      <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                        {t('profile.cancel')}
                      </button>
                      <button type="button" className="danger-button" onClick={reset} disabled={resetting}>
                        {resetting ? t('profile.resetting') : t('profile.resetYes')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ghost danger-ghost" onClick={() => setConfirmReset(true)}>
                      {t('profile.resetButton')}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {(tab === 'notifications' || tab === 'privacy') && (
            <section className="settings-block">
              <span className="settings-eyebrow">{t(tab === 'notifications' ? 'settings.notifications' : 'settings.privacy')}</span>
              <p className="muted">{t('settings.soon')}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
