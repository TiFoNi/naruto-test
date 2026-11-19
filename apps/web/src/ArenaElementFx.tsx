'use client'

const TOMOE = 'M0 -30 a9 9 0 1 1 0.1 0 q-14 6 -12 20'

export const IzanagiFx = () => (
  <span className="iza" aria-hidden>
    <span className="iza-ghost" />
    <svg className="iza-eye" viewBox="-50 -50 100 100">
      <circle r="46" fill="#b0050f" stroke="#1a0003" strokeWidth="4" />
      <circle r="27" fill="none" stroke="#3a0006" strokeWidth="2" opacity="0.7" />
      <g className="iza-tomoe">
        {[0, 120, 240].map((turn) => (
          <path key={turn} d={TOMOE} transform={`rotate(${turn})`} fill="#120002" />
        ))}
      </g>
      <circle r="9" fill="#120002" />
      <clipPath id="iza-clip">
        <circle r="48" />
      </clipPath>
      <g clipPath="url(#iza-clip)">
        <path className="iza-lid is-top" d="M-52 -104 L52 -104 L52 0 Q0 -14 -52 0 Z" fill="#0b0b10" />
        <path className="iza-lid is-bottom" d="M-52 104 L52 104 L52 0 Q0 14 -52 0 Z" fill="#0b0b10" />
      </g>
    </svg>
    <span className="iza-flash" />
  </span>
)
