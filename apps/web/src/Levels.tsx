'use client'

import { useEffect, useRef } from 'react'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { useHref } from './router'

const AHEAD = 20
const TAIL = 50
const BIG = 10
const MID = 5

const sizeOf = (level: number) => (level % BIG === 0 ? 'big' : level % MID === 0 ? 'mid' : 'small')

export default function Levels() {
  const { t } = useI18n()
  const href = useHref()
  const { user } = useAuth()
  const level = user?.level ?? 1
  const need = 500
  const into = (user?.xp ?? 0) % need
  const track = useRef<HTMLDivElement>(null)
  const here = useRef<HTMLLIElement>(null)

  const last = Math.max(TAIL, Math.ceil((level + AHEAD) / BIG) * BIG)
  const levels = Array.from({ length: last }, (_, index) => index + 1)

  useEffect(() => {
    const node = here.current
    const box = track.current
    if (!node || !box) return
    box.scrollLeft = Math.max(0, node.offsetLeft - box.clientWidth / 2 + node.clientWidth / 2)
  }, [level])

  return (
    <div className="levels">
      <header className="levels-head">
        <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
        <h1>{t('levels.title')}</h1>
        <p className="muted">{t('levels.lead')}</p>
      </header>

      <div className="levels-now">
        <div className="levels-now-line">
          <b>{t('nav.level', { level })}</b>
          <span>
            {into} / {need} XP
          </span>
        </div>
        <div className="levels-now-bar">
          <i style={{ width: `${Math.round((into / need) * 100)}%` }} />
        </div>
      </div>

      <div className="levels-track" ref={track}>
        <ol className="levels-road">
          {levels.map((one) => {
            const state = one < level ? 'done' : one === level ? 'here' : 'locked'
            return (
              <li key={one} className={`levels-step is-${sizeOf(one)} is-${state}`} ref={one === level ? here : undefined}>
                <span className="levels-mark">
                  <b>{one}</b>
                </span>
                <span className="levels-slot" aria-hidden />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
