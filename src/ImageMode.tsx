import { useEffect, useRef, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

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

type Props = { game: Game; active: boolean; stats: Stats }

export default function ImageMode({ game, active, stats }: Props) {
  const { t, name } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, busy, error, guess, giveUp, next, retry: retryRound } = useRound(game, 'image', active)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [retry, setRetry] = useState(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const wrong = guesses.length - (won ? 1 : 0)
  const zoom = over ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]

  useEffect(() => {
    clearTimeout(retryTimer.current)
    setFocus(null)
    setRetry(0)
  }, [round?.id])

  useEffect(() => () => clearTimeout(retryTimer.current), [])

  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.imageTitle')}</h2>
        <p className="muted">{t('play.imagePrompt')}</p>
        <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
          {round?.image && !focus && (
            <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>
          )}
          {round?.image && (
            <img
              key={`${round.id}-${retry}`}
              src={retry ? `${round.image}&retry=${retry}` : round.image}
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
        {round && (
          <p className="round">
            {t('play.round', { round: round.number, guesses: guesses.length })} · {t('play.zoom', { zoom: zoom.toFixed(1) })}
          </p>
        )}
      </div>

      <RoundStatus loading={!round && !error} error={error} onRetry={retryRound} />

      {round && over && answer ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} skipped={skipped} stats={stats} onNext={next} />
      ) : round ? (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} />
          <button className="link-button" onClick={giveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        </>
      ) : null}

      <div className="guess-list">
        {guesses.map(({ entity: g }) => (
          <div key={g.id} className={`guess-chip ${won && g.id === answer?.id ? 'correct' : 'wrong'}`}>
            <Thumb game={game} entity={g} size={44} />
            <span>{name(g)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
