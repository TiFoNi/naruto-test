import atlas from './data/atlas.json'
import { atlasUrl, type Character } from './data'

type Props = { character: Character; size?: number; className?: string }

const percent = (index: number, count: number) => (count > 1 ? (index / (count - 1)) * 100 : 0)

export default function Thumb({ character, size, className }: Props) {
  const col = character.thumb % atlas.cols
  const row = Math.floor(character.thumb / atlas.cols)
  return (
    <div
      role="img"
      aria-label={character.name}
      className={`thumb ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlasUrl})`,
        backgroundSize: `${atlas.cols * 100}% ${atlas.rows * 100}%`,
        backgroundPosition: `${percent(col, atlas.cols)}% ${percent(row, atlas.rows)}%`,
      }}
    />
  )
}
