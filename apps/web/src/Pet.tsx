export type PetStage = 'cub' | 'teen' | 'adult'

const STAGES: Record<PetStage, { tails: number; spread: number; scale: number; headR: number; bodyRx: number; bodyRy: number; eye: number; aura: number; tailLen: number }> = {
  cub: { tails: 1, spread: 0, scale: 0.74, headR: 26, bodyRx: 30, bodyRy: 26, eye: 5.2, aura: 0, tailLen: 0.82 },
  teen: { tails: 3, spread: 22, scale: 0.88, headR: 25, bodyRx: 35, bodyRy: 28, eye: 4.4, aura: 0.16, tailLen: 0.95 },
  adult: { tails: 9, spread: 12, scale: 0.94, headR: 24, bodyRx: 39, bodyRy: 30, eye: 3.6, aura: 0.32, tailLen: 1.1 },
}

const tailPath = (len: number) => {
  const l = 64 * len
  return `M 0 10 C ${l * 0.42} 2 ${l * 0.72} -${l * 0.3} ${l * 0.82} -${l * 0.86} C ${l * 0.92} -${l * 0.3} ${l * 0.6} ${l * 0.06} 8 22 Z`
}

const tipPath = (len: number) => {
  const l = 64 * len
  return `M ${l * 0.82} -${l * 0.86} C ${l * 0.86} -${l * 0.6} ${l * 0.78} -${l * 0.44} ${l * 0.66} -${l * 0.34} C ${l * 0.8} -${l * 0.52} ${l * 0.84} -${l * 0.7} ${l * 0.82} -${l * 0.86} Z`
}

export default function Pet({ stage, className }: { stage: PetStage; className?: string }) {
  const s = STAGES[stage]
  const r = s.headR
  const eyeX = r * 0.4
  const eyeY = -r * 0.1
  const eyeRy = s.eye * (stage === 'cub' ? 1.2 : 0.85)
  const ear = r * 0.95
  const start = -((s.tails - 1) / 2) * s.spread

  return (
    <svg className={className} viewBox="0 0 250 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id={`petAura-${stage}`} cx="50%" cy="52%" r="52%">
          <stop offset="0" stopColor="#ff8a1f" stopOpacity={s.aura} />
          <stop offset="1" stopColor="#ff8a1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`petFur-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffab52" />
          <stop offset="1" stopColor="#df5f1a" />
        </linearGradient>
        <linearGradient id={`petPaw-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#df5f1a" />
          <stop offset="1" stopColor="#ad3d0e" />
        </linearGradient>
        <linearGradient id={`petTail-${stage}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#df5f1a" />
          <stop offset="1" stopColor="#ffbb6b" />
        </linearGradient>
      </defs>

      <circle cx="118" cy="108" r="104" fill={`url(#petAura-${stage})`} />

      <g transform={`translate(92 140) scale(${s.scale})`}>
        <g transform="translate(26 -14)">
          {Array.from({ length: s.tails }, (_, i) => (
            <g key={i} transform={`rotate(${(start + i * s.spread - 48).toFixed(1)})`}>
              <path d={tailPath(s.tailLen)} fill={`url(#petTail-${stage})`} />
              <path d={tipPath(s.tailLen)} fill="#f8e6cb" opacity=".9" />
            </g>
          ))}
        </g>

        <ellipse cx="0" cy="0" rx={s.bodyRx} ry={s.bodyRy} fill={`url(#petFur-${stage})`} />
        <ellipse cx="-6" cy={s.bodyRy * 0.3} rx={s.bodyRx * 0.58} ry={s.bodyRy * 0.55} fill="#f8e6cb" opacity=".6" />
        <ellipse cx="-16" cy={s.bodyRy * 0.92} rx="11" ry="7.5" fill={`url(#petPaw-${stage})`} />
        <ellipse cx="16" cy={s.bodyRy * 0.95} rx="11" ry="7.5" fill={`url(#petPaw-${stage})`} />

        <g transform={`translate(-26 -${r + 6})`}>
          <path d={`M -${r * 0.72} -${r * 0.52} L -${r * 0.86} -${r * 0.52 + ear} L -${r * 0.1} -${r * 0.86} Z`} fill={`url(#petFur-${stage})`} />
          <path d={`M -${r * 0.66} -${r * 0.58} L -${r * 0.76} -${r * 0.5 + ear * 0.72} L -${r * 0.22} -${r * 0.82} Z`} fill="#3a1a08" opacity=".45" />
          <path d={`M ${r * 0.72} -${r * 0.52} L ${r * 0.86} -${r * 0.52 + ear} L ${r * 0.1} -${r * 0.86} Z`} fill={`url(#petFur-${stage})`} />
          <path d={`M ${r * 0.66} -${r * 0.58} L ${r * 0.76} -${r * 0.5 + ear * 0.72} L ${r * 0.22} -${r * 0.82} Z`} fill="#3a1a08" opacity=".45" />
          <circle cx="0" cy="0" r={r} fill={`url(#petFur-${stage})`} />
          <path
            d={`M 0 ${r * 0.06} q -${r * 0.7} ${r * 0.16} -${r * 0.5} ${r * 0.62} q ${r * 0.5} ${r * 0.34} ${r} 0 q ${r * 0.2} -${r * 0.46} -${r * 0.5} -${r * 0.62} Z`}
            fill="#f8e6cb"
            opacity=".95"
          />
          <ellipse cx={-eyeX} cy={eyeY} rx={s.eye} ry={eyeRy} fill="#20120a" />
          <ellipse cx={eyeX} cy={eyeY} rx={s.eye} ry={eyeRy} fill="#20120a" />
          <circle cx={-eyeX + s.eye * 0.3} cy={eyeY - s.eye * 0.35} r={s.eye * 0.32} fill="#fff" opacity=".92" />
          <circle cx={eyeX + s.eye * 0.3} cy={eyeY - s.eye * 0.35} r={s.eye * 0.32} fill="#fff" opacity=".92" />
          {stage === 'adult' && (
            <>
              <path d={`M -${eyeX + s.eye + 2} ${eyeY - s.eye - 3} l ${s.eye * 2 + 4} ${s.eye * 0.9}`} stroke="#3a1a08" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              <path d={`M ${eyeX + s.eye + 2} ${eyeY - s.eye - 3} l -${s.eye * 2 + 4} ${s.eye * 0.9}`} stroke="#3a1a08" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            </>
          )}
          <path d={`M -3.4 ${r * 0.3} h 6.8 l -3.4 4.2 Z`} fill="#20120a" />
        </g>
      </g>
    </svg>
  )
}
