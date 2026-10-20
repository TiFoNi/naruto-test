'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { LEVEL_BIG, LEVEL_LAST, LEVEL_MID, levelCoins } from '@nanda/game'
import { api } from './api'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { CheckIcon } from './icons'
import { useHref } from './router'

const AHEAD = 20
const LEVEL_XP = 500

const sizeOf = (level: number) => (level % LEVEL_BIG === 0 ? 'big' : level % LEVEL_MID === 0 ? 'mid' : 'small')

// кольори рідкостей наших ачівок: бронза → срібло → золото → легенда → міф
const TONES = [
  [217, 138, 78],
  [201, 209, 220],
  [245, 196, 81],
  [167, 139, 250],
  [241, 71, 107],
] as const

const toneAt = (share: number) => {
  const spot = Math.min(Math.max(share, 0), 1) * (TONES.length - 1)
  const step = Math.min(Math.floor(spot), TONES.length - 2)
  const mix = spot - step
  const [from, to] = [TONES[step], TONES[step + 1]]
  const channel = (index: number) => Math.round(from[index] + (to[index] - from[index]) * mix)
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
}

export default function Levels() {
  const { t } = useI18n()
  const href = useHref()
  const { user, refresh } = useAuth()
  const level = user?.level ?? 1
  const into = (user?.xp ?? 0) % LEVEL_XP
  const share = Math.round((into / LEVEL_XP) * 100)
  const track = useRef<HTMLDivElement>(null)
  const road = useRef<HTMLOListElement>(null)
  const here = useRef<HTMLLIElement>(null)
  const [taken, setTaken] = useState<number[]>([])
  const [claiming, setClaiming] = useState(0)

  const last = Math.max(LEVEL_LAST, Math.ceil((level + AHEAD) / LEVEL_BIG) * LEVEL_BIG)
  const levels = Array.from({ length: last }, (_, index) => index + 1)

  const load = useCallback(async () => {
    const { ok, data } = await api<{ taken: number[] }>('levels')
    if (ok && Array.isArray(data.taken)) setTaken(data.taken)
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const take = async (one: number) => {
    setClaiming(one)
    const { ok, data } = await api<{ taken: number[]; award?: number }>('levels/claim', { level: one })
    setClaiming(0)
    if (!ok || !Array.isArray(data.taken)) return
    setTaken(data.taken)
    if (data.award) void refresh()
  }

  useEffect(() => {
    const node = here.current
    const box = track.current
    const line = road.current
    if (!node || !box || !line) return
    box.scrollLeft = Math.max(0, node.offsetLeft - box.clientWidth / 2 + node.clientWidth / 2)
    line.style.setProperty('--done', `${node.offsetLeft + node.offsetWidth / 2}px`)
    line.style.setProperty('--full', `${line.scrollWidth}px`)
  }, [level, last])

  return (
    <div className="levels">
      <div className="levels-top">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      </div>

      <section className="levels-hero">
        <span className="levels-ring" style={{ '--share': share } as CSSProperties} aria-hidden>
          <svg viewBox="0 0 120 120">
            <circle className="levels-ring-base" cx="60" cy="60" r="54" />
            <circle className="levels-ring-fill" cx="60" cy="60" r="54" strokeDasharray={`${(share / 100) * 339} 339`} />
          </svg>
          <b>{level}</b>
          <em>{share}%</em>
        </span>

        <div className="levels-hero-body">
          <h1>{t('nav.level', { level })}</h1>
          <p className="levels-total">{t('levels.toNext', { into, need: LEVEL_XP, level: level + 1 })}</p>

        </div>
      </section>

      <section className="levels-road-card">
        <header className="levels-road-head">
          <h2>{t('levels.rewards')}</h2>
        </header>

        <div className="levels-track" ref={track}>
          <ol className="levels-road" ref={road}>
            {levels.map((one) => {
              const state = one < level ? 'done' : one === level ? 'here' : 'locked'
              const prize = levelCoins(one)
              const got = taken.includes(one)
              const ready = prize > 0 && !got && one <= level && Boolean(user)
              return (
                <li
                  key={one}
                  className={`levels-step is-${sizeOf(one)} is-${state}`}
                  style={{ '--tone': toneAt((one - 1) / Math.max(1, last - 1)) } as CSSProperties}
                  ref={one === level ? here : undefined}
                >
                  <span className="levels-mark">
                    <b>{one}</b>
                  </span>
                  {state === 'here' && <em className="levels-here">{t('levels.here')}</em>}
                  {prize > 0 &&
                    (ready ? (
                      <button
                        type="button"
                        className="levels-slot is-ready"
                        disabled={claiming === one}
                        title={t('levels.take')}
                        onClick={() => take(one)}
                      >
                        <i className="levels-coin" style={{ backgroundImage: 'url(/shop/coins-big.webp)' }} aria-hidden />
                        <b>{prize}</b>
                        <em>{t('levels.take')}</em>
                      </button>
                    ) : (
                      <span className={`levels-slot ${got ? 'is-taken' : ''}`} title={got ? t('levels.taken') : t('levels.locked', { level: one })}>
                        <i className="levels-coin" style={{ backgroundImage: 'url(/shop/coins-big.webp)' }} aria-hidden />
                        <b>{prize}</b>
                        {got && (
                          <em className="levels-got" aria-label={t('levels.taken')}>
                            <CheckIcon />
                          </em>
                        )}
                      </span>
                    ))}
                </li>
              )
            })}
          </ol>
        </div>
      </section>
    </div>
  )
}
