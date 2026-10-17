import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronIcon, SearchIcon } from './icons'
import { useI18n } from './i18n'
import { normalize } from './util'

export type Option = { value: string; label: ReactNode; accent?: string; media?: ReactNode; hint?: string; search?: string }

const FIND_FROM = 7

const textOf = (option: Option) => option.search ?? (typeof option.label === 'string' ? option.label : '')

type Props = { label: string; value: string; options: Option[]; onChange: (value: string) => void; rich?: boolean; disabled?: boolean }

export default function Picker({ label, value, options, onChange, rich = false, disabled = false }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const [place, setPlace] = useState({ up: false, max: 320 })
  const root = useRef<HTMLDivElement>(null)
  const find = useRef<HTMLInputElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]
  const searchable = options.length >= FIND_FROM

  const shown = useMemo(() => {
    const want = normalize(query.trim())
    if (!want || !searchable) return options
    return options.filter((one) => normalize(textOf(one)).includes(want))
  }, [options, query, searchable])

  const seats = useRef({ options, value, searchable })
  seats.current = { options, value, searchable }

  useEffect(() => {
    if (!open) {
      setTyping(false)
      return setQuery('')
    }
    const { options: list, value: picked, searchable: findable } = seats.current
    setActive(Math.max(0, list.findIndex((o) => o.value === picked)))
    if (findable && matchMedia('(pointer: fine)').matches) find.current?.focus()
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

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
    <div className={`picker ${rich ? 'rich' : ''} ${open ? 'open' : ''} ${place.up ? 'up' : ''} ${disabled ? 'is-locked' : ''}`} ref={root}>
      {!rich && <span className="picker-label">{label}</span>}
      <button
        type="button"
        className="picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={{ '--tab-accent': current?.accent ?? 'var(--accent)' } as CSSProperties}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) return setOpen(true)
            setActive((a) => Math.min(shown.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (open) {
              e.preventDefault()
              if (shown[active]) pick(shown[active])
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      >
        {rich ? (
          <>
            {current?.media}
            <span className="picker-text">
              <em>{current?.hint ?? label}</em>
              <span className="picker-value">{current?.label}</span>
            </span>
          </>
        ) : (
          <>
            {current?.accent && <span className="dot" />}
            <span className="picker-value">{current?.label}</span>
          </>
        )}
        <ChevronIcon className="picker-caret" />
      </button>
      {open && (
        <div
          className="picker-pop"
          style={{ maxHeight: place.max }}
          onMouseDown={(e) => {
            if (!(e.target as HTMLElement).closest('.picker-find')) find.current?.blur()
          }}
        >
          {searchable && (
            <div className={`picker-find ${typing ? 'on' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
              <SearchIcon />
              <input
                ref={find}
                size={1}
                value={query}
                placeholder={t('picker.find')}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => Math.min(shown.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (shown[active]) pick(shown[active])
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setOpen(false)
                  }
                }}
              />
            </div>
          )}
          <ul className="picker-list" role="listbox">
          {shown.length === 0 && (
            <li className="picker-empty" role="presentation">
              {t('picker.none')}
            </li>
          )}
          {shown.map((option, i) => (
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
              {rich ? (
                <>
                  {option.media}
                  <span className="picker-text">
                    <span className="picker-value">{option.label}</span>
                  </span>
                </>
              ) : (
                <>
                  {option.accent && <span className="dot" />}
                  {option.label}
                </>
              )}
            </li>
          ))}
          </ul>
          {searchable && (
            <ul className="picker-list picker-ruler" aria-hidden>
              {options.map((option) => (
                <li key={option.value}>
                  {rich ? (
                    <>
                      {option.media}
                      <span className="picker-text">
                        <span className="picker-value">{option.label}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      {option.accent && <span className="dot" />}
                      {option.label}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
