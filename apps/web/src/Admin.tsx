'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { GAMES } from './games'
import type { Entity, GameId } from './games/types'
import { cardUrl } from './pics'

type Row = Entity & Record<string, unknown>

const HIDDEN_FIELDS = new Set(['id', 'thumb', 'hidden', 'answer'])

const kind = (value: unknown) => (Array.isArray(value) ? 'list' : typeof value === 'number' ? 'number' : 'text')

const show = (value: unknown) => (Array.isArray(value) ? value.join(', ') : value === undefined || value === null ? '' : String(value))

const parse = (raw: string, sample: unknown) => {
  if (Array.isArray(sample))
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  if (typeof sample === 'number') return Number(raw)
  return raw
}

export default function Admin() {
  const [gameId, setGameId] = useState<GameId>(GAMES[0].id)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async (game: GameId) => {
    setRows(null)
    setOpenId(null)
    const { ok, status, data } = await api<{ entities?: Row[] }>(`admin/entities?game=${game}`)
    if (status === 404) return setDenied(true)
    setRows(ok && Array.isArray(data.entities) ? data.entities : [])
  }, [])

  useEffect(() => {
    void load(gameId)
  }, [gameId, load])

  const fields = useMemo(() => {
    const sample = rows?.[0]
    return sample ? Object.keys(sample).filter((key) => !HIDDEN_FIELDS.has(key)) : []
  }, [rows])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!rows) return []
    if (!needle) return rows
    return rows.filter((row) => [row.name, row.nameEn].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
  }, [rows, query])

  const open = (row: Row) => {
    setOpenId(row.id)
    setDraft(Object.fromEntries(fields.map((key) => [key, show(row[key])])))
    setNote(null)
  }

  const patch = async (row: Row, extra?: Record<string, unknown>) => {
    setSaving(true)
    setNote(null)
    const changed =
      extra ??
      Object.fromEntries(
        fields.filter((key) => show(row[key]) !== draft[key]).map((key) => [key, parse(draft[key] ?? '', row[key])]),
      )

    if (!Object.keys(changed).length) {
      setSaving(false)
      setNote('нечего сохранять')
      return
    }

    const { ok, data } = await api<{ entity?: Row }>('admin/entity', { game: gameId, id: row.id, fields: changed })
    setSaving(false)
    if (!ok || !data.entity) return setNote('не сохранилось')
    setRows((list) => (list ?? []).map((r) => (r.id === row.id ? (data.entity as Row) : r)))
    setNote('сохранено')
  }

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin">
      <header className="admin-head">
        <h1>Персонажи</h1>
        <select value={gameId} onChange={(e) => setGameId(e.target.value as GameId)}>
          {GAMES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label.ru}
            </option>
          ))}
        </select>
        <input placeholder="Поиск по имени" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted">{rows ? `${shown.length} из ${rows.length}` : 'загрузка…'}</span>
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : (
        <ul className="admin-list">
          {shown.map((row) => (
            <li key={row.id} className={`admin-row ${row.hidden ? 'is-hidden' : ''}`}>
              <button type="button" className="admin-open" onClick={() => (openId === row.id ? setOpenId(null) : open(row))}>
                <img src={cardUrl(gameId, row.id)} alt="" width={36} height={48} loading="lazy" />
                <span className="admin-name">
                  <b>{String(row.name ?? row.id)}</b>
                  <small>{String(row.nameEn ?? '')}</small>
                </span>
              </button>

              <label className="admin-flag">
                <input type="checkbox" checked={!!row.answer} onChange={(e) => patch(row, { answer: e.target.checked })} />
                в пуле
              </label>

              <label className="admin-flag">
                <input type="checkbox" checked={!!row.hidden} onChange={(e) => patch(row, { hidden: e.target.checked })} />
                скрыт
              </label>

              {openId === row.id && (
                <div className="admin-edit">
                  {fields.map((key) => (
                    <label key={key}>
                      <span>
                        {key}
                        {kind(row[key]) === 'list' && <em> через запятую</em>}
                      </span>
                      <input value={draft[key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
                    </label>
                  ))}
                  <div className="admin-actions">
                    <button type="button" className="primary" disabled={saving} onClick={() => patch(row)}>
                      {saving ? 'Сохраняю…' : 'Сохранить'}
                    </button>
                    {note && <span className="muted">{note}</span>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
