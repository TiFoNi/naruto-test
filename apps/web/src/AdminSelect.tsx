'use client'

import { useEffect, useRef, useState } from 'react'

type Choice<T extends string> = { value: T; label: string }

export default function AdminSelect<T extends string>({
  value,
  choices,
  onPick,
  className,
}: {
  value: T
  choices: Choice<T>[]
  onPick: (value: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', keys)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', keys)
    }
  }, [open])

  return (
    <div className={`dropdown ${className ?? ''}`} ref={box}>
      <button type="button" className={`dropdown-head ${open ? 'open' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{choices.find((one) => one.value === value)?.label ?? '—'}</span>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu">
          <ul>
            {choices.map((choice) => (
              <li key={choice.value}>
                <button
                  type="button"
                  className={choice.value === value ? 'on' : ''}
                  onClick={() => {
                    if (choice.value !== value) onPick(choice.value)
                    setOpen(false)
                  }}
                >
                  {choice.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
