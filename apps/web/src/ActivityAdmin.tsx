'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import AdminNav from './AdminNav'
import { api } from './api'
import { useHref } from './router'

type Range = 'hour' | 'day' | 'week'

export type ActivityRow = {
  id: string
  nickname: string
  xp: number
  total: number
  peak: number
  busy: number
  won: number
  first: number
  fast: number
  favorite: { game: string; mode: string; n: number } | null
  lastAt: string
  humanAt: string | null
}

const RANGES: { id: Range; label: string }[] = [
  { id: 'hour', label: 'Час' },
  { id: 'day', label: 'Сутки' },
  { id: 'week', label: 'Неделя' },
]

const CHECK_AT = 200
const FAST_SHARE = 0.25

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')

const when = (value: string) => new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function ActivityTable({ rows, profileOf }: { rows: ActivityRow[]; profileOf: (id: string) => string }) {
  return (
    <div className="activity-scroll">
      <table className="activity-table">
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Раундов</th>
            <th title="Больше всего раундов за один час. От 200 просим пройти проверку.">Пик в час</th>
            <th title="Сколько часов сыграно от 60 раундов">Часов 60+</th>
            <th>Побед</th>
            <th>С первой</th>
            <th title="Раунды, начатые меньше чем через 1,5 с после предыдущего">Быстрых</th>
            <th>Чаще всего</th>
            <th>Последний</th>
            <th>Проверка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hot = row.peak >= CHECK_AT
            const quick = row.total >= 30 && row.fast / row.total >= FAST_SHARE
            return (
              <tr key={row.id}>
                <td>
                  <Link href={profileOf(row.id)}>{row.nickname}</Link>
                </td>
                <td>{row.total}</td>
                <td className={hot ? 'is-hot' : ''}>{row.peak}</td>
                <td>{row.busy}</td>
                <td>{percent(row.won, row.total)}</td>
                <td>{percent(row.first, row.total)}</td>
                <td className={quick ? 'is-hot' : ''}>{percent(row.fast, row.total)}</td>
                <td>{row.favorite ? `${row.favorite.game}/${row.favorite.mode} · ${row.favorite.n}` : '—'}</td>
                <td>{when(row.lastAt)}</td>
                <td>{row.humanAt ? when(row.humanAt) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function ActivityAdmin() {
  const href = useHref()
  const [range, setRange] = useState<Range>('day')
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async (next: Range) => {
    setRows(null)
    const { ok, status, data } = await api<{ rows?: ActivityRow[] }>(`admin/activity?range=${next}`)
    if (status === 404) return setDenied(true)
    setRows(ok ? (data.rows ?? []) : [])
  }, [])

  useEffect(() => {
    void load(range)
  }, [load, range])

  if (denied) return <div className="admin page-main card center muted">Нет доступа</div>

  return (
    <div className="admin page-main">
      <AdminNav />
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Активность игроков</h1>
        </div>
        <div className="admin-bar-filters">
          {RANGES.map(({ id, label }) => (
            <button key={id} type="button" className={range === id ? 'on' : ''} onClick={() => setRange(id)}>
              {label}
            </button>
          ))}
          <span className="admin-found">красным выделено то, что не похоже на человека</span>
        </div>
      </header>

      {rows === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="card center muted">За это время никто не играл</div>
      ) : (
        <ActivityTable rows={rows} profileOf={(id) => href.player(id)} />
      )}
    </div>
  )
}
