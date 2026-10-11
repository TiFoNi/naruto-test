'use client'

import { useState } from 'react'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { CoinIcon, LockIcon, PaletteIcon, PictureIcon, SparkIcon } from './icons'
import { useHref } from './router'

const TABS = [
  { id: 'frames', label: 'shop.frames', icon: <PaletteIcon /> },
  { id: 'avatars', label: 'shop.avatars', icon: <PictureIcon /> },
  { id: 'other', label: 'shop.other', icon: <SparkIcon /> },
] as const

export default function Shop() {
  const { t } = useI18n()
  const href = useHref()
  const { user } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('frames')

  return (
    <div className="shop-page">
      <header className="lb-head">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
        <h1>{t('shop.title')}</h1>
        <p className="muted">{t('shop.lead')}</p>
      </header>

      <div className="shop-purse">
        <span className="shop-purse-mark" aria-hidden>
          <CoinIcon />
        </span>
        <span className="shop-purse-text">
          <em>{t('shop.purse')}</em>
          <b>{user?.coins ?? 0}</b>
        </span>
      </div>

      <div className="shop-body">
        <aside className="shop-tabs" role="tablist" aria-label={t('shop.title')}>
          {TABS.map((one) => (
            <button key={one.id} type="button" role="tab" aria-selected={tab === one.id} className={tab === one.id ? 'active' : ''} onClick={() => setTab(one.id)}>
              {one.icon}
              {t(one.label as UiKey)}
            </button>
          ))}
        </aside>

        <section className="shop-empty">
          <span className="shop-empty-mark" aria-hidden>
            <LockIcon />
          </span>
          <b>{t('shop.soon')}</b>
          <p className="muted">{t('shop.soonHint')}</p>
        </section>
      </div>
    </div>
  )
}
