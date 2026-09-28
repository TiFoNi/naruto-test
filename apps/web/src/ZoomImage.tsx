import { useEffect, useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const MAX_RETRIES = 3
const CENTRE = { x: 0.5, y: 0.5 }

export default function ZoomImage({
  game,
  src,
  step,
  zoom,
  focus,
  resetKey,
}: {
  game: Game
  src?: string
  step: number
  zoom: number
  focus?: { x: number; y: number }
  resetKey?: string
}) {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const url = src ? `${src}${src.includes('?') ? '&' : '?'}s=${step}${retry ? `&retry=${retry}` : ''}` : undefined
  const point = focus ?? CENTRE

  useEffect(() => {
    clearTimeout(timer.current)
    setReady(false)
    setRetry(0)
  }, [resetKey])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
      {url && !ready && <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>}
      {url && (
        <img
          key={retry}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setReady(true)
          }}
          src={url}
          crossOrigin="use-credentials"
          alt=""
          draggable={false}
          onLoad={() => setReady(true)}
          onError={() => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), 800)
          }}
          style={{
            opacity: ready ? 1 : 0,
            transform: `scale(${zoom})`,
            transformOrigin: `${point.x * 100}% ${point.y * 100}%`,
          }}
        />
      )}
    </div>
  )
}
