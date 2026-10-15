'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from './i18n'
import { already, onPhone, useInstall } from './install'
import { CloseIcon } from './icons'

const KEY = 'nanda:install'
const QUIET_DAYS = 30
const DELAY_MS = 6000

const kept = () => {
  try {
    const seen = Number(window.localStorage.getItem(KEY) ?? 0)
    return seen > 0 && Date.now() - seen < QUIET_DAYS * 86_400_000
  } catch {
    return false
  }
}

const remember = () => {
  try {
    window.localStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
}

export default function InstallBanner() {
  const { t } = useI18n()
  const { ready, ios, safari, mac, installed, run } = useInstall()
  const [show, setShow] = useState(false)

  const hide = useCallback(() => {
    setShow(false)
    remember()
  }, [])

  useEffect(() => {
    if (!onPhone() || already() || kept()) return

    const timer = window.setTimeout(() => setShow(true), DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!show || installed) return null

  return (
    <aside className="install-bar" role="dialog" aria-label={t('install.title')}>
      <span className="install-copy">
        <b>{t('install.title')}</b>
        <small>{ready ? t('install.text') : ios ? t(safari ? 'install.ios' : 'install.iosOther') : mac ? t('install.mac') : t('install.hint')}</small>
      </span>

      {ready && (
        <button
          type="button"
          className="primary install-go"
          onClick={() => {
            void run().then(hide)
          }}
        >
          {t('install.go')}
        </button>
      )}

      <button type="button" className="install-x" onClick={hide} aria-label={t('profile.close')}>
        <CloseIcon />
      </button>
    </aside>
  )
}
