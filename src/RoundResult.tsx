import { useEffect, useRef } from 'react'
import Countdown from './Countdown'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { href } from './router'
import type { Stats } from './stats'
import { TrophyIcon } from './icons'
import { fullUrl } from './pics'

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
}

export default function RoundResult({ game, mode, answer, guesses, won, skipped, stats, onNext, challenge, nextAt }: Props) {
  const { t, name, alt } = useI18n()
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

  const summary = challenge
    ? t('challenge.summary', { guesses })
    : skipped
    ? t('result.notCounted')
    : daily
      ? t('daily.summary', { guesses, streak: stats.streak, best: stats.best })
      : t('result.summary', { guesses, streak: stats.streak, best: stats.best })

  return (
    <div ref={ref} className={`card result ${won ? 'won' : skipped ? 'skipped' : 'lost'}`}>
      <h2>{t(won ? 'result.won' : skipped ? 'result.skipped' : 'result.lost')}</h2>
      <img className="result-image" src={fullUrl(game.id, answer.id)} alt={name(answer)} />
      <div className="result-name">{name(answer)}</div>
      {alt(answer) && <div className="result-name-en">{alt(answer)}</div>}
      <p className="round">{summary}</p>
      {daily ? (
        <>
          <p className="daily-next">
            {t('daily.nextIn')} <Countdown until={nextAt} onDone={onNext} />
          </p>
          <div className="result-actions">
            <a className="primary" href={href.play(game.id, mode)}>
              {t('daily.playEndless')}
            </a>
            <a className="ghost" href={href.leaderboard(game.id, mode, true)}>
              <TrophyIcon /> {t('daily.todayBoard')}
            </a>
          </div>
        </>
      ) : (
        challenge ? (
          <div className="result-actions">
            <a className="primary" href={href.play(game.id, mode)}>
              {t('challenge.answerBack')}
            </a>
            <a className="ghost" href={href.home}>
              {t('play.back')}
            </a>
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
