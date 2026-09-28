import { useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const CENTRE = { x: 0.5, y: 0.5 }

export default function ZoomImage({
  game,
  shot,
  zoom,
  focus,
}: {
  game: Game
  shot?: string
  zoom: number
  focus?: { x: number; y: number }
}) {
  const { t } = useI18n()
  const frame = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<'wide' | 'tall'>('wide')
  const point = focus ?? CENTRE

  const measure = (image: HTMLImageElement) => {
    const box = frame.current
    if (!box || !image.naturalWidth || !image.naturalHeight) return
    setFit(image.naturalWidth / image.naturalHeight >= box.clientWidth / box.clientHeight ? 'wide' : 'tall')
  }

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`} ref={frame}>
      {!shot && <div className="zoom-loading">{t('image.loading')}</div>}
      {shot && (
        <img
          src={shot}
          className={`fit-${fit}`}
          alt=""
          draggable={false}
          ref={(el) => {
            if (el) measure(el)
          }}
          onLoad={(event) => measure(event.currentTarget)}
          style={{ transform: `scale(${zoom})`, transformOrigin: `${point.x * 100}% ${point.y * 100}%` }}
        />
      )}
    </div>
  )
}
