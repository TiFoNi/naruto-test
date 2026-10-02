'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_SPECS } from '@nanda/game'
import { api } from './api'
import { GAMES } from './games'
import type { Entity, Game, GameId } from './games/types'
import Thumb from './Thumb'

type Row = Entity & Record<string, unknown>

const NAMES = ['name', 'nameUk', 'nameEn', 'aliases']
const SKIP = new Set(['id', 'thumb', 'answer', 'hidden', ...NAMES])

const asList = (value: unknown) => (Array.isArray(value) ? (value as string[]) : [])

const PAGE = 60

const FILTERS = [
  { id: 'all', label: 'все' },
  { id: 'pool', label: 'в пуле' },
  { id: 'hidden', label: 'скрытые' },
  { id: 'nopic', label: 'без картинки' },
] as const

type Filter = (typeof FILTERS)[number]['id']

const UNIT = {
  character: { one: 'персонаж', many: 'Персонажи', accusative: 'персонажа', fresh: 'Новый', created: 'создан', removed: 'удалён', subject: 'Персонаж' },
  hero: { one: 'герой', many: 'Герои', accusative: 'героя', fresh: 'Новый', created: 'создан', removed: 'удалён', subject: 'Герой' },
  manga: { one: 'манга', many: 'Манга', accusative: 'мангу', fresh: 'Новая', created: 'создана', removed: 'удалена', subject: 'Манга' },
  player: { one: 'футболист', many: 'Футболисты', accusative: 'футболиста', fresh: 'Новый', created: 'создан', removed: 'удалён', subject: 'Футболист' },
} as const

const hasPicture = (row: Row) => !!row.image || (row.thumb ?? -1) >= 0

const LAST_GAME = 'admin-game'

