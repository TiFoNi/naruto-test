'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { COIN_PACKS, type PayCoin } from '@nanda/game'

type CoinRow = PayCoin & { least?: number | null }

type PackRow = { id: string; charge: number; fee: number }
import { api } from './api'
import { useAuth } from './auth'
import BackButton from './BackButton'
import { useI18n } from './i18n'
import { CoinIcon, GlobeIcon, GridIcon, ShieldIcon } from './icons'
import { useHref } from './router'

const PACKS = COIN_PACKS

const WAIT_STEPS = 20
const WAIT_MS = 3000

const WHERE = [
  { key: 'support.where1', name: 'support.where1name', Icon: GlobeIcon },
  { key: 'support.where2', name: 'support.where2name', Icon: GridIcon },
  { key: 'support.where3', name: 'support.where3name', Icon: ShieldIcon },
] as const

const money = (usd: number) => `$${usd.toFixed(2)}`

export default function Support() {
  const { t, lang } = useI18n()
  const href = useHref()
  const router = useRouter()
  const { user, refresh } = useAuth()
  const [picked, setPicked] = useState<string>('mid')
  const [coins, setCoins] = useState<CoinRow[]>([])
  const [coin, setCoin] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<'credited' | 'waiting' | 'partial' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [least, setLeast] = useState<number | null>(null)
  const [floor, setFloor] = useState<number | null>(null)
  const [charges, setCharges] = useState<Record<string, PackRow>>({})

  const watch = useCallback(
    async (order: string, stopped: () => boolean) => {
      for (let step = 0; step < WAIT_STEPS; step++) {
        const { ok, data } = await api<{ status?: string }>(`shop?order=${encodeURIComponent(order)}`)
        if (stopped()) return
        if (ok && data.status === 'paid') {
          setNote('credited')
          void refresh()
          window.history.replaceState(null, '', window.location.pathname)
          return
        }
        if (ok && data.status === 'partial') return setNote('partial')
        if (ok && (data.status === 'failed' || data.status === 'refunded')) return setNote(null)
        await new Promise((done) => setTimeout(done, WAIT_MS))
        if (stopped()) return
      }
      setNote('waiting')
    },
    [refresh],
  )

  useEffect(() => {
    let gone = false
    api<{ coins?: CoinRow[]; least?: number | null; packs?: PackRow[] }>('shop').then(({ ok, data }) => {
      if (gone || !ok) return
      if (data.packs?.length) setCharges(Object.fromEntries(data.packs.map((one) => [one.id, one])))
      if (data.coins?.length) {
        setCoins(data.coins)
        setCoin((now) => now || data.coins![0].id)
      }
      if (typeof data.least === 'number') {
        setFloor(data.least)
        setPicked((now) => {
          const held = PACKS.find((one) => one.id === now)
          return held && held.usd >= data.least! ? now : (PACKS.find((one) => one.usd >= data.least!) ?? PACKS[PACKS.length - 1]).id
        })
      }
    })
    return () => {
      gone = true
    }
  }, [])

  useEffect(() => {
    const wake = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      setBusy(false)
      if (new URLSearchParams(window.location.search).get('paid')) return
      setNote(null)
      setError(null)
    }

    window.addEventListener('pageshow', wake)
    return () => window.removeEventListener('pageshow', wake)
  }, [])

  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get('paid')
    if (!order) return

    let gone = false
    setNote('waiting')
    void watch(order, () => gone)
    return () => {
      gone = true
    }
  }, [watch])

  const buy = async () => {
    if (!user) return router.push(href.login)

    setBusy(true)
    setError(null)
    setLeast(null)
    const { ok, data } = await api<{
      url?: string
      error?: string
      least?: number
    }>('shop/checkout', paying ? { pack: picked, coin: paying } : { pack: picked })
    if (ok && data.url) {
      window.location.href = data.url
      return
    }

    setBusy(false)
    if (data.error === 'coin_min') {
      setLeast(data.least ?? null)
      setError('min')
      return
    }
    setError(data.error === 'payments_off' ? 'off' : 'failed')
  }

  const locale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU'
  const nice = (count: number) => count.toLocaleString(locale)
  const pack = PACKS.find((one) => one.id === picked) ?? PACKS[1]
  const short = (one: (typeof PACKS)[number]) => floor !== null && (charges[one.id]?.charge ?? one.usd) < floor
  const bill = charges[pack.id]
  const barred = (one: CoinRow) => typeof one.least === 'number' && (bill?.charge ?? pack.usd) < one.least
  const fine = coins.find((one) => !barred(one))
  const chosen = coins.find((one) => one.id === coin)
  const paying = !chosen ? '' : barred(chosen) ? (fine?.id ?? '') : chosen.id

  return (
    <div className="support-page">
      <BackButton href={href.home}>{t('oops.home')}</BackButton>

      <header className="support-head">
        <h1>{t('support.title')}</h1>
        <p>{t('support.lead')}</p>
      </header>

      <div className="support-body">
        <div className="support-left">
          <section className="support-packs" role="radiogroup" aria-label={t('support.packs')}>
            {PACKS.map((one) => (
              <button
                key={one.id}
                type="button"
                role="radio"
                aria-checked={picked === one.id}
                className={`support-pack ${picked === one.id ? 'active' : ''} ${short(one) ? 'is-shut' : ''}`}
                onClick={() => {
                  setPicked(one.id)
                  setError(null)
                }}
              >
                <img
                  className="support-art"
                  style={{ '--grow': one.grow } as React.CSSProperties}
                  src={`/shop/${one.art}.webp`}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />

                <span className="support-amount">
                  <CoinIcon />
                  <b>{nice(one.base)}</b>
                  <em className="support-bonus">{t('support.bonusChip', { count: nice(one.bonus) })}</em>
                </span>
                <span className="support-price">{short(one) ? t('support.soonShort') : money(one.usd)}</span>
              </button>
            ))}
          </section>

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
            <div>
              <dt>{t('support.price')}</dt>
              <dd>{money(pack.usd)}</dd>
            </div>
            {bill && bill.fee > 0 && (
              <div className="is-fee">
                <dt>{t('support.netFee')}</dt>
                <dd>+{money(bill.fee)}</dd>
              </div>
            )}
            <div className="is-total">
              <dt>{t('support.total')}</dt>
              <dd>{money(bill?.charge ?? pack.usd)}</dd>
            </div>
          </dl>

          <div className="pay-ways">
            <span className="play-card-title">{t('support.howPay')}</span>

            <div className="pay-way is-live">
              <i aria-hidden>
                <CoinIcon />
              </i>
              <span>
                <b>{t('support.wayCrypto')}</b>
                <small>{coins.map((one) => one.label).join(' · ') || 'USDT · TRX · LTC'}</small>
              </span>
            </div>

            {coins.length > 0 && (
              <div className="pay-coins" role="radiogroup" aria-label={t('support.coinPick')}>
                {coins.map((one) => (
                  <button
                    key={one.id}
                    type="button"
                    role="radio"
                    aria-checked={paying === one.id}
                    disabled={barred(one)}
                    className={`pay-coin ${paying === one.id ? 'active' : ''} ${barred(one) ? 'is-barred' : ''}`}
                    onClick={() => {
                      setCoin(one.id)
                      setError(null)
                    }}
                  >
                    <b>{one.label}</b>
                    <small>{barred(one) ? t('support.coinFrom', { least: `$${(Math.ceil((one.least ?? 0) * 100) / 100).toFixed(2)}` }) : one.note}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="primary support-buy" onClick={buy} disabled={busy || short(pack)}>
            {busy ? t('support.going') : short(pack) ? t('support.soonShort') : user ? t('support.buy') : t('support.buyLogin')}
          </button>

          {short(pack) && <p className="support-flash">{t('support.cryptoFrom', { least: `$${(floor ?? 0).toFixed(2)}` })}</p>}

          {note && (
            <p className={`support-flash ${note === 'credited' ? 'is-done' : ''} ${note === 'partial' ? 'is-bad' : ''}`}>
              {t(note === 'credited' ? 'support.credited' : note === 'partial' ? 'support.partial' : 'support.pending')}
            </p>
          )}
          {error && (
            <p className="support-flash is-bad">
              {error === 'min' ? t('support.coinMin', { least: `$${(least ?? 0).toFixed(2)}` }) : t(error === 'off' ? 'support.soon' : 'support.failed')}
            </p>
          )}

          <ul className="support-memo">
            <li>{t('support.memoAmount')}</li>
            <li>{t('support.memoNet')}</li>
            <li>{t('support.memoWait')}</li>
          </ul>

          <p className="support-fine">
            {t('support.agree')} <Link href={href.terms}>{t('footer.terms')}</Link>
            {' · '}
            <Link href={href.refunds}>{t('footer.refunds')}</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
