import { useEffect, useRef } from 'react'
import { fullUrl, type Character } from './data'
import type { Stats } from './storage'

type Props = { answer: Character; guesses: number; won: boolean; stats: Stats; onNext: () => void }

export default function RoundResult({ answer, guesses, won, stats, onNext }: Props) {
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

  return (
    <div ref={ref} className={`panel result ${won ? 'won' : 'lost'}`}>
      <h2>{won ? 'Угадал!' : 'Не в этот раз'}</h2>
      <img className="result-image" src={fullUrl(answer)} alt={answer.name} />
      <div className="result-name">{answer.name}</div>
      <div className="result-name-en">{answer.nameEn}</div>
      <p>
        Попыток: {guesses} · Серия: {stats.streak} · Рекорд: {stats.best}
      </p>
      <button className="primary" onClick={onNext}>
        Следующий персонаж ➜
      </button>
    </div>
  )
}
