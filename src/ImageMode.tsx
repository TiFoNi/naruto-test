import { useEffect, useMemo, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import Thumb from './Thumb'
import { fullUrl, pickAnswer, preload, type Character } from './data'
import type { Stats } from './storage'

const MAX_RETRIES = 3

const ZOOM_LEVELS = [7, 5.6, 4.5, 3.6, 2.9, 2.35, 1.9, 1.55, 1.25, 1]

type Focus = { x: number; y: number }

const SAMPLE = 48

function pickFocus(img: HTMLImageElement): Focus {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const fallback = { x: 25 + Math.random() * 50, y: 15 + Math.random() * 45 }
  if (!ctx) return fallback
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)
  const opaque: Focus[] = []
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      if (data[(y * SAMPLE + x) * 4 + 3] > 220) opaque.push({ x: ((x + 0.5) / SAMPLE) * 100, y: ((y + 0.5) / SAMPLE) * 100 })
    }
  }
  const inner = opaque.filter((p) => p.x > 15 && p.x < 85 && p.y > 8 && p.y < 60)
  const pool = inner.length ? inner : opaque
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : fallback
}

type Props = { onSolved: (guesses: number) => void; onGaveUp: () => void; stats: Stats }

export default function ImageMode({ onSolved, onGaveUp, stats }: Props) {
  const [answer, setAnswer] = useState(pickAnswer)
  const [upcoming, setUpcoming] = useState(pickAnswer)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [retry, setRetry] = useState(0)
  const [guesses, setGuesses] = useState<Character[]>([])
  const [gaveUp, setGaveUp] = useState(false)
  const [grayscale, setGrayscale] = useState(false)

  const won = guesses[0]?.id === answer.id
  const over = won || gaveUp
  const exclude = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses])
  const wrong = guesses.filter((g) => g.id !== answer.id).length
  const zoom = over ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]

  const guess = (c: Character) => {
    if (over) return
    const next = [c, ...guesses]
    setGuesses(next)
    if (c.id === answer.id) onSolved(next.length)
  }

  const nextRound = () => {
    setAnswer(upcoming)
    setUpcoming(pickAnswer())
    setFocus(null)
    setRetry(0)
    setGuesses([])
    setGaveUp(false)
  }

  useEffect(() => preload(upcoming), [upcoming])

  return (
    <section className="mode">
      <div className="panel intro">
        <h2>Кто на картинке?</h2>
        <p>С каждой неудачной попыткой картинка немного отдаляется.</p>
        <div className="zoom-frame">
          {!focus && <div className="zoom-loading">{retry > MAX_RETRIES ? 'Не удалось загрузить картинку' : 'Загрузка…'}</div>}
          <img
            key={`${answer.id}-${retry}`}
            src={retry ? `${fullUrl(answer)}?retry=${retry}` : fullUrl(answer)}
            alt=""
            draggable={false}
            onLoad={(e) => setFocus(pickFocus(e.currentTarget))}
            onError={() => setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), 800)}
            style={{
              opacity: focus ? 1 : 0,
              transform: `scale(${zoom})`,
              transformOrigin: focus ? `${focus.x}% ${focus.y}%` : 'center',
              filter: grayscale && !over ? 'grayscale(1)' : undefined,
            }}
          />
        </div>
        <div className="zoom-meta">
          <span className="muted">
            Раунд {stats.solved + (won ? 0 : 1)} · попыток: {guesses.length} · зум ×{zoom.toFixed(1)}
          </span>
          <label className="toggle">
            <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} />
            Чёрно-белое
          </label>
        </div>
      </div>

      {over ? (
        <RoundResult answer={answer} guesses={guesses.length} won={won} stats={stats} onNext={nextRound} />
      ) : (
        <>
          <CharacterSearch exclude={exclude} onPick={guess} />
          {guesses.length >= 3 && (
            <button
              className="link-button"
              onClick={() => {
                setGaveUp(true)
                onGaveUp()
              }}
            >
              Сдаюсь, покажи ответ
            </button>
          )}
        </>
      )}

      <div className="guess-list">
        {guesses.map((g) => (
          <div key={g.id} className={`guess-chip ${g.id === answer.id ? 'correct' : 'wrong'}`}>
            <Thumb character={g} size={44} />
            <span>{g.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
