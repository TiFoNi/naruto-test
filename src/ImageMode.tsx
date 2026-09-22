import { useEffect, useRef, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { pickAnswer, preload } from './util'

const ZOOM_LEVELS = [7, 5.6, 4.5, 3.6, 2.9, 2.35, 1.9, 1.55, 1.25, 1]
const MAX_RETRIES = 3
const SAMPLE = 48

type Focus = { x: number; y: number }

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

type Props = { game: Game; active: boolean; onSolved: (guesses: number) => void; onGaveUp: () => void; stats: Stats }

export default function ImageMode({ game, active, onSolved, onGaveUp, stats }: Props) {
  const { t, name } = useI18n()
  const { answer, guesses, won, over, round, exclude, guess, giveUp, next } = useRound({ game, mode: 'image', onSolved, onGaveUp })
  const [upcoming, setUpcoming] = useState<Entity | null>(null)
  const [seen, setSeen] = useState(active)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [retry, setRetry] = useState(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const wrong = guesses.filter((g) => g.id !== answer.id).length
  const zoom = over ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]

  useEffect(() => {
    if (!active) return
    setSeen(true)
    setUpcoming((u) => u ?? pickAnswer(game))
  }, [active, game])

  useEffect(() => {
    if (active && upcoming) preload(game, upcoming)
  }, [active, game, upcoming])

  useEffect(() => () => clearTimeout(retryTimer.current), [])

  const nextRound = () => {
    clearTimeout(retryTimer.current)
    next(upcoming ?? undefined)
    setUpcoming(pickAnswer(game))
    setFocus(null)
    setRetry(0)
  }

  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.imageTitle')}</h2>
        <p className="muted">{t('play.imagePrompt')}</p>
        <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
          {seen && !focus && <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>}
          {seen && (
          <img
            key={`${answer.id}-${retry}`}
            src={retry ? `${game.fullUrl(answer)}?retry=${retry}` : game.fullUrl(answer)}
            alt=""
            draggable={false}
            onLoad={(e) => setFocus(pickFocus(e.currentTarget))}
            onError={() => {
              clearTimeout(retryTimer.current)
              retryTimer.current = setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), 800)
            }}
            style={{
              opacity: focus ? 1 : 0,
              transform: `scale(${zoom})`,
              transformOrigin: focus ? `${focus.x}% ${focus.y}%` : 'center',
            }}
          />
          )}
        </div>
        <p className="round">
          {t('play.round', { round, guesses: guesses.length })} · {t('play.zoom', { zoom: zoom.toFixed(1) })}
        </p>
      </div>

      {over ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} stats={stats} onNext={nextRound} />
      ) : (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} onPick={guess} />
          {guesses.length >= 3 && (
            <button className="link-button" onClick={giveUp}>
              {t('play.giveUp')}
            </button>
          )}
        </>
      )}

      <div className="guess-list">
        {guesses.map((g) => (
          <div key={g.id} className={`guess-chip ${g.id === answer.id ? 'correct' : 'wrong'}`}>
            <Thumb game={game} entity={g} size={44} />
            <span>{name(g)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
