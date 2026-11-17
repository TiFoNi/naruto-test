'use client'

import type { CSSProperties } from 'react'

const TONGUES = 'M0 100 L0 72 Q6 48 12 64 Q17 34 26 58 Q31 22 40 52 Q46 8 55 46 Q61 20 68 54 Q74 30 81 60 Q88 38 93 64 Q97 50 100 68 L100 100 Z'

const TONGUES_BACK = 'M 100 100 L 100 72 Q 94 48 88 64 Q 83 34 74 58 Q 69 22 60 52 Q 54 8 45 46 Q 39 20 32 54 Q 26 30 19 60 Q 12 38 7 64 Q 3 50 0 68 L 0 100 Z'

const EDGE = 'M4 4 L96 4 L96 96 L4 96 Z'

const Embers = ({ count = 9 }: { count?: number }) => (
  <span className="ama-embers" aria-hidden>
    {Array.from({ length: count }, (_, i) => (
      <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i * 230) % 1400}ms`, '--s': `${0.6 + ((i * 7) % 5) / 6}` } as CSSProperties} />
    ))}
  </span>
)

const Defs = ({ id, freq, scale }: { id: string; freq: string; scale: number }) => (
  <defs>
    <filter id={`${id}-f`} x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed="7" result="noise">
        <animate attributeName="baseFrequency" dur="1.4s" values={`${freq};${freq.split(' ').map((one) => Number(one) * 1.35).join(' ')};${freq}`} repeatCount="indefinite" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <linearGradient id={`${id}-g`} x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stopColor="#000" />
      <stop offset="50%" stopColor="#0d0412" />
      <stop offset="80%" stopColor="#36104f" stopOpacity="0.85" />
      <stop offset="100%" stopColor="#7b2fb5" stopOpacity="0" />
    </linearGradient>
  </defs>
)

export const AmaterasuFx = ({ variant, lasting = false }: { variant: 'a' | 'b' | 'c' | 'd'; lasting?: boolean }) => {
  const id = `ama-${variant}-${lasting ? 'l' : 'i'}`
  if (variant === 'a')
    return (
      <span className={`ama ama-a ${lasting ? 'is-lasting' : ''}`} aria-hidden>
        <svg className="ama-defs" width="0" height="0">
          <filter id={`${id}-goo`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </svg>
        <span className="ama-fire" style={{ filter: `url(#${id}-goo)` }}>
          {Array.from({ length: 40 }, (_, i) => {
            const spread = ((i * 41) % 100) / 100
            const x = 50 + (spread - 0.5) * 80 * (0.5 + ((i * 7) % 5) / 10)
            return <i key={i} style={{ '--x': `${x}%`, '--d': `${-((i * 97) % 1100)}ms`, '--s': `${0.55 + ((i * 13) % 7) / 12}`, '--c': i % 4 === 0 ? '#4a1677' : '#06020a' } as CSSProperties} />
          })}
        </span>
        <Embers />
      </span>
    )
  if (variant === 'b')
    return (
      <span className={`ama ama-b ${lasting ? 'is-lasting' : ''}`} aria-hidden>
        <i className="ama-char" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs id={id} freq="0.05 0.05" scale={22} />
          <g filter={`url(#${id}-f)`}>
            <circle className="ama-blot" cx="50" cy="62" r="34" fill="#050208" />
            <circle className="ama-rim" cx="50" cy="62" r="34" fill="none" stroke="#6d28a8" strokeWidth="5" />
          </g>
        </svg>
        <Embers count={7} />
      </span>
    )
  if (variant === 'c')
    return (
      <span className={`ama ama-c ${lasting ? 'is-lasting' : ''}`} aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs id={id} freq="0.04 0.11" scale={14} />
          <g filter={`url(#${id}-f)`}>
            <path className="ama-edge-glow" d={EDGE} fill="none" stroke="#7b2fb5" strokeWidth="13" />
            <path className="ama-edge" d={EDGE} fill="none" stroke="#050208" strokeWidth="9" />
          </g>
        </svg>
        <Embers count={12} />
      </span>
    )
  return (
    <span className={`ama ama-d ${lasting ? 'is-lasting' : ''}`} aria-hidden>
      <span className="ama-smoke">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} style={{ '--x': `${15 + i * 17}%`, '--d': `${i * 320}ms` } as CSSProperties} />
        ))}
      </span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs id={id} freq="0.025 0.08" scale={20} />
        <g filter={`url(#${id}-f)`}>
          <path className="ama-tongues" d={TONGUES} fill={`url(#${id}-g)`} />
          <path className="ama-tongues is-back" d={TONGUES_BACK} fill="#1a0726" />
        </g>
      </svg>
      <Embers count={14} />
    </span>
  )
}
