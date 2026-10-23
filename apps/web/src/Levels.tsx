'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { LEVEL_BIG, LEVEL_LAST, LEVEL_MID, levelAt, levelCoins, levelTotal } from '@nanda/game'
import { api } from './api'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { useHref } from './router'

const AHEAD = 20
const STEP = 20
const BEFORE = 2
const AFTER = 5

// кольори рідкостей наших ачівок: бронза, срібло, золото, легенда, міф + секретний на фіналі
const TIERS = ['#d98a4e', '#c9d1dc', '#f5c451', '#a78bfa', '#ef3f4e'] as const
const NAMES = ['bronze', 'silver', 'gold', 'legend', 'mythic'] as const
const SECRET = '#6ec06e'

const spotOf = (level: number, last: number) => ((level - 1) / (last - 1)) * (TIERS.length - 1)

const toneOf = (level: number, last: number) => {
  if (level >= last) return SECRET
  const spot = spotOf(level, last)
  const step = Math.min(Math.floor(spot), TIERS.length - 2)
  const mix = Math.round((spot - step) * 100)
  return mix === 0 ? TIERS[step]! : `color-mix(in oklch, ${TIERS[step]}, ${TIERS[step + 1]} ${mix}%)`
}

const tierOf = (level: number, last: number) =>
  level >= last ? 'secret' : NAMES[Math.min(Math.round(spotOf(level, last)), NAMES.length - 1)]!

export default function Levels() {
  const { t } = useI18n()
  const href = useHref()
  const { user, refresh } = useAuth()
  const level = levelAt(user?.xp ?? 0).level
  const [taken, setTaken] = useState<number[]>([])
  const [known, setKnown] = useState(false)
  const [claiming, setClaiming] = useState(0)
  const [older, setOlder] = useState(0)
  const [newer, setNewer] = useState(0)

  const last = Math.max(LEVEL_LAST, Math.ceil((level + AHEAD) / LEVEL_BIG) * LEVEL_BIG)
  const marks = Array.from({ length: Math.floor(last / LEVEL_MID) }, (_, index) => (index + 1) * LEVEL_MID)
  const next = marks.find((one) => one > level) ?? marks[marks.length - 1]!
  const place = marks.indexOf(next)

  const from = Math.max(0, place - BEFORE - older * STEP)
  const till = Math.min(marks.length, place + AFTER + newer * STEP)
  const shown = marks.slice(from, till)
  const rest = marks.length - till

  const load = useCallback(async () => {
    const { ok, data } = await api<{ taken: number[] }>('levels')
    if (ok && Array.isArray(data.taken)) setTaken(data.taken)
    setKnown(true)
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const pending = known ? marks.filter((one) => levelCoins(one) > 0 && one <= level && !taken.includes(one)) : []

  const takeAll = async () => {
    if (!pending.length || claiming) return
    setClaiming(-1)
    const { ok, data } = await api<{ taken: number[]; award?: number }>('levels/claim', { all: true })
    setClaiming(0)
    if (!ok || !Array.isArray(data.taken)) return
    setTaken(data.taken)
    if (data.award) void refresh()
  }

  const take = async (one: number) => {
    setClaiming(one)
    const { ok, data } = await api<{ taken: number[]; award?: number }>('levels/claim', { level: one })
    setClaiming(0)
    if (!ok || !Array.isArray(data.taken)) return
    setTaken(data.taken)
    if (data.award) void refresh()
  }

  return (
    <div className="levels">
      <div className="levels-top">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      </div>

      <div className="levels-split">
        <section className="levels-list-card">
          {user && pending.length > 0 && (
            <button type="button" className="levels-take-all" disabled={claiming !== 0} onClick={() => void takeAll()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {t('levels.takeAll')}
            </button>
          )}

          {from > 0 && (
            <button type="button" className="levels-more" onClick={() => setOlder((one) => one + 1)}>
              {t('levels.earlier')}
            </button>
          )}

          <ol className="levels-list">
            {shown.map((one) => {
              const prize = levelCoins(one)
              const got = taken.includes(one)
              const reached = one <= level
              const ready = known && !got && reached && Boolean(user)
              const left = levelTotal(one) - (user?.xp ?? 0)
              const spot = marks.indexOf(one)
              const base = spot > 0 ? levelTotal(marks[spot - 1]!) : 0
              const span = Math.max(1, levelTotal(one) - base)
              const fill = reached ? 100 : Math.max(0, Math.min(100, Math.round((((user?.xp ?? 0) - base) / span) * 100)))
              return (
                <li
                  key={one}
                  className={`rung ${reached ? 'is-done' : ''} ${ready ? 'is-ready' : ''} ${got ? 'is-got' : ''}`}
                  style={{ '--tone': toneOf(one, last), '--fill': fill } as CSSProperties}
                >
                  <span className="rung-rail" aria-hidden>
                    <i />
                  </span>

                  <div className="rung-card">
                    <b className="rung-num">{one}</b>
                    <i className="rung-coin" style={{ backgroundImage: 'url(/shop/coins-big.webp)' }} aria-hidden />

                    <div className="rung-what">
                      <b>{t('levels.coins', { count: prize })}</b>
                      <span>{t(`achTier.${tierOf(one, last)}` as UiKey)}</span>
                    </div>

                    {ready ? (
                      <button type="button" className="rung-take" disabled={claiming === one} onClick={() => void take(one)}>
                        {t('levels.take')}
                      </button>
                    ) : got ? (
                      <span className="rung-got">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {t('levels.gotIt')}
                      </span>
                    ) : !reached ? (
                      <span className="rung-wait">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="4" y="11" width="16" height="9" rx="2" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                        {t('levels.away', { xp: left })}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>

          {rest > 0 && (
            <button type="button" className="levels-more" onClick={() => setNewer((one) => one + 1)}>
              {t('levels.more', { count: rest })}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
