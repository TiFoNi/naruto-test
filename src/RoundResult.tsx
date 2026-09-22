import { useEffect, useRef } from 'react'
import type { Entity, Game } from './games/types'
import type { Stats } from './storage'

type Props = { game: Game; answer: Entity; guesses: number; won: boolean; stats: Stats; onNext: () => void }

export default function RoundResult({ game, answer, guesses, won, stats, onNext }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && ref.current?.offsetParent) onNext()
    }
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onNext])

  const subtitle = game.subtitle(answer)

  return (
    <div ref={ref} className={`panel result ${won ? 'won' : 'lost'}`}>
      <h2>{won ? 'Угадал!' : 'Не в этот раз'}</h2>
      <img className="result-image" src={game.fullUrl(answer)} alt={answer.name} />
      <div className="result-name">{answer.name}</div>
      {subtitle && <div className="result-name-en">{subtitle}</div>}
      <p>
        Попыток: {guesses} · Серия: {stats.streak} · Рекорд: {stats.best}
      </p>
      <button className="primary" onClick={onNext}>
        Следующий ➜
      </button>
    </div>
  )
}
