import type { Entity, Game } from './games/types'
import { useState } from 'react'
import { atlasUrl, fullUrl, miniUrl } from './pics'
import { useI18n } from './i18n'

type Props = { game: Game; entity: Entity; size?: number; className?: string; sharp?: boolean }

const percent = (index: number, count: number) => (count > 1 ? (index / (count - 1)) * 100 : 0)

export default function Thumb({ game, entity, size, className, sharp = false }: Props) {
  const { name } = useI18n()
  const [broken, setBroken] = useState(false)
  const { cols, rows } = game.atlas
  const tile = entity.thumb >= 0

  if (sharp && entity.image && !broken) {
    return (
      <img
        src={fullUrl(game.id, entity.id, entity.image)}
        alt={name(entity)}
        className={`thumb thumb-pic ${className ?? ''}`}
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBroken(true)}
      />
    )
  }

  if (!tile && entity.image) {
    return (
      <img
        src={miniUrl(game.id, entity.id, entity.image)}
        alt={name(entity)}
        className={`thumb thumb-pic ${className ?? ''}`}
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    )
  }

  if (!tile) {
    return (
      <div role="img" aria-label={name(entity)} className={`thumb thumb-blank ${className ?? ''}`} style={{ width: size, height: size }}>
        {name(entity).slice(0, 1)}
      </div>
    )
  }

  const own = {
    backgroundImage: `url(${atlasUrl(game.id, game.atlas.version)})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${percent(entity.thumb % cols, cols)}% ${percent(Math.floor(entity.thumb / cols), rows)}%`,
  }

  return (
    <div role="img" aria-label={name(entity)} className={`thumb ${className ?? ''}`} style={{ width: size, height: size, ...own }} />
  )
}
