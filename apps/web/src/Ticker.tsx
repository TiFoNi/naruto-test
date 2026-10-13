'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export default function Ticker({ className, children }: { className?: string; children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const node = box.current
    const line = node?.firstElementChild
    if (!node || !line) return

    const measure = () => setShift(Math.max(0, Math.ceil(line.getBoundingClientRect().width - node.clientWidth)))

    measure()
    void document.fonts?.ready.then(measure)
    const watcher = new ResizeObserver(measure)
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [children])

  return (
    <span
      ref={box}
      className={`ticker ${shift > 2 ? 'is-live' : ''} ${className ?? ''}`}
      style={{ '--shift': `${shift}px`, '--ticker-time': `${(6 + shift / 26).toFixed(1)}s` } as CSSProperties}
    >
      <span>{children}</span>
    </span>
  )
}
