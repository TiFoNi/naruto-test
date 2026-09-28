import { useEffect, useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const MAX_RETRIES = 3
const RETRY_GAP_MS = 800
const CENTRE = { x: 0.5, y: 0.5 }

type Shot = { url: string; zoom: number }

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
  const [shot, setShot] = useState<Shot | null>(null)
  const [retry, setRetry] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef<string | null>(null)
  const url = src ? `${src}${src.includes('?') ? '&' : '?'}s=${step}${retry ? `&retry=${retry}` : ''}` : undefined
  const point = focus ?? CENTRE

  useEffect(() => {
    if (held.current) URL.revokeObjectURL(held.current)
    held.current = null
    setShot(null)
    setRetry(0)
  }, [resetKey])

  useEffect(() => {
    if (!url) return
    let alive = true

    fetch(url, { credentials: url.startsWith('http') ? 'include' : 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('image'))))
      .then((blob) => {
        if (!alive) return
        const fresh = URL.createObjectURL(blob)
        if (held.current) URL.revokeObjectURL(held.current)
        held.current = fresh
        setShot({ url: fresh, zoom })
      })
      .catch(() => {
        if (!alive) return
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), RETRY_GAP_MS)
      })

    return () => {
      alive = false
    }
  }, [url, zoom])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (held.current) URL.revokeObjectURL(held.current)
    },
    [],
  )

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
      {src && !shot && <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>}
      {shot && (
        <img
          src={shot.url}
          alt=""
          draggable={false}
          style={{ transform: `scale(${shot.zoom})`, transformOrigin: `${point.x * 100}% ${point.y * 100}%` }}
        />
      )}
    </div>
  )
}
