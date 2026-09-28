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
  const point = focus ?? CENTRE

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
      {!shot && <div className="zoom-loading">{t('image.loading')}</div>}
      {shot && (
        <img
          src={shot}
          alt=""
          draggable={false}
          style={{ transform: `scale(${zoom})`, transformOrigin: `${point.x * 100}% ${point.y * 100}%` }}
        />
      )}
    </div>
  )
}
