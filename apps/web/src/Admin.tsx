'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_SPECS } from '@nanda/game'
import { api } from './api'
import { GAMES } from './games'
import type { Entity, GameId } from './games/types'
import { miniUrl } from './pics'

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
} as const

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

  const unit = UNIT[GAMES.find((g) => g.id === gameId)?.unit ?? 'character']

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
    void load(gameId)
  }, [gameId, load])

  const fields = useMemo(() => (rows?.[0] ? Object.keys(rows[0]).filter((key) => !SKIP.has(key)) : []), [rows])

  const judged = useMemo(() => {
    const keys = new Set(GAME_SPECS[gameId].columns.map((column) => column.key))
    return (key: string) => keys.has(key) || !!options[key]
  }, [gameId, options])

  const title = useMemo(() => {
    const game = GAMES.find((g) => g.id === gameId)
    const byKey = new Map((game?.columns ?? []).map((column) => [column.key, column.title.ru.replace(/\u00ad/g, '')]))
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
      if (filter === 'nopic' && (row.image || (row.thumb ?? 0) >= 0)) return false
      if (!needle) return true
      return [row.name, row.nameEn, row.nameUk].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle))
    })
  }, [rows, query, filter])

  useEffect(() => {
    setLimit(PAGE)
  }, [query, filter, gameId])

  const visible = shown.slice(0, limit)

  const save = async (row: Row, changed: Record<string, unknown>) => {
    setNote(null)
    const { ok, data } = await api<{ entity?: Row }>('admin/entity', { game: gameId, id: row.id, fields: changed })
    if (!ok || !data.entity) return setNote('не сохранилось')
    setRows((list) => (list ?? []).map((r) => (r.id === row.id ? (data.entity as Row) : r)))
    setNote('сохранено')
  }

  const saveUpdated = async (value: string) => {
    setUpdated(value)
    const { ok } = await api('admin/settings', { game: gameId, updated: value })
    setNote(ok ? 'дата сохранена' : 'дата не сохранилась')
  }

  const open = openId === null ? null : (rows ?? []).find((r) => r.id === openId) ?? null

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin">
      <header className="admin-head">
        <div className="admin-head-row">
          <h1>{unit.many}</h1>
        </div>

        <div className="admin-head-row admin-tools">
          <Dropdown
            value={GAMES.find((g) => g.id === gameId)?.label.ru ?? ''}
            choices={GAMES.map((g) => g.label.ru)}
            onPick={(label) => setGameId(GAMES.find((g) => g.label.ru === label)?.id ?? gameId)}
          />
          <input className="admin-search" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="admin-date" title="Дата, на которую актуальны данные — показывается в игре">
            данные на
            <input type="date" value={updated} onChange={(e) => void saveUpdated(e.target.value)} />
          </label>
          <span className={`admin-note ${note ? 'on' : ''}`}>{note}</span>
        </div>

        <div className="admin-head-row admin-filters">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
          <span className="admin-count">
            {filter === 'all' && !query.trim() ? `всего ${shown.length}` : `${shown.length} из ${rows?.length ?? 0}`}
          </span>
        </div>
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : (
        <ul className="admin-list">
          {visible.map((row) => (
            <li key={row.id} className={`admin-row ${row.hidden ? 'is-hidden' : ''}`}>
              <button type="button" className="admin-open" onClick={() => setOpenId(row.id)}>
                {row.image || (row.thumb ?? 0) >= 0 ? (
                  <img src={miniUrl(gameId, row.id, row.image as string | undefined)} alt="" width={36} height={48} loading="lazy" />
                ) : (
                  <span className="admin-blank">{String(row.name ?? '?').slice(0, 1)}</span>
                )}
                <span className="admin-name">
                  <b>{String(row.name ?? row.id)}</b>
                  <small>{String(row.nameEn ?? '')}</small>
                </span>
              </button>

              <div className="admin-flags">
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
          {!shown.length && <li className="card center muted">ничего не найдено</li>}
          {shown.length > visible.length && (
            <li className="admin-more-row">
              <button type="button" onClick={() => setLimit((value) => value + PAGE * 4)}>
                Показать ещё · осталось {shown.length - visible.length}
              </button>
            </li>
          )}
        </ul>
      )}
      {open && (
        <Details
          game={gameId}
          row={open}
          fields={fields}
          options={options}
          judged={judged}
          twin={twin}
          title={title}
          onSave={save}
          onPicture={(entity) => setRows((list) => (list ?? []).map((r) => (r.id === entity.id ? entity : r)))}
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
  const field = (key: string) => {
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

    if (Array.isArray(row[key])) {
      const picked = asList(row[key])
      return (
        <label key={key} className="admin-multi">
          <span>{title(key)}</span>
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

  const used = fields.filter(judged)
  const rest = fields.filter((key) => !judged(key))

  return (
    <div className="admin-edit">
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

      {used.map(field)}

      {rest.length > 0 && (
        <div className="admin-rest">
          <span className="admin-rest-title">в игре не участвует</span>
          <div className="admin-rest-fields">{rest.map(field)}</div>
        </div>
      )}
    </div>
  )
}

function Pictures({ game, row, onDone }: { game: GameId; row: Row; onDone: (entity: Row) => void }) {
  const [busy, setBusy] = useState<'portrait' | 'pages' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasPages = typeof row.pages === 'number'

  const send = async (kind: 'portrait' | 'pages', files: FileList | null) => {
    if (!files?.length) return
    setBusy(kind)
    setError(null)

    const form = new FormData()
    form.append('game', game)
    form.append('id', String(row.id))
    form.append('kind', kind)
    for (const file of Array.from(files)) form.append('file', file)

    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''
    const response = await fetch(`${base}/api/admin/image`, { method: 'POST', body: form, credentials: base ? 'include' : 'same-origin' })
    const data = (await response.json().catch(() => ({}))) as { entity?: Row; error?: string }
    setBusy(null)
    if (!response.ok || !data.entity) return setError(data.error === 'too_large' ? 'файл больше 8 МБ' : 'не загрузилось')
    onDone(data.entity)
  }

  return (
    <div className="admin-pics">
      <figure>
        <img src={miniUrl(game, row.id, row.image as string | undefined)} alt="" width={72} height={96} />
        <figcaption>
          <label className="admin-upload">
            {busy === 'portrait' ? 'Загружаю…' : hasPages ? 'Заменить обложку' : 'Заменить картинку'}
            <input type="file" accept="image/*" hidden disabled={busy !== null} onChange={(e) => send('portrait', e.target.files)} />
          </label>
        </figcaption>
      </figure>

      {hasPages && (
        <div className="admin-pages">
          <span className="muted">Страниц: {String(row.pages)}</span>
          <label className="admin-upload">
            {busy === 'pages' ? 'Загружаю…' : 'Заменить страницы'}
            <input type="file" accept="image/*" multiple hidden disabled={busy !== null} onChange={(e) => send('pages', e.target.files)} />
          </label>
          <small className="muted">загрузи все сразу — сколько файлов, столько и станет страниц</small>
        </div>
      )}

      {error && <span className="admin-error">{error}</span>}
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
        <i aria-hidden>▾</i>
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

