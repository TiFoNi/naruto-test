'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export default function Ticker({ className, play = 0, children }: { className?: string; play?: number; children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!play) return
    const node = box.current
    const line = node?.firstElementChild
    if (!node || !line) return
    const gap = Math.max(0, Math.ceil(line.getBoundingClientRect().width - node.clientWidth))
    if (gap <= 2) return
    setShift(gap)
    setCycle((one) => one + 1)
    setRunning(true)
  }, [play])

  return (
    <span
      ref={box}
      className={`ticker ${running ? 'is-live' : ''} ${className ?? ''}`}
      style={{ '--shift': `${shift}px`, '--ticker-time': `${(2.6 + shift / 70).toFixed(1)}s` } as CSSProperties}
    >
      <span key={cycle} onAnimationEnd={() => setRunning(false)}>
        {children}
      </span>
    </span>
  )
}
