import type { CSSProperties } from 'react'
import type { GameId } from './games/types'
import { uiUrl } from './pics'

type Props = { game: GameId; className: string; style?: CSSProperties }

export default function WorldMark({ game, className, style }: Props) {
  return (
    <span className={`${className} has-logo`} style={style} aria-hidden>
      <img src={uiUrl(`worlds/${game}.webp`)} alt="" width={64} height={64} loading="lazy" decoding="async" draggable={false} />
    </span>
  )
}
