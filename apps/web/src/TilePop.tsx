'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = { at: HTMLElement | null; onClose: () => void; wide?: number; children: ReactNode }

type Spot = { left: number; width: number; maxHeight: number; top?: number; bottom?: number }

const GAP = 10
const EDGE = 12
const WIDE = 460
const ROOMY = 220
const SHORT = 180
const TALL = 420

const measure = (at: HTMLElement, most: number): Spot | null => {
  const box = at.getBoundingClientRect()
  if (!at.isConnected || box.bottom < 0 || box.top > window.innerHeight) return null
  const width = Math.min(most, window.innerWidth - EDGE * 2)
  const mid = box.left + box.width / 2 - width / 2
  const last = window.innerWidth - width - EDGE
  const left =
    mid >= EDGE && mid <= last
      ? mid
      : mid < EDGE
        ? Math.max(EDGE, Math.min(box.left, last))
        : Math.max(EDGE, Math.min(box.right - width, last))
  const room = window.innerHeight - box.bottom - GAP - EDGE
  const above = box.top - GAP - EDGE
  const under = room >= ROOMY || room >= above
  const maxHeight = Math.max(SHORT, Math.min(TALL, under ? room : above))
  return under
    ? { left, width, maxHeight, top: box.bottom + GAP }
    : { left, width, maxHeight, bottom: window.innerHeight - box.top + GAP }
}

export default function TilePop({ at, onClose, wide = WIDE, children }: Props) {
  const [spot, setSpot] = useState<Spot | null>(null)
  const frame = useRef(0)

  const place = useCallback(() => {
    if (!at) return
    const next = measure(at, wide)
    if (next) setSpot(next)
    else onClose()
  }, [at, onClose, wide])

  useLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    if (!at) return
    const follow = () => {
      if (frame.current) return
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        place()
      })
    }
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [at, place, onClose])

  if (!at || !spot) return null

  return createPortal(
    <div
      className="tile-sheet"
      role="presentation"
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClose}
    >
      <div
        className="modes-pop"
        role="dialog"
        style={spot as CSSProperties}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
