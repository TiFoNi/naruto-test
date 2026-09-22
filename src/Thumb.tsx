import type { Entity, Game } from './games/types'

type Props = { game: Game; entity: Entity; size?: number; className?: string }

const percent = (index: number, count: number) => (count > 1 ? (index / (count - 1)) * 100 : 0)

export default function Thumb({ game, entity, size, className }: Props) {
  const { cols, rows } = game.atlas
  const col = entity.thumb % cols
  const row = Math.floor(entity.thumb / cols)
  return (
    <div
      role="img"
      aria-label={entity.name}
      className={`thumb ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${game.atlasUrl})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${percent(col, cols)}% ${percent(row, rows)}%`,
      }}
    />
  )
}
