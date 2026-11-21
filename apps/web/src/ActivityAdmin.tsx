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
  cheats: Cheats
  pointer: Pointer | null
  suspect: boolean
}

type CheatKind = 'decoy' | 'pointer' | 'pace'

type Cheats = Partial<Record<CheatKind, number>>

type Pointer = { score: number; n: number }

type CheatLog = { kind: CheatKind; at: string; game?: string; entityId?: number; score?: number }

export type FlaggedRow = {
  id: string
  nickname: string
  cheats: Cheats
  log: CheatLog[]
  lastAt: string | null
  pointer: Pointer | null
  suspect: boolean
  humanAt: string | null
  rankBan: string | null
}

type Person = { id: string; nickname: string; tag: string | null; rankBan: string | null; cheats: Cheats }

const BanPanel = ({ banned, onBanned, profileOf }: { banned: Person[]; onBanned: (list: Person[]) => void; profileOf: (id: string) => string }) => {
  const [ask, setAsk] = useState('')
  const [found, setFound] = useState<Person[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const query = ask.trim()
    if (!query) return setFound([])
    const timer = window.setTimeout(async () => {
      const { ok, data } = await api<{ people?: Person[] }>(`admin/activity?q=${encodeURIComponent(query)}`)
      if (ok) setFound(data.people ?? [])
    }, 250)
    return () => window.clearTimeout(timer)
  }, [ask])

  const toggle = async (one: Person, ban: boolean) => {
    if (ban && !window.confirm(`Убрать ${one.nickname} из рейтинга?`)) return
    setBusy(one.id)
    const { ok, data } = await api<{ person?: Person; banned?: Person[] }>('admin/activity', { id: one.id, ban })
    setBusy(null)
    if (!ok || !data.person) return
    onBanned(data.banned ?? [])
    setFound((list) => list.map((row) => (row.id === one.id ? data.person! : row)))
  }

  const row = (one: Person) => (
    <li key={one.id} className={one.rankBan ? 'is-banned' : ''}>
      <Link prefetch={false} href={profileOf(one.id)}>
        {one.nickname}
        {one.tag && <small>#{one.tag}</small>}
      </Link>
      <span className="rank-ban-when">{one.rankBan ? `вне рейтинга с ${when(one.rankBan)}` : 'в рейтинге'}</span>
      <button type="button" className={one.rankBan ? '' : 'is-danger'} disabled={busy === one.id} onClick={() => void toggle(one, !one.rankBan)}>
        {one.rankBan ? 'Снять' : 'В бан'}
      </button>
    </li>
  )

  return (
    <section className="rank-ban card">
      <h2>Бан рейтинга</h2>
      <p className="muted">Игрок продолжает копить опыт, но пропадает из всех таблиц и наград сезона. У себя видит, что он вне рейтинга и куда писать.</p>
      <input type="search" value={ask} onChange={(event) => setAsk(event.target.value)} placeholder="Ник или ник#ТЕГ" aria-label="Найти игрока" />
      {found.length > 0 && <ul className="rank-ban-list">{found.map(row)}</ul>}
      <h3>Сейчас вне рейтинга · {banned.length}</h3>
      {banned.length ? <ul className="rank-ban-list">{banned.map(row)}</ul> : <p className="muted">Никого</p>}
    </section>
  )
}

const CHEAT_LABEL: Record<CheatKind, string> = {
  decoy: 'Выбрал несуществующего персонажа',
  pointer: 'Курсор вёл себя как у бота',
  pace: 'Слишком быстрый темп',
}

const POINTER_BAD = 80
const POINTER_MIN = 30

const cheatText = (one: CheatLog) => {
  if (one.kind === 'decoy') return `${CHEAT_LABEL.decoy}${one.game ? ` · ${one.game}` : ''}${one.entityId !== undefined ? ` #${one.entityId}` : ''}`
  if (one.kind === 'pointer') return `${CHEAT_LABEL.pointer}${one.score !== undefined ? ` · ${Math.round(one.score * 100)}% ходов` : ''}`
  return CHEAT_LABEL.pace
}

