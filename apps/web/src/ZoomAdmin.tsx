'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { ZOOM_LEVELS } from '@nanda/game'
import { api } from './api'
import { useHref } from './router'

const GAME = 'genshin'

type Spot = { x: number; y: number }

type Row = { id: number; name?: string; nameEn?: string; image?: string; focus?: Spot | null }

type Size = { w: number; h: number }

const FILTERS = [
  { id: 'all', label: 'все' },
  { id: 'set', label: 'с точкой' },
  { id: 'auto', label: 'авто' },
] as const

type Filter = (typeof FILTERS)[number]['id']

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const windowAt = (focus: Spot, zoom: number, size: Size) => {
  const side = Math.max(24, Math.round(Math.max(size.w, size.h) / zoom))
  const width = Math.min(side, size.w)
  const height = Math.min(side, size.h)
  const middle = { x: focus.x + (0.5 - focus.x) / zoom, y: focus.y + (0.5 - focus.y) / zoom }
  const left = clamp(Math.round(middle.x * size.w - width / 2), 0, Math.max(0, size.w - width))
  const top = clamp(Math.round(middle.y * size.h - height / 2), 0, Math.max(0, size.h - height))
  return { left: left / size.w, top: top / size.h, width: width / size.w, height: height / size.h }
}

const focusFromCentre = (centre: Spot, zoom: number) => {
  const back = (value: number) => clamp((value - 0.5 / zoom) / (1 - 1 / zoom), 0, 1)
  return { x: back(centre.x), y: back(centre.y) }
}

const cropStyle = (url: string, box: { left: number; top: number; width: number; height: number }): CSSProperties => ({
  backgroundImage: `url(${url})`,
  backgroundSize: `${100 / box.width}% ${100 / box.height}%`,
  backgroundPosition: `${(box.left / Math.max(1e-6, 1 - box.width)) * 100}% ${(box.top / Math.max(1e-6, 1 - box.height)) * 100}%`,
})

