import { useId, type CSSProperties } from 'react'

const mix = (with_: string): CSSProperties => ({ stopColor: `color-mix(in oklch, var(--gem, var(--accent)), ${with_})` })

const fill = (with_: string): CSSProperties => ({ fill: `color-mix(in oklch, var(--gem, var(--accent)), ${with_})` })

type Place = { x: number; y: number; s: number; r?: number; back?: boolean }

const PLACES: Record<1 | 2 | 3, Place[]> = {
  1: [{ x: 0, y: 0, s: 1 }],
  2: [
    { x: -18, y: -12, s: 0.6, r: -16, back: true },
    { x: 10, y: 8, s: 0.78 },
  ],
  3: [
    { x: -24, y: -8, s: 0.52, r: -18, back: true },
    { x: 24, y: -8, s: 0.52, r: 18, back: true },
    { x: 0, y: 10, s: 0.7 },
  ],
}

const OUTLINE = '26,22 74,22 94,42 50,92 6,42'

function Stone({ id, x, y, s, r = 0, back = false, lifted = false }: Place & { id: string; lifted?: boolean }) {
  return (
    <g transform={`translate(${50 + x} ${50 + y}) rotate(${r}) scale(${s}) translate(-50 -50)`}>
      {lifted && <polygon points={OUTLINE} fill="#000000" opacity="0.35" stroke="#000000" strokeWidth="7" strokeLinejoin="round" />}
      <polygon points={OUTLINE} fill={`url(#${id}-d)`} />
      <polygon points="26,22 38,22 30,42 6,42" fill={`url(#${id}-t)`} />
      <polygon points="38,22 62,22 70,42 30,42" fill={`url(#${id}-l)`} />
      <polygon points="62,22 74,22 94,42 70,42" fill={`url(#${id}-m)`} />
      <polygon points="6,42 30,42 50,92" fill={`url(#${id}-m)`} />
      <polygon points="30,42 70,42 50,92" fill={`url(#${id}-l)`} />
      <polygon points="70,42 94,42 50,92" fill={`url(#${id}-d)`} />
      <path d="M40 27 H52 L47 36 Z" fill="#ffffff" opacity="0.85" />
      {back && <polygon points={OUTLINE} fill="#000000" opacity="0.16" />}
    </g>
  )
}

export default function GemIcon({
  className,
  count = 1,
  sparkles = true,
  style,
}: {
  className?: string
  count?: 1 | 2 | 3
  sparkles?: boolean
  style?: CSSProperties
}) {
  const id = `gem${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg viewBox="0 0 100 100" width="1em" height="1em" className={`gem ${className ?? ''}`} style={style} aria-hidden>
      <defs>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={mix('white 70%')} />
          <stop offset="1" style={mix('white 0%')} />
        </linearGradient>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={mix('white 30%')} />
          <stop offset="1" style={mix('black 30%')} />
        </linearGradient>
        <linearGradient id={`${id}-d`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={mix('black 30%')} />
          <stop offset="1" style={mix('black 55%')} />
        </linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={mix('white 70%')} />
          <stop offset="1" style={mix('white 30%')} />
        </linearGradient>
      </defs>
      {PLACES[count].map((place, index) => (
        <Stone key={index} id={id} {...place} lifted={count > 1 && !place.back} />
      ))}
      {sparkles && (
        <>
          <path d="M84 4 L86 10 L92 12 L86 14 L84 20 L82 14 L76 12 L82 10 Z" style={fill('white 90%')} />
          <path d="M10 62 L11 65 L14 66 L11 67 L10 70 L9 67 L6 66 L9 65 Z" style={fill('white 90%')} opacity="0.8" />
        </>
      )}
    </svg>
  )
}
