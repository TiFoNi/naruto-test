'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { GAMES } from './games'
import type { Entity, GameId } from './games/types'
import { cardUrl } from './pics'

type Row = Entity & Record<string, unknown>
type Term = { value: string; uk: string; en: string }

const NAMES = ['name', 'nameUk', 'nameEn', 'aliases']
const SKIP = new Set(['id', 'thumb', 'answer', 'hidden', ...NAMES])

const asList = (value: unknown) => (Array.isArray(value) ? (value as string[]) : [])

export default function Admin() {
  const [gameId, setGameId] = useState<GameId>(GAMES[0].id)
  const [tab, setTab] = useState<'people' | 'words'>('people')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [options, setOptions] = useState<Record<string, string[]>>({})
  const [terms, setTerms] = useState<Term[]>([])
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async (game: GameId) => {
    setRows(null)
    setOpenId(null)
    const { ok, status, data } = await api<{ entities?: Row[]; options?: Record<string, string[]>; terms?: Term[] }>(
      `admin/entities?game=${game}`,
    )
    if (status === 404) return setDenied(true)
    if (!ok) return setRows([])
    setRows(data.entities ?? [])
    setOptions(data.options ?? {})
    setTerms(data.terms ?? [])
  }, [])

  useEffect(() => {
    void load(gameId)
  }, [gameId, load])

  const fields = useMemo(() => (rows?.[0] ? Object.keys(rows[0]).filter((key) => !SKIP.has(key)) : []), [rows])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!rows) return []
    if (!needle) return rows
    return rows.filter((row) =>
      [row.name, row.nameEn, row.nameUk].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)),
    )
  }, [rows, query])

  const save = async (row: Row, changed: Record<string, unknown>) => {
    setNote(null)
    const { ok, data } = await api<{ entity?: Row }>('admin/entity', { game: gameId, id: row.id, fields: changed })
    if (!ok || !data.entity) return setNote('не сохранилось')
    setRows((list) => (list ?? []).map((r) => (r.id === row.id ? (data.entity as Row) : r)))
    setNote('сохранено')
  }

  const saveTerm = async (term: Term) => {
    setTerms((list) => list.map((t) => (t.value === term.value ? term : t)))
    await api('admin/term', term)
  }

  const untranslated = terms.filter((t) => !t.uk || !t.en).length

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin">
      <header className="admin-head">
        <h1>{tab === 'people' ? 'Персонажи' : 'Словарь'}</h1>
        <div className="admin-tabs">
          <button type="button" className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
            Персонажи
          </button>
          <button type="button" className={tab === 'words' ? 'active' : ''} onClick={() => setTab('words')}>
            Словарь{untranslated > 0 && <b> · {untranslated}</b>}
          </button>
        </div>
        <select value={gameId} onChange={(e) => setGameId(e.target.value as GameId)}>
          {GAMES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label.ru}
            </option>
          ))}
        </select>
        <input placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
        {note && <span className="muted">{note}</span>}
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : tab === 'words' ? (
        <Words terms={terms} query={query} onSave={saveTerm} />
      ) : (
        <ul className="admin-list">
          {shown.map((row) => (
            <li key={row.id} className={`admin-row ${row.hidden ? 'is-hidden' : ''}`}>
              <button type="button" className="admin-open" onClick={() => setOpenId(openId === row.id ? null : row.id)}>
                <img src={cardUrl(gameId, row.id)} alt="" width={36} height={48} loading="lazy" />
                <span className="admin-name">
                  <b>{String(row.name ?? row.id)}</b>
                  <small>{String(row.nameEn ?? '')}</small>
                </span>
              </button>

              <label className="admin-flag">
                <input type="checkbox" checked={!!row.answer} onChange={(e) => save(row, { answer: e.target.checked })} />
                в пуле
              </label>
              <label className="admin-flag">
                <input type="checkbox" checked={!!row.hidden} onChange={(e) => save(row, { hidden: e.target.checked })} />
                скрыт
              </label>

              {openId === row.id && <Editor row={row} fields={fields} options={options} onSave={save} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function Editor({
  row,
  fields,
  options,
  onSave,
}: {
  row: Row
  fields: string[]
  options: Record<string, string[]>
  onSave: (row: Row, changed: Record<string, unknown>) => void
}) {
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

      {fields.map((key) => {
        const choices = options[key]
        if (!choices) {
          return (
            <label key={key}>
              <span>{key}</span>
              <input
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
              <span>{key}</span>
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
          <label key={key}>
            <span>{key}</span>
            <select value={String(row[key] ?? '')} onChange={(e) => onSave(row, { [key]: e.target.value })}>
              {!choices.includes(String(row[key] ?? '')) && <option value={String(row[key] ?? '')}>{String(row[key] ?? '—')}</option>}
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  )
}

function Words({ terms, query, onSave }: { terms: Term[]; query: string; onSave: (term: Term) => void }) {
  const needle = query.trim().toLowerCase()
  const shown = needle ? terms.filter((t) => t.value.toLowerCase().includes(needle)) : terms

  return (
    <ul className="admin-list">
      {shown.map((term) => (
        <li key={term.value} className={`admin-word ${!term.uk || !term.en ? 'is-missing' : ''}`}>
          <b>{term.value}</b>
          <input
            defaultValue={term.uk}
            placeholder="українською"
            onBlur={(e) => e.target.value !== term.uk && onSave({ ...term, uk: e.target.value })}
          />
          <input
            defaultValue={term.en}
            placeholder="in English"
            onBlur={(e) => e.target.value !== term.en && onSave({ ...term, en: e.target.value })}
          />
        </li>
      ))}
    </ul>
  )
}
