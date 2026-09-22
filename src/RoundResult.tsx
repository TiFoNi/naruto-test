import { useEffect, useRef } from 'react'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'

type Props = { game: Game; answer: Entity; guesses: number; won: boolean; stats: Stats; onNext: () => void }

export default function RoundResult({ game, answer, guesses, won, stats, onNext }: Props) {
  const { t, name, alt } = useI18n()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat && ref.current?.offsetParent) onNext()
    }
    const timer = setTimeout(() => window.addEventListener('keydown', onKey), 300)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onNext])

  return (
    <div ref={ref} className={`card result ${won ? 'won' : 'lost'}`}>
      <h2>{t(won ? 'result.won' : 'result.lost')}</h2>
      <img className="result-image" src={game.fullUrl(answer)} alt={name(answer)} />
      <div className="result-name">{name(answer)}</div>
      {alt(answer) && <div className="result-name-en">{alt(answer)}</div>}
      <p className="round">{t('result.summary', { guesses, streak: stats.streak, best: stats.best })}</p>
      <button className="primary" onClick={onNext}>
        {t('result.next')}
      </button>
    </div>
  )
}
