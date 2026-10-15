'use client'

import { useState } from 'react'
import BackButton from './BackButton'
import { useI18n } from './i18n'
import { CoinIcon } from './icons'
import { useHref } from './router'

const PACKS = [
  { id: 'starter', usd: 1.99, base: 250, bonus: 50 },
  { id: 'basic', usd: 3.49, base: 500, bonus: 100 },
  { id: 'pro', usd: 5.99, base: 1000, bonus: 150 },
  { id: 'big', usd: 10.99, base: 2000, bonus: 300 },
  { id: 'huge', usd: 17.99, base: 3000, bonus: 500 },
  { id: 'max', usd: 29.9, base: 5000, bonus: 1000 },
] as const

const money = (usd: number) => `$${usd.toFixed(2)}`

export default function Support() {
  const { t, lang } = useI18n()
  const href = useHref()
  const [picked, setPicked] = useState<string>('pro')

  const locale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU'
  const nice = (count: number) => count.toLocaleString(locale)

  const pack = PACKS.find((one) => one.id === picked)
  const usd = pack?.usd ?? 0
  const base = pack?.base ?? 0
  const bonus = pack?.bonus ?? 0
  const ready = usd > 0

  return (
    <div className="support-page">
      <BackButton href={href.home}>{t('oops.home')}</BackButton>

      <header className="lb-head">
        <h1>{t('support.title')}</h1>
        <p className="muted">{t('support.lead')}</p>
      </header>

      <div className="support-body">
        <section className="support-packs" role="radiogroup" aria-label={t('support.packs')}>
          {PACKS.map((one) => (
            <button
              key={one.id}
              type="button"
              role="radio"
              aria-checked={picked === one.id}
              className={`support-pack ${picked === one.id ? 'active' : ''}`}
              data-size={one.id}
              onClick={() => setPicked(one.id)}
            >
              <span className="support-stack" aria-hidden>
                <CoinIcon />
                <CoinIcon />
                <CoinIcon />
              </span>
              <span className="support-amount">
                <b>{nice(one.base)}</b>
                <em>+{nice(one.bonus)}</em>
              </span>
              <span className="support-price">{money(one.usd)}</span>
            </button>
          ))}

        </section>

        <aside className="support-sum card">
          <span className="play-card-title">{t('support.youGet')}</span>

          <p className="support-total">
            <CoinIcon />
            <b>{nice(base + bonus)}</b>
            <small>{t('support.coins')}</small>
          </p>

          <dl className="support-bill">
            <div>
              <dt>{t('support.base')}</dt>
              <dd>{nice(base)}</dd>
            </div>
            {bonus > 0 && (
              <div className="is-bonus">
                <dt>{t('support.bonusLine')}</dt>
                <dd>+{nice(bonus)}</dd>
              </div>
            )}
            <div className="is-total">
              <dt>{t('support.total')}</dt>
              <dd>{ready ? money(usd) : '—'}</dd>
            </div>
          </dl>

          {bonus > 0 && <p className="support-extra">{t('support.alsoGet', { count: nice(bonus) })}</p>}

          <button type="button" className="primary support-go" disabled>
            {t('support.soon')}
          </button>

        </aside>
      </div>
    </div>
  )
}
