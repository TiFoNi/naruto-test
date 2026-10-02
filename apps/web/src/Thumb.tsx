import type { Entity, Game } from './games/types'
import { atlasUrl } from './pics'
import { useI18n } from './i18n'

type Props = { game: Game; entity: Entity; size?: number; className?: string }

const percent = (index: number, count: number) => (count > 1 ? (index / (count - 1)) * 100 : 0)

export default function Thumb({ game, entity, size, className }: Props) {
  const { name } = useI18n()
  const { cols, rows } = game.atlas
  const tile = entity.thumb >= 0

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
