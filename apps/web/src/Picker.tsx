import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronIcon } from './icons'

export type Option = { value: string; label: ReactNode; accent?: string }

type Props = { label: string; value: string; options: Option[]; onChange: (value: string) => void }

export default function Picker({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState({ up: false, max: 320 })
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, options, value])

  useLayoutEffect(() => {
    if (!open) return
    const fit = () => {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const up = below < 200 && above > below
      setPlace({ up, max: Math.max(140, Math.min(320, up ? above : below)) })
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', fit, { passive: true })
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', fit)
    }
  }, [open])

  const pick = (option: Option) => {
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div className={`picker ${open ? 'open' : ''} ${place.up ? 'up' : ''}`} ref={root}>
      <span className="picker-label">{label}</span>
      <button
        type="button"
        className="picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ '--tab-accent': current?.accent ?? 'var(--accent)' } as CSSProperties}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) return setOpen(true)
            setActive((a) => Math.min(options.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (open) {
              e.preventDefault()
              pick(options[active])
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      >
        {current?.accent && <span className="dot" />}
        <span className="picker-value">{current?.label}</span>
        <ChevronIcon className="picker-caret" />
      </button>
      {open && (
        <ul className="picker-list" role="listbox" style={{ maxHeight: place.max }}>
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`${option.value === value ? 'selected' : ''} ${i === active ? 'active' : ''}`}
              style={{ '--tab-accent': option.accent ?? 'var(--accent)' } as CSSProperties}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(option)
              }}
            >
              {option.accent && <span className="dot" />}
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
