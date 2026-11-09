'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ModeId } from '@nanda/game'
import AdminNav from './AdminNav'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { Entity, GameId } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon, RefreshIcon } from './icons'
import { MODES } from './modes'
import Thumb from './Thumb'

type Kind = 'all' | 'endless' | 'daily'
type Measure = 'playerAvg' | 'avg' | 'median'

type Stats = {
  rounds: number
  players: number
  won: number
  lost: number
  skipped: number
  first: number
  avg: number | null
  playerAvg: number | null
  median: number | null
}

type WorldRow = Stats & { game: GameId; mode: ModeId }
type CharacterRow = Stats & { id: number; name: string; nameEn?: string; nameUk?: string; thumb: number; gone: boolean }
type Picked = { game: GameId; mode: ModeId }
type SortKey = 'name' | 'rounds' | 'players' | 'win' | 'skip' | 'first' | 'playerAvg' | 'avg' | 'median'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'Все раунды' },
  { id: 'endless', label: 'Бесконечные' },
  { id: 'daily', label: 'Ежедневные' },
]

const MEASURES: { id: Measure; label: string; hint: string }[] = [
  { id: 'playerAvg', label: 'Среднее по игрокам', hint: 'Сначала среднее у каждого игрока, потом среднее между игроками. Фармеры не перевешивают.' },
  { id: 'avg', label: 'Среднее по раундам', hint: 'Все угаданные раунды вместе. Кто много играет, тот сильнее тянет число.' },
  { id: 'median', label: 'Медиана', hint: 'Половина угадывает быстрее, половина дольше.' },
]

const WIN_ONLY: ModeId[] = ['odd', 'pair', 'tune']
const FEW = 20
const FEW_CHARACTER = 5
const POLL_MS = 5 * 60_000

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const number = (value: number | null) => (value === null ? '—' : String(Math.round(value * 100) / 100))

function ago(at: number, now: number) {
  if (!at) return 'только что'
  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  return minutes < 1 ? 'только что' : `${minutes} мин назад`
}

function heat(value: number | null, low: number, high: number) {
  if (value === null || high <= low) return undefined
  const part = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return `color-mix(in srgb, var(--accent) ${Math.round(8 + part * 42)}%, transparent)`
}

const winOnly = (mode: ModeId, row: Stats) => WIN_ONLY.includes(mode) || row.avg === null

