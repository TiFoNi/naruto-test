import { useEffect, useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

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

export default function ZoomImage({ game, src, zoom, resetKey }: { game: Game; src?: string; zoom: number; resetKey?: string }) {
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
          src={retry ? `${src}&retry=${retry}` : src}
          alt=""
          draggable={false}
          onLoad={(e) => setFocus(pickFocus(e.currentTarget))}
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
