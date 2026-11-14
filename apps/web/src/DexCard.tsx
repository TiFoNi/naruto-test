'use client'

import { memo, useCallback, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { cardRank } from '@nanda/game'
import type { GameId } from './games/types'
import { cardUrl } from './pics'
import { torn, tornPoints } from './torn'

export const lengthOf = (label: string) => (label.length > 26 ? 'is-longer' : label.length > 16 ? 'is-long' : '')

export const BACK_POINTS = tornPoints(24, 5)
  .map(([x, y]) => `${(x * 3).toFixed(1)},${(y * 4).toFixed(1)}`)
  .join(' ')

export const BACK_CLIP = torn(24, 5)

export const HALO_PX = [0, 0, 5, 6.5, 8, 10.5, 12]

export const UNIT = 2.4

export const SHEET_POINTS = tornPoints(31, 2.5, 8)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

export const BADGE_POINTS = tornPoints(7, 9, 5)
  .map(([x, y]) => `${(x * 1.3).toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

export const BACK_TURN = 7

export const CardGlow = ({ seed, tier, turn }: { seed: number; tier?: number; turn: number }) => {
  const id = useId()
  const paper = tornPoints(seed, 4)
    .map(([x, y]) => `${(x * 3).toFixed(1)},${(y * 4).toFixed(1)}`)
    .join(' ')
  const halo = (tier ? HALO_PX[tier]! : 0) * UNIT
  const drop = 6 * UNIT
  const shapes = (
    <>
      {tier && tier > 1 && <polygon points={BACK_POINTS} transform={`rotate(${turn} 150 200) translate(12 8)`} />}
      <polygon points={paper} />
    </>
  )
  return (
    <svg className="card-glow" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
      <defs>
        <filter id={`${id}halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={halo / 2} />
        </filter>
        <filter id={`${id}shade`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={4 * UNIT} />
        </filter>
      </defs>
      {halo > 0 && (
        <g className="card-glow-halo" filter={`url(#${id}halo)`}>
          {shapes}
          <g transform={`translate(0 ${drop})`} opacity={0.55}>
            {shapes}
          </g>
        </g>
      )}
      <g className="card-glow-shade" filter={`url(#${id}shade)`} transform={`translate(0 ${drop})`}>
        {shapes}
      </g>
    </svg>
  )
}

export const DexImg = ({ src }: { src: string }) => {
  const [shown, setShown] = useState(false)
  const check = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth) setShown(true)
  }, [])
  return <img ref={check} className={shown ? 'is-in' : ''} src={src} alt="" loading="lazy" decoding="async" draggable={false} onLoad={() => setShown(true)} />
}

export const PicEdge = ({ seed }: { seed: number }) => {
  const points = tornPoints(seed, 3, 7)
    .map(([x, y]) => `${(x * 2.58).toFixed(1)},${(y * 2.88).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="dex-pic-edge" viewBox="0 0 258 288" preserveAspectRatio="none" aria-hidden>
      <polygon points={points} className="is-soft" />
      <polygon points={points} />
    </svg>
  )
}

export const BackSheet = ({ turn = BACK_TURN }: { turn?: number }) => {
  const id = useId()
  const points = BACK_POINTS
  return (
    <i className="lv-back" style={{ '--turn': `${turn}deg` } as CSSProperties}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id={id} cx="50%" cy="0%" r="110%">
            <stop offset="0%" className="lv-back-top" />
            <stop offset="78%" className="lv-back-bottom" />
          </radialGradient>
          <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={3 * UNIT} />
          </filter>
        </defs>
        <polygon className="lv-back-glow" points={points} filter={`url(#${id}glow)`} />
        <polygon points={points} fill={`url(#${id})`} />
      </svg>
      <i className="lv-back-light" style={{ clipPath: BACK_CLIP }} />
    </i>
  )
}

export const StatBadge = ({ kind, value }: { kind: 'atk' | 'hp'; value: number }) => (
  <span className={`lv-badge is-${kind}`} aria-hidden>
    <svg viewBox="0 0 130 100" preserveAspectRatio="none">
      <polygon points={BADGE_POINTS} />
    </svg>
    <b>{value}</b>
  </span>
)

export function DexFace({
  game,
  id,
  image,
  label,
  tier,
  className = '',
  children,
}: {
  game: GameId
  id: number
  image?: string
  label: string
  tier: number
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`dex-scrap ${tier ? `lv-${tier + 1}` : ''} ${className}`.trim()}>
      {tier > 0 && <CardGlow seed={id} tier={tier + 1} turn={BACK_TURN} />}
      {tier > 0 && <BackSheet />}
      <i className="dex-paper" style={{ clipPath: torn(id, 4) }} />
      <span className="dex-pic" style={{ clipPath: torn(id * 3 + 1, 3, 7) }}>
        <DexImg src={cardUrl(game, id, image)} />
        <PicEdge seed={id * 3 + 1} />
      </span>
      <b className={lengthOf(label)}>
        <span>{label}</span>
      </b>
      {children}
    </span>
  )
}

export const ShowcaseCard = memo(function ShowcaseCard({
  game,
  id,
  image,
  label,
  xp,
  level,
}: {
  game: GameId
  id: number
  image?: string
  label: string
  xp: number
  level?: number
}) {
  const rank = cardRank(xp)
  const tier = level === 0 ? 0 : rank.tier
  return (
    <DexFace game={game} id={id} image={image} label={label} tier={tier} className={level === 0 ? 'is-closed' : ''}>
      <span className="lv-badge" aria-hidden>
        <svg viewBox="0 0 130 100" preserveAspectRatio="none">
          <polygon points={BADGE_POINTS} />
        </svg>
        <b>{level ?? rank.level}</b>
      </span>
    </DexFace>
  )
})
