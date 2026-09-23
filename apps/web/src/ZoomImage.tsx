import { useEffect, useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const MAX_RETRIES = 3
const SAMPLE = 48

type Focus = { x: number; y: number }

function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickFocus(img: HTMLImageElement, seed?: string): Focus {
  const random = seed ? seeded(seed) : Math.random
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const fallback = { x: 25 + random() * 50, y: 15 + random() * 45 }
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
  return pool.length ? pool[Math.floor(random() * pool.length)] : fallback
}

export default function ZoomImage({
  game,
  src,
  zoom,
  resetKey,
  seed,
}: {
  game: Game
  src?: string
  zoom: number
  resetKey?: string
  seed?: string
}) {
  const { t } = useI18n()
  const [focus, setFocus] = useState<Focus | null>(null)
  const [retry, setRetry] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    setFocus(null)
    setRetry(0)
  }, [resetKey])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
      {src && !focus && <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>}
      {src && (
        <img
          key={`${src}-${retry}`}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setFocus((f) => f ?? pickFocus(el, seed))
          }}
          src={retry ? `${src}&retry=${retry}` : src}
          alt=""
          draggable={false}
          onLoad={(e) => setFocus(pickFocus(e.currentTarget, seed))}
          onError={() => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), 800)
          }}
          style={{
            opacity: focus ? 1 : 0,
            transform: `scale(${zoom})`,
            transformOrigin: focus ? `${focus.x}% ${focus.y}%` : 'center',
          }}
        />
      )}
    </div>
  )
}
