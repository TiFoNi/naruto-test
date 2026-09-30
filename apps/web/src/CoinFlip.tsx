'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useI18n } from './i18n'

type Props = { first: string; second: string; youFirst: boolean; onDone: () => void }

const SPIN_MS = 2400
const HOLD_MS = 1100
const EDGES = 64

export default function CoinFlip({ first, second, youFirst, onDone }: Props) {
  const { t } = useI18n()
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leave = setTimeout(() => done.current(), (still ? 0 : SPIN_MS) + HOLD_MS)
    return () => clearTimeout(leave)
  }, [])

  return (
    <div className="coin-scene" role="presentation" onClick={onDone}>
      <div className="coin-pit">
        <span className="coin-shadow" />
        <div className="coin-stage">
          <div className="coin-tilt">
            <div className="coin">
              {Array.from({ length: EDGES }, (_, at) => (
                <span key={at} className="coin-edge" style={{ '--a': `${(360 / EDGES) * at}deg` } as CSSProperties} />
              ))}
              <span className="coin-face coin-front">{first}</span>
              <span className="coin-face coin-back">{second}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="coin-call">{youFirst ? t('who.youFirst') : t('who.first', { name: first })}</p>
    </div>
  )
}