export default function DifficultyAdmin() {
  const { t, lang, name } = useI18n()
  const [kind, setKind] = useState<Kind>('all')
  const [measure, setMeasure] = useState<Measure>('playerAvg')
  const [rows, setRows] = useState<WorldRow[] | null>(null)
  const [at, setAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [characters, setCharacters] = useState<CharacterRow[] | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; down: boolean }>({ key: 'playerAvg', down: true })
  const detailRef = useRef<HTMLElement>(null)

  const load = useCallback(async (next: Kind, fresh = false) => {
    const { ok, status, data } = await api<{ rows?: WorldRow[]; at?: number }>(`admin/difficulty?kind=${next}${fresh ? '&fresh=1' : ''}`)
    if (status === 404) return setDenied(true)
    setRows(ok ? (data.rows ?? []) : [])
    setAt(data.at ?? 0)
  }, [])

  const loadCharacters = useCallback(async (next: Kind, target: Picked, fresh = false) => {
    const { ok, data } = await api<{ rows?: CharacterRow[] }>(`admin/difficulty?kind=${next}&game=${target.game}&mode=${target.mode}${fresh ? '&fresh=1' : ''}`)
    setCharacters(ok ? (data.rows ?? []) : [])
  }, [])

  useEffect(() => {
    setRows(null)
    void load(kind)
    const timer = window.setInterval(() => void load(kind), POLL_MS)
    return () => window.clearInterval(timer)
  }, [kind, load])

  useEffect(() => {
    if (!picked) return
    setCharacters(null)
    void loadCharacters(kind, picked)
  }, [kind, picked, loadCharacters])

  useEffect(() => {
    if (picked) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [picked])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = async () => {
    setBusy(true)
    await Promise.all([load(kind, true), picked ? loadCharacters(kind, picked, true) : null])
    setNow(Date.now())
    setBusy(false)
  }

  const modes = useMemo(() => MODES.filter((mode) => rows?.some((row) => row.mode === mode.id)), [rows])

  const worlds = useMemo(() => {
    const order = new Map(GAMES.map((game, index) => [game.id, index]))
    return [...new Set((rows ?? []).map((row) => row.game))].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
  }, [rows])

  const cell = useMemo(() => new Map((rows ?? []).map((row) => [`${row.game}/${row.mode}`, row])), [rows])

  const range = useMemo(() => {
    const out = new Map<ModeId, { low: number; high: number }>()
    for (const mode of modes) {
      const values = (rows ?? [])
        .filter((row) => row.mode === mode.id && row.rounds >= FEW)
        .map((row) => (winOnly(mode.id, row) ? 100 - share(row.won, row.rounds) : row[measure]))
        .filter((value): value is number => value !== null)
      if (values.length) out.set(mode.id, { low: Math.min(...values), high: Math.max(...values) })
    }
    return out
  }, [rows, modes, measure])

  const sorted = useMemo(() => {
    if (!characters) return null
    const value = (row: CharacterRow): number | string => {
      if (sort.key === 'name') return name(row)
      if (sort.key === 'win') return share(row.won, row.rounds)
      if (sort.key === 'skip') return share(row.skipped + row.lost, row.rounds)
      if (sort.key === 'first') return share(row.first, row.won)
      return row[sort.key] ?? -1
    }
    return [...characters].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      const order = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number)
      return sort.down ? -order : order
    })
  }, [characters, sort, name])

  const top = useMemo(() => Math.max(0, ...(characters ?? []).filter((row) => row.rounds >= FEW_CHARACTER).map((row) => row.playerAvg ?? 0)), [characters])

  if (denied) return <div className="admin page-main card center muted">Нет доступа</div>

  const label = (game: GameId) => gameById(game).label[lang]
  const modeLabel = (mode: ModeId) => t(MODES.find((one) => one.id === mode)?.label ?? 'mode.classic')
  const pickedRow = picked ? cell.get(`${picked.game}/${picked.mode}`) : undefined
  const head = (key: SortKey, text: string, hint?: string) => (
    <th title={hint}>
      <button type="button" className={sort.key === key ? 'on' : ''} onClick={() => setSort((was) => ({ key, down: was.key === key ? !was.down : key !== 'name' }))}>
        {text}
        {sort.key === key && <em>{sort.down ? '↓' : '↑'}</em>}
      </button>
    </th>
  )

  return (
    <div className="admin page-main">
      <AdminNav />
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Сложность угадывания</h1>
          <span className="admin-found">
            {rows ? `обновлено ${ago(at, now)}` : ''}
            <button type="button" className="diff-refresh" onClick={() => void refresh()} disabled={busy} aria-label="Пересчитать сейчас" title="Пересчитать сейчас">
              <RefreshIcon className={busy ? 'spin' : ''} />
            </button>
          </span>
        </div>
        <div className="admin-bar-filters">
          {KINDS.map(({ id, label: text }) => (
            <button key={id} type="button" className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
              {text}
            </button>
          ))}
          <span className="diff-gap" />
          {MEASURES.map(({ id, label: text, hint }) => (
            <button key={id} type="button" className={measure === id ? 'on' : ''} title={hint} onClick={() => setMeasure(id)}>
              {text}
            </button>
          ))}
        </div>
      </header>

      <p className="diff-note muted">
        В клетке — сколько попыток в среднем уходит на угаданного персонажа ({MEASURES.find((one) => one.id === measure)?.hint.toLowerCase()}). В режимах с одной попыткой (лишний, кто из двух, опенинг) — процент угаданных. Чем ярче клетка, тем сложнее по сравнению с другими вселенными в этом режиме. Бледные клетки — меньше {FEW} раундов. Считается по всем раундам зарегистрированных игроков, сам пересчитывается раз в 10 минут.
      </p>

      {rows === null ? (
        <div className="card center muted">Считаю… первый раз занимает несколько секунд</div>
      ) : rows.length === 0 ? (
        <div className="card center muted">Пока нет сыгранных раундов</div>
      ) : (
        <div className="activity-scroll">
          <table className="diff-table">
            <thead>
              <tr>
                <th>Вселенная</th>
                {modes.map((mode) => (
                  <th key={mode.id}>{t(mode.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {worlds.map((game) => (
                <tr key={game}>
                  <th scope="row">{label(game)}</th>
                  {modes.map((mode) => {
                    const row = cell.get(`${game}/${mode.id}`)
                    if (!row) return <td key={mode.id} className="diff-empty" />
                    const wins = winOnly(mode.id, row)
                    const value = wins ? null : row[measure]
                    const span = range.get(mode.id)
                    const tint = row.rounds >= FEW && span ? heat(wins ? 100 - share(row.won, row.rounds) : value, span.low, span.high) : undefined
                    const on = picked?.game === game && picked.mode === mode.id
                    return (
                      <td key={mode.id} className={`${row.rounds < FEW ? 'diff-few' : ''} ${on ? 'on' : ''}`} style={{ background: tint }}>
                        <button
                          type="button"
                          onClick={() => setPicked(on ? null : { game, mode: mode.id })}
                          title={`${label(game)} · ${t(mode.label)}\nРаундов: ${row.rounds}, игроков: ${row.players}\nУгадали: ${share(row.won, row.rounds)}%, сдались или кончились попытки: ${share(row.skipped + row.lost, row.rounds)}%\nПо игрокам: ${number(row.playerAvg)}, по раундам: ${number(row.avg)}, медиана: ${number(row.median)}\nС первой попытки: ${share(row.first, row.won)}%`}
                        >
                          <b>{wins ? `${share(row.won, row.rounds)}%` : number(value)}</b>
                          <small>{row.rounds}</small>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picked && (
        <section className="diff-detail" ref={detailRef}>
          <header className="diff-detail-head">
            <div>
              <h2>
                {label(picked.game)}
                <span>·</span>
                {modeLabel(picked.mode)}
              </h2>
              <p className="muted">Клик по заголовку столбца меняет сортировку. Бледные строки — меньше {FEW_CHARACTER} раундов, на них пока рано смотреть.</p>
            </div>
            <button type="button" className="diff-close" onClick={() => setPicked(null)} aria-label="Закрыть" title="Закрыть">
              <CloseIcon />
            </button>
          </header>

          {pickedRow && (
            <dl className="diff-stats">
              <div>
                <dt>Раундов</dt>
                <dd>{pickedRow.rounds}</dd>
              </div>
              <div>
                <dt>Игроков</dt>
                <dd>{pickedRow.players}</dd>
              </div>
              <div>
                <dt>Персонажей</dt>
                <dd>{sorted?.length ?? '…'}</dd>
              </div>
              <div>
                <dt>Угадали</dt>
                <dd>{share(pickedRow.won, pickedRow.rounds)}%</dd>
              </div>
              <div className="main">
                <dt>По игрокам</dt>
                <dd>{number(pickedRow.playerAvg)}</dd>
              </div>
              <div>
                <dt>По раундам</dt>
                <dd>{number(pickedRow.avg)}</dd>
              </div>
              <div>
                <dt>Медиана</dt>
                <dd>{number(pickedRow.median)}</dd>
              </div>
            </dl>
          )}

          {sorted === null ? (
            <p className="diff-wait muted">Загрузка…</p>
          ) : sorted.length === 0 ? (
            <p className="diff-wait muted">Нет раундов</p>
          ) : (
            <div className="activity-scroll">
              <table className="activity-table diff-characters">
                <thead>
                  <tr>
                    {head('name', 'Персонаж')}
                    {head('rounds', 'Раундов')}
                    {head('players', 'Игроков')}
                    {head('win', 'Угадали')}
                    {head('skip', 'Сдались', 'Пропустили или кончились попытки')}
                    {head('first', 'С первой')}
                    {head('playerAvg', 'По игрокам')}
                    {head('avg', 'По раундам')}
                    {head('median', 'Медиана')}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => {
                    const base = pickedRow?.playerAvg ?? null
                    const tone =
                      row.rounds < FEW_CHARACTER || row.playerAvg === null || base === null
                        ? ''
                        : row.playerAvg >= base * 1.25
                          ? 'hard'
                          : row.playerAvg <= base * 0.8
                            ? 'easy'
                            : ''
                    return (
                      <tr key={row.id} className={row.rounds < FEW_CHARACTER ? 'diff-few' : ''}>
                        <td>
                          <span className="diff-who">
                            <Thumb game={gameById(picked.game)} entity={{ ...row, answer: true } as Entity} className="diff-thumb" />
                            <span>
                              {name(row)}
                              {row.gone && <em> удалён</em>}
                            </span>
                          </span>
                        </td>
                        <td>{row.rounds}</td>
                        <td>{row.players}</td>
                        <td>{share(row.won, row.rounds)}%</td>
                        <td>{share(row.skipped + row.lost, row.rounds)}%</td>
                        <td>{row.won ? `${share(row.first, row.won)}%` : '—'}</td>
                        <td className={`diff-main ${tone}`}>
                          <span className="diff-value">
                            <span className="diff-track">
                              <i style={{ width: `${row.playerAvg === null || !top ? 0 : Math.min(100, Math.round((row.playerAvg / top) * 100))}%` }} />
                            </span>
                            <b>{number(row.playerAvg)}</b>
                          </span>
                        </td>
                        <td>{number(row.avg)}</td>
                        <td>{number(row.median)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
