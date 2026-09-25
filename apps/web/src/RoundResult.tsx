import Link from 'next/link'
import { useEffect, useRef } from 'react'
import Countdown from './Countdown'
import type { Entity, Game } from './games/types'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { useHref } from './router'
import type { Stats } from './stats'
import { fullUrl } from './pics'
import { MODES, type ModeId } from './modes'

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

type Props = {
  game: Game
  mode: ModeId
  answer: Entity
  guesses: number
  won: boolean
  skipped: boolean
  stats: Stats
  onNext: () => void
  challenge?: string
  nextAt?: number
  compact?: boolean
}

export default function RoundResult({ game, mode, answer, guesses, won, skipped, stats, onNext, challenge, nextAt, compact }: Props) {
  const { t, name, alt, lang } = useI18n()
  const { user } = useAuth()
  const href = useHref()
  const ref = useRef<HTMLDivElement>(null)
  const daily = nextAt !== undefined && !challenge

  useEffect(() => {
    if (daily) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat && ref.current?.offsetParent) onNext()
    }
    const timer = setTimeout(() => window.addEventListener('keydown', onKey), 300)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onNext, daily])

  const note = challenge ? t('challenge.summary', { guesses }) : skipped ? t('result.notCounted') : ''
  const verdict: UiKey = won ? 'result.won' : skipped ? 'result.skipped' : 'result.lost'
  const modeLabel = MODES.find((m) => m.id === mode)?.label
  const day = daily ? new Date().toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long' }) : ''
  const eyebrow = [t(verdict), modeLabel ? t(modeLabel) : '', day].filter(Boolean).join(' · ')

  const facts = [
    { key: 'tries', value: guesses, label: t('result.factTries') },
    { key: 'streak', value: daily ? (user?.streak ?? 0) : stats.streak, label: t(daily ? 'result.factDays' : 'result.factStreak'), hot: true },
    { key: 'best', value: daily ? (user?.bestStreak ?? 0) : stats.best, label: t(daily ? 'result.factBestDays' : 'result.factBest') },
  ]

  return (
    <div ref={ref} className={`card result ${won ? 'won' : skipped ? 'skipped' : 'lost'}`}>
      <span className="result-eyebrow">{eyebrow}</span>
      {!compact && <img className="result-image" src={fullUrl(game.id, answer.id, answer.image)} alt={name(answer)} />}
      <div className="result-name">{name(answer)}</div>
      {alt(answer) && <div className="result-name-en">{alt(answer)}</div>}
      <div className="result-facts">
        {facts.map((fact) => (
          <div key={fact.key} className={fact.hot ? 'hot' : ''}>
            <b>{fact.value}</b>
            <span>{fact.label}</span>
          </div>
        ))}
      </div>
      {note && <p className="round">{note}</p>}
      {daily ? (
        <>
          <p className="daily-next">
            {t('daily.nextIn')} <Countdown until={nextAt} onDone={onNext} />
          </p>
          <Link className="primary" href={href.play(game.id, mode)}>
            {t('daily.playEndless')}
          </Link>
        </>
      ) : (
        challenge ? (
          <div className="result-actions">
            <Link className="ghost" href={href.home}>
              {t('play.back')}
            </Link>
          </div>
        ) : (
          <button className="primary" onClick={onNext}>
            {t('result.next')}
          </button>
        )
      )}
    </div>
  )
}