const PointerCell = ({ pointer }: { pointer: Pointer | null }) =>
  pointer ? (
    <td className={pointer.n >= POINTER_MIN && pointer.score >= POINTER_BAD ? 'is-hot' : ''} title={`Доля ходов, где курсор телепортировался, шёл идеально ровной линией или попал точно в центр кнопки, по ${pointer.n} ходам`}>
      {pointer.score}% · {pointer.n}
    </td>
  ) : (
    <td>—</td>
  )

const CheatCount = ({ n }: { n?: number }) => <td className={n ? 'is-hot' : ''}>{n ?? 0}</td>

export function FlaggedTable({ rows, profileOf }: { rows: FlaggedRow[]; profileOf: (id: string) => string }) {
  return (
    <div className="activity-scroll">
      <table className="activity-table flagged-table">
        <thead>
          <tr>
            <th>Игрок</th>
            <th title={CHEAT_LABEL.decoy}>Ловушка</th>
            <th title={CHEAT_LABEL.pointer}>Телепорт</th>
            <th title={CHEAT_LABEL.pace}>Темп</th>
            <th title="Доля подозрительных ходов сейчас и сколько ходов посчитано">Курсор</th>
            <th>Последние случаи</th>
            <th>Проверка</th>
            <th>Сейчас</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link prefetch={false} href={profileOf(row.id)}>{row.nickname}</Link>
              </td>
              <CheatCount n={row.cheats.decoy} />
              <CheatCount n={row.cheats.pointer} />
              <CheatCount n={row.cheats.pace} />
              <PointerCell pointer={row.pointer} />
              <td>
                <ul className="flagged-log">
                  {row.log.map((one) => (
                    <li key={`${one.kind}:${one.at}`}>
                      <time>{when(one.at)}</time> {cheatText(one)}
                    </li>
                  ))}
                </ul>
              </td>
              <td>{row.humanAt ? when(row.humanAt) : '—'}</td>
              <td className={row.suspect || row.rankBan ? 'is-hot' : ''}>{row.rankBan ? 'вне рейтинга' : row.suspect ? 'под подозрением' : 'чисто'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
            <th title="Сколько раз ловили: несуществующий персонаж / телепорт курсора / темп">Античит</th>
            <th title="Доля ходов, где курсор телепортировался, шёл идеально ровной линией или попал точно в центр кнопки">Курсор</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hot = row.peak >= CHECK_AT
            const quick = row.total >= 30 && row.fast / row.total >= FAST_SHARE
            return (
              <tr key={row.id}>
                <td>
                  <Link prefetch={false} href={profileOf(row.id)}>{row.nickname}</Link>
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
                <td className={row.suspect || row.cheats.decoy || row.cheats.pointer ? 'is-hot' : ''} title={row.suspect ? 'Сейчас под подозрением' : undefined}>
                  {row.cheats.decoy ?? 0} / {row.cheats.pointer ?? 0} / {row.cheats.pace ?? 0}
                </td>
                <PointerCell pointer={row.pointer} />
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
  const [flagged, setFlagged] = useState<FlaggedRow[]>([])
  const [banned, setBanned] = useState<Person[]>([])
  const [denied, setDenied] = useState(false)

  const load = useCallback(async (next: Range) => {
    setRows(null)
    const { ok, status, data } = await api<{ rows?: ActivityRow[]; flagged?: FlaggedRow[]; banned?: Person[] }>(`admin/activity?range=${next}`)
    if (status === 404) return setDenied(true)
    setRows(ok ? (data.rows ?? []) : [])
    setFlagged(ok ? (data.flagged ?? []) : [])
    if (ok) setBanned(data.banned ?? [])
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

      <BanPanel
        banned={banned}
        profileOf={(id) => href.player(id)}
        onBanned={(list) => {
          setBanned(list)
          const off = new Set(list.map((one) => one.id))
          setFlagged((rows) => rows.map((one) => ({ ...one, rankBan: off.has(one.id) ? (list.find((p) => p.id === one.id)?.rankBan ?? null) : null })))
        }}
      />

      <section className="flagged">
        <h2>Пойманные античитом</h2>
        {rows === null ? null : flagged.length ? (
          <FlaggedTable rows={flagged} profileOf={(id) => href.player(id)} />
        ) : (
          <div className="card center muted">Пока никого не ловили</div>
        )}
      </section>

      <h2 className="activity-heading">Самые активные</h2>
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
