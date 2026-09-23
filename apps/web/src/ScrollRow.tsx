import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from './i18n'

type Props = { className: string; label: string; children: ReactNode; activeKey?: string }

export default function ScrollRow({ className, label, children, activeKey }: Props) {
  const { t } = useI18n()
  const row = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = row.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = row.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [measure])

  useEffect(() => {
    const active = row.current?.querySelector<HTMLElement>('.active')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeKey])

  const scroll = (direction: 1 | -1) => {
    const el = row.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`scroll-row ${edges.left ? 'can-left' : ''} ${edges.right ? 'can-right' : ''}`}>
      <button type="button" className="scroll-arrow left" aria-label={t('nav.scrollLeft')} tabIndex={-1} onClick={() => scroll(-1)}>
        ‹
      </button>
      <nav ref={row} className={className} aria-label={label}>
        {children}
      </nav>
      <button type="button" className="scroll-arrow right" aria-label={t('nav.scrollRight')} tabIndex={-1} onClick={() => scroll(1)}>
        ›
      </button>
    </div>
  )
}