export default function Admin() {
  const [gameId, setGameId] = useState<GameId>(GAMES[0].id)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [options, setOptions] = useState<Record<string, string[]>>({})
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [updated, setUpdated] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)

  const game = (GAMES.find((g) => g.id === gameId) ?? GAMES[0]) as Game
  const unit = UNIT[game.unit ?? 'character']

  const load = useCallback(async (game: GameId) => {
    setRows(null)
    setOpenId(null)
    const { ok, status, data } = await api<{
      entities?: Row[]
      options?: Record<string, string[]>
      updated?: string
    }>(`admin/entities?game=${game}`)
    if (status === 404) return setDenied(true)
    if (!ok) return setRows([])
    setRows(data.entities ?? [])
    setOptions(data.options ?? {})
    setUpdated(data.updated ?? '')
  }, [])

  useEffect(() => {
    const last = localStorage.getItem(LAST_GAME)
    if (last && GAMES.some((g) => g.id === last)) setGameId(last as GameId)
  }, [])

  useEffect(() => {
    void load(gameId)
  }, [gameId, load])

  const fields = useMemo(() => (rows?.[0] ? Object.keys(rows[0]).filter((key) => !SKIP.has(key)) : []), [rows])

  const judged = useMemo(() => {
    const keys = new Set(GAME_SPECS[gameId].columns.map((column) => column.key))
    return (key: string) => keys.has(key) || !!options[key]
  }, [gameId, options])

  const title = useMemo(() => {
    const game = GAMES.find((g) => g.id === gameId)
    const byKey = new Map((game?.columns ?? []).map((column) => [column.key, column.title.ru.replace(/­/g, '')]))
    return (key: string) => {
      const own = byKey.get(key)
      if (own) return key.endsWith('Index') ? `${own} · порядок` : own
      const paired = byKey.get(`${key}Index`)
      if (paired) return paired
      return key
    }
  }, [gameId])

  const twin = (field: string, value: string) => {
    const key = `${field}Index`
    const sample = (rows ?? []).find((row) => row[field] === value && typeof row[key] === 'number')
    return sample ? { [key]: sample[key] } : {}
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!rows) return []
    return rows.filter((row) => {
      if (filter === 'pool' && !row.answer) return false
      if (filter === 'hidden' && !row.hidden) return false
      if (filter === 'nopic' && hasPicture(row)) return false
      if (!needle) return true
      return [row.name, row.nameEn, row.nameUk].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle))
    })
  }, [rows, query, filter])

  useEffect(() => {
    setLimit(PAGE)
  }, [query, filter, gameId])

  const visible = shown.slice(0, limit)

  const replace = (entity: Row) => setRows((list) => (list ?? []).map((r) => (r.id === entity.id ? entity : r)))

  const save = async (row: Row, changed: Record<string, unknown>) => {
    setNote(null)
    const { ok, data } = await api<{ entity?: Row }>('admin/entity', { game: gameId, id: row.id, fields: changed })
    if (!ok || !data.entity) return setNote('не сохранилось')
    replace(data.entity as Row)
    setNote('сохранено')
  }

  const saveUpdated = async (value: string) => {
    setUpdated(value)
    const { ok } = await api('admin/settings', { game: gameId, updated: value })
    setNote(ok ? 'дата сохранена' : 'дата не сохранилась')
  }

  const open = openId === null ? null : (rows ?? []).find((r) => r.id === openId) ?? null

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      all: list.length,
      pool: list.filter((row) => row.answer).length,
      hidden: list.filter((row) => row.hidden).length,
      nopic: list.filter((row) => !hasPicture(row)).length,
    }
  }, [rows])

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin">
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>{unit.many}</h1>
          <Dropdown
            value={GAMES.find((g) => g.id === gameId)?.label.ru ?? ''}
            choices={GAMES.map((g) => g.label.ru)}
            onPick={(label) => {
              const picked = GAMES.find((g) => g.label.ru === label)?.id ?? gameId
              localStorage.setItem(LAST_GAME, picked)
              setGameId(picked)
            }}
          />
          <label className="admin-search">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            <input placeholder="Поиск по имени" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="admin-date" title="Дата, на которую актуальны данные — показывается в игре">
            данные на
            <input type="date" value={updated} onChange={(e) => void saveUpdated(e.target.value)} />
          </label>
        </div>

        <div className="admin-bar-filters">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}
              <em>{counts[id]}</em>
            </button>
          ))}
          <span className="admin-found">{query.trim() ? `найдено ${shown.length}` : ''}</span>
          <span className={`admin-note ${note ? 'on' : ''}`}>{note}</span>
        </div>
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : (
        <>
          <ul className="admin-grid">
            {visible.map((row) => (
              <li key={row.id} className={`admin-card ${row.hidden ? 'is-hidden' : ''} ${row.answer ? '' : 'out-of-pool'}`}>
                <PictureDrop game={gameId} row={row} onDone={replace}>
                  <Thumb game={game} entity={row} className="admin-thumb" />
                </PictureDrop>

                <button type="button" className="admin-card-name" onClick={() => setOpenId(row.id)}>
                  <b>{String(row.name ?? row.id)}</b>
                  <small>{String(row.nameEn ?? '')}</small>
                </button>

                <div className="admin-card-flags">
                  <label className="admin-flag">
                    <input type="checkbox" checked={!!row.answer} onChange={(e) => save(row, { answer: e.target.checked })} />
                    в пуле
                  </label>
                  <label className="admin-flag">
                    <input type="checkbox" checked={!!row.hidden} onChange={(e) => save(row, { hidden: e.target.checked })} />
                    скрыт
                  </label>
                  <button type="button" className="admin-more" onClick={() => setOpenId(row.id)}>
                    Детали
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!shown.length && <div className="card center muted">ничего не найдено</div>}
          {shown.length > visible.length && (
            <div className="admin-more-row">
              <button type="button" onClick={() => setLimit((value) => value + PAGE * 4)}>
                Показать ещё · осталось {shown.length - visible.length}
              </button>
            </div>
          )}
        </>
      )}

      {open && (
        <Details
          key={open.id}
          game={gameId}
          row={open}
          fields={fields}
          options={options}
          judged={judged}
          twin={twin}
          title={title}
          onSave={save}
          onPicture={replace}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  )
}

function Details({
  game,
  row,
  fields,
  options,
  judged,
  twin,
  title,
  onSave,
  onPicture,
  onClose,
}: {
  game: GameId
  row: Row
  fields: string[]
  options: Record<string, string[]>
  judged: (field: string) => boolean
  twin: (field: string, value: string) => Record<string, unknown>
  title: (field: string) => string
  onSave: (row: Row, changed: Record<string, unknown>) => void
  onPicture: (entity: Row) => void
  onClose: () => void
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.modal-backdrop.raised')) onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section className="card modal details" role="dialog" aria-modal="true" aria-label={String(row.name ?? row.id)} onClick={(e) => e.stopPropagation()}>
        <header className="details-head">
          <div className="details-title">
            <h2>{String(row.name ?? row.id)}</h2>
            <small>
              {String(row.nameEn ?? '')} · id {row.id}
            </small>
          </div>
          <div className="details-flags">
            <label className="admin-flag">
              <input type="checkbox" checked={!!row.answer} onChange={(e) => onSave(row, { answer: e.target.checked })} />
              в пуле
            </label>
            <label className="admin-flag">
              <input type="checkbox" checked={!!row.hidden} onChange={(e) => onSave(row, { hidden: e.target.checked })} />
              скрыт
            </label>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className="details-body">
          <Pictures game={game} row={row} onDone={onPicture} />
          <Editor row={row} fields={fields} options={options} judged={judged} twin={twin} title={title} onSave={onSave} />
        </div>

        <footer className="details-foot">
          <button type="button" className="details-done" onClick={onClose}>
            Готово
          </button>
        </footer>
      </section>
    </div>
  )
}

function Editor({
  row,
  fields,
  options,
  judged,
  twin,
  title,
  onSave,
}: {
  row: Row
  fields: string[]
  options: Record<string, string[]>
  judged: (field: string) => boolean
  twin: (field: string, value: string) => Record<string, unknown>
  title: (field: string) => string
  onSave: (row: Row, changed: Record<string, unknown>) => void
}) {
  const single = (key: string) => {
    const choices = options[key]
    if (!choices) {
      return (
        <label key={key}>
          <span>{title(key)}</span>
          <input
            key={String(row[key] ?? '')}
            defaultValue={String(row[key] ?? '')}
            onBlur={(e) =>
              e.target.value !== String(row[key] ?? '') &&
              onSave(row, { [key]: typeof row[key] === 'number' ? Number(e.target.value) : e.target.value })
            }
          />
        </label>
      )
    }

    return (
      <label key={key} className="admin-single">
        <span>{title(key)}</span>
        <Dropdown
          value={String(row[key] ?? '')}
          choices={choices}
          onPick={(picked) => onSave(row, { [key]: picked, ...twin(key, picked) })}
        />
      </label>
    )
  }

  const many = (key: string) => {
    const choices = options[key] ?? []
    const picked = asList(row[key])
    return (
      <section key={key} className="admin-multi">
        <header>
          <span>{title(key)}</span>
          <em>{picked.length ? picked.join(', ') : 'не выбрано'}</em>
        </header>
        <div className="admin-chips">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={picked.includes(choice) ? 'on' : ''}
              onClick={() =>
                onSave(row, {
                  [key]: picked.includes(choice) ? picked.filter((v) => v !== choice) : [...picked, choice],
                })
              }
            >
              {choice}
            </button>
          ))}
        </div>
      </section>
    )
  }

  const used = fields.filter(judged)
  const lists = used.filter((key) => Array.isArray(row[key]))
  const singles = used.filter((key) => !Array.isArray(row[key]))

  return (
    <div className="admin-edit">
      <section className="admin-group">
        <h3>Имена</h3>
        <div className="admin-pairs">
          {NAMES.map((key) => (
            <label key={key}>
              <span>{key === 'name' ? 'Имя (ru)' : key === 'nameUk' ? 'Имя (uk)' : key === 'nameEn' ? 'Имя (en)' : 'Псевдонимы'}</span>
              <input
                defaultValue={String(row[key] ?? '')}
                placeholder={key === 'nameUk' ? 'по умолчанию — транслитерация' : ''}
                onBlur={(e) => e.target.value !== String(row[key] ?? '') && onSave(row, { [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </section>

      {singles.length > 0 && (
        <section className="admin-group">
          <h3>Признаки</h3>
          <div className="admin-pairs">{singles.map(single)}</div>
        </section>
      )}

      {lists.map(many)}
    </div>
  )
}

async function upload(game: GameId, id: number, kind: 'portrait' | 'pages', files: File[]) {
  const form = new FormData()
  form.append('game', game)
  form.append('id', String(id))
  form.append('kind', kind)
  for (const file of files) form.append('file', file)

  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''
  const response = await fetch(`${base}/api/admin/image`, { method: 'POST', body: form, credentials: base ? 'include' : 'same-origin' })
  const data = (await response.json().catch(() => ({}))) as { entity?: Row; error?: string }
  if (!response.ok || !data.entity) throw new Error(data.error === 'too_large' ? 'файл больше 8 МБ' : 'не загрузилось')
  return data.entity
}

function PictureDrop({
  game,
  row,
  onDone,
  children,
}: {
  game: GameId
  row: Row
  onDone: (entity: Row) => void
  children: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (!picked.length) return
    setBusy(true)
    setError(null)
    try {
      onDone(await upload(game, row.id, 'portrait', picked.slice(0, 1)))
    } catch (problem) {
      setError((problem as Error).message)
    }
    setBusy(false)
  }

  return (
    <label
      className={`admin-pic ${over ? 'over' : ''} ${busy ? 'busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void send(e.dataTransfer.files)
      }}
    >
      <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => void send(e.target.files)} />
      {children}
      <span className="admin-pic-hint">{busy ? 'Загружаю…' : error ?? 'Заменить картинку'}</span>
    </label>
  )
}

function Pictures({ game, row, onDone }: { game: GameId; row: Row; onDone: (entity: Row) => void }) {
  const meta = (GAMES.find((g) => g.id === game) ?? GAMES[0]) as Game
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPages = typeof row.pages === 'number'

  const sendPages = async (files: FileList | null) => {
    const picked = Array.from(files ?? [])
    if (!picked.length) return
    setBusy(true)
    setError(null)
    try {
      onDone(await upload(game, row.id, 'pages', picked))
    } catch (problem) {
      setError((problem as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="admin-pics">
      <PictureDrop game={game} row={row} onDone={onDone}>
        <Thumb game={meta} entity={row} className="admin-thumb" />
      </PictureDrop>

      <div className="admin-pics-side">
        <span className="muted">Перетащи картинку на неё или кликни — заменится везде: карточка, кружок и режим «по картинке».</span>
        {hasPages && (
          <div className="admin-pages">
            <span className="muted">Страниц: {String(row.pages)}</span>
            <label className="admin-upload">
              {busy ? 'Загружаю…' : 'Заменить страницы'}
              <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => void sendPages(e.target.files)} />
            </label>
            <small className="muted">загрузи все сразу — сколько файлов, столько и станет страниц</small>
          </div>
        )}
        {error && <span className="admin-error">{error}</span>}
      </div>
    </div>
  )
}

function Dropdown({ value, choices, onPick }: { value: string; choices: string[]; onPick: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  return (
    <div className="dropdown" ref={box}>
      <button type="button" className={`dropdown-head ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span>{value || '—'}</span>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu">
          <ul>
            {choices.map((choice) => (
              <li key={choice}>
                <button
                  type="button"
                  className={choice === value ? 'on' : ''}
                  onClick={() => {
                    onPick(choice)
                    setOpen(false)
                  }}
                >
                  {choice}
                </button>
              </li>
            ))}
            {!choices.length && <li className="dropdown-empty">пусто</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
