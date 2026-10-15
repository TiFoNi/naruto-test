'use client'

import { useState } from 'react'
import BackButton from './BackButton'
import { useI18n } from './i18n'
import { CoinIcon, GlobeIcon, GridIcon, ShieldIcon } from './icons'
import { useHref } from './router'

const PACKS = [
  { id: 'small', usd: 1.99, base: 250, bonus: 50, art: 'coins-small' },
  { id: 'mid', usd: 5.99, base: 1000, bonus: 150, art: 'coins-mid' },
  { id: 'big', usd: 17.99, base: 3000, bonus: 500, art: 'coins-big' },
] as const

const WHERE = [
  { key: 'support.where1', name: 'support.where1name', Icon: GlobeIcon },
  { key: 'support.where2', name: 'support.where2name', Icon: GridIcon },
  { key: 'support.where3', name: 'support.where3name', Icon: ShieldIcon },
] as const

const money = (usd: number) => `$${usd.toFixed(2)}`

export default function Support() {
  const { t, lang } = useI18n()
  const href = useHref()
  const [picked, setPicked] = useState<string>('mid')

  const locale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU'
  const nice = (count: number) => count.toLocaleString(locale)
  const pack = PACKS.find((one) => one.id === picked) ?? PACKS[1]

  return (
    <div className="support-page">
      <BackButton href={href.home}>{t('oops.home')}</BackButton>

      <header className="support-head">
        <h1>{t('support.title')}</h1>
        <p>{t('support.lead')}</p>
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
              onClick={() => setPicked(one.id)}
            >
              <img className="support-art" src={`/shop/${one.art}.webp`} alt="" width={512} height={512} loading="lazy" decoding="async" draggable={false} />

              <span className="support-amount">
                <CoinIcon />
                <b>{nice(one.base)}</b>
                <em className="support-bonus">{t('support.bonusChip', { count: nice(one.bonus) })}</em>
              </span>
              <span className="support-price">{money(one.usd)}</span>
            </button>
          ))}
        </section>

        <aside className="support-sum">
          <span className="play-card-title">{t('support.youGet')}</span>

          <p className="support-total">
            <b>{nice(pack.base + pack.bonus)}</b>
            <small>{t('support.coins')}</small>
          </p>

          <dl className="support-bill">
            <div>
              <dt>{t('support.base')}</dt>
              <dd>{nice(pack.base)}</dd>
            </div>
            <div className="is-bonus">
              <dt>{t('support.bonusLine')}</dt>
              <dd>+{nice(pack.bonus)}</dd>
            </div>
            <div className="is-total">
              <dt>{t('support.total')}</dt>
              <dd>{money(pack.usd)}</dd>
            </div>
          </dl>

          <button type="button" className="primary support-buy" disabled>
            {t('support.soon')}
          </button>
        </aside>
      </div>

      <section className="support-where">
        <span className="play-card-title">{t('support.whereTitle')}</span>
        <ul>
          {WHERE.map(({ key, name, Icon }) => (
            <li key={key}>
              <b>
                <Icon />
                {t(name)}
              </b>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