export default function ZoomAdmin() {
  const href = useHref()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [pics, setPics] = useState('')
  const [folder, setFolder] = useState(GAME)
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Spot | null>(null)
  const [sizes, setSizes] = useState<Record<number, Size>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const load = useCallback(async () => {
    const { ok, status, data } = await api<{ list?: Row[]; pics?: string; folder?: string }>(`admin/zoom?game=${GAME}`)
    if (status === 404) return setDenied(true)
    if (!ok) return setRows([])
    setRows(data.list ?? [])
    setPics(data.pics ?? '')
    setFolder(data.folder ?? GAME)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const urlOf = useCallback(
    (row: Row) => `${pics}/${folder}/full/${row.id}.webp${row.image ? `?v=${row.image}` : ''}`,
    [pics, folder],
  )

  const open = rows?.find((row) => row.id === openId) ?? null
  const size = openId !== null ? sizes[openId] : undefined
  const focus = draft ?? open?.focus ?? { x: 0.5, y: 0.5 }

  const shown = useMemo(() => {
    const list = rows ?? []
    const needle = query.trim().toLowerCase()
    return list.filter((row) => {
      if (filter === 'set' && !row.focus) return false
      if (filter === 'auto' && row.focus) return false
      if (!needle) return true
      return `${row.name ?? ''} ${row.nameEn ?? ''} ${row.id}`.toLowerCase().includes(needle)
    })
  }, [rows, query, filter])

  const counts = useMemo(() => {
    const list = rows ?? []
    return { all: list.length, set: list.filter((row) => row.focus).length, auto: list.filter((row) => !row.focus).length }
  }, [rows])

  const aim = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const box = stage.current?.getBoundingClientRect()
      if (!box) return
      const centre = { x: clamp((event.clientX - box.left) / box.width, 0, 1), y: clamp((event.clientY - box.top) / box.height, 0, 1) }
      setDraft(focusFromCentre(centre, ZOOM_LEVELS[0]))
    },
    [],
  )

  const grab = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    aim(event)
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) aim(event)
  }

  const drop = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const keep = async (point: Spot | null) => {
    if (openId === null) return
    setBusy(true)
    const { ok } = await api<{ focus?: Spot | null }>('admin/zoom', { game: GAME, id: openId, focus: point })
    setBusy(false)
    if (!ok) return setNote('не сохранилось')
    setRows((kept) => (kept ? kept.map((row) => (row.id === openId ? { ...row, focus: point } : row)) : kept))
    setDraft(null)
    setNote(point ? 'сохранено' : 'сброшено на авто')
  }

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(''), 2200)
    return () => clearTimeout(timer)
  }, [note])

  useEffect(() => {
    if (openId === null) return
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return setOpenId(null)
      const step = event.shiftKey ? 0.02 : 0.005
      const shift =
        event.key === 'ArrowLeft' ? { x: -step, y: 0 } : event.key === 'ArrowRight' ? { x: step, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: -step } : event.key === 'ArrowDown' ? { x: 0, y: step } : null
      if (!shift) return
      event.preventDefault()
      setDraft((was) => {
        const from = was ?? open?.focus ?? { x: 0.5, y: 0.5 }
        return { x: clamp(from.x + shift.x, 0, 1), y: clamp(from.y + shift.y, 0, 1) }
      })
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [openId, open])

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin zoom-admin">
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Точка зума · Genshin</h1>
          <Link className="admin-more" href={href.admin}>
            Персонажи
          </Link>
          <Link className="admin-more" href={href.adminShots}>
            Кадры аниме
          </Link>
          <label className="admin-search">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            <input placeholder="Поиск по имени" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <span className={`admin-note ${note ? 'on' : ''}`}>{note}</span>
        </div>

        <div className="admin-bar-filters">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}
              <em>{counts[id]}</em>
            </button>
          ))}
          <span className="admin-found">{query.trim() ? `найдено ${shown.length}` : ''}</span>
        </div>
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : (
        <ul className="zoom-grid">
          {shown.map((row) => {
            const own = sizes[row.id]
            const box = own && row.focus ? windowAt(row.focus, ZOOM_LEVELS[0], own) : null
            return (
              <li key={row.id}>
                <button type="button" className={`zoom-card ${row.focus ? 'is-set' : ''}`} onClick={() => (setOpenId(row.id), setDraft(null))}>
                  <span className="zoom-shot">
                    <img
                      src={urlOf(row)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onLoad={(event) => {
                        const { naturalWidth: w, naturalHeight: h } = event.currentTarget
                        setSizes((was) => (was[row.id] ? was : { ...was, [row.id]: { w, h } }))
                      }}
                    />
                    {box && (
                      <i
                        className="zoom-frame"
                        style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
                      />
                    )}
                  </span>
                  <b>{row.name ?? row.id}</b>
                  <small>{row.focus ? 'вручную' : 'авто'}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <div className="zoom-sheet" role="dialog" aria-label={open.name ?? String(open.id)}>
          <div className="zoom-sheet-box">
            <header>
              <b>{open.name ?? open.id}</b>
              <span className="muted">{open.focus ? `точка ${open.focus.x.toFixed(2)} · ${open.focus.y.toFixed(2)}` : 'сейчас авто'}</span>
              <button type="button" className="zoom-close" onClick={() => (setOpenId(null), setDraft(null))}>
                ✕
              </button>
            </header>

            <div className="zoom-stage" ref={stage} onPointerDown={grab} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}>
              <img
                src={urlOf(open)}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth: w, naturalHeight: h } = event.currentTarget
                  setSizes((was) => ({ ...was, [open.id]: { w, h } }))
                }}
              />
              {size &&
                ZOOM_LEVELS.map((zoom, step) => {
                  const box = windowAt(focus, zoom, size)
                  return (
                    <i
                      key={zoom}
                      className={`zoom-ring ${step === 0 ? 'is-first' : ''}`}
                      style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
                    >
                      <em>{step + 1}</em>
                    </i>
                  )
                })}
            </div>

            <p className="zoom-hint">Клик или перетаскивание — куда встанет первый квадрат. Стрелки двигают по чуть-чуть, Shift — быстрее.</p>

            <ol className="zoom-steps">
              {ZOOM_LEVELS.map((zoom, step) => (
                <li key={zoom}>
                  <span className="zoom-step" style={size ? cropStyle(urlOf(open), windowAt(focus, zoom, size)) : undefined} />
                  <em>{step + 1}</em>
                </li>
              ))}
            </ol>

            <footer>
              <button type="button" className="primary" disabled={busy} onClick={() => keep(focus)}>
                Сохранить
              </button>
              <button type="button" className="ghost" disabled={busy || !open.focus} onClick={() => keep(null)}>
                Сбросить на авто
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  )
}
