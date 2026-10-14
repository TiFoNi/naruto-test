'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useI18n } from './i18n'
import { ChevronIcon } from './icons'

type Props = {
  children: ReactNode
  trackClass: string
  className?: string
  innerRef?: RefObject<HTMLDivElement | null>
}

export default function Rail({ children, trackClass, className = '', innerRef }: Props) {
  const { t } = useI18n()
  const track = useRef<HTMLDivElement>(null)
  const [ends, setEnds] = useState({ left: false, right: false })

  const sync = useCallback(() => {
    const node = track.current
    if (!node) return
    setEnds({ left: node.scrollLeft > 4, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const node = track.current
    if (!node) return
    sync()
    node.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    if (typeof ResizeObserver === 'undefined') return () => {
      node.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
    const watcher = new ResizeObserver(sync)
    watcher.observe(node)
    return () => {
      node.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      watcher.disconnect()
    }
  }, [sync])

  const slide = (way: number) => track.current?.scrollBy({ left: way * Math.max(160, track.current.clientWidth * 0.7), behavior: 'smooth' })

  return (
    <div className={`rail ${className} ${ends.left ? 'has-left' : ''} ${ends.right ? 'has-right' : ''}`}>
      <button type="button" className="rail-arrow left" aria-label={t('ach.scrollPrev')} onClick={() => slide(-1)}>
        <ChevronIcon />
      </button>
      <div
        className={`rail-track ${trackClass}`}
        ref={(node) => {
          track.current = node
          if (innerRef) innerRef.current = node
        }}
      >
        {children}
      </div>
      <button type="button" className="rail-arrow right" aria-label={t('ach.scrollNext')} onClick={() => slide(1)}>
        <ChevronIcon />
      </button>
    </div>
  )
}
