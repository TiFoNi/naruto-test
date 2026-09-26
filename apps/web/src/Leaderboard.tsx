import Link from 'next/link'
import BackButton from './BackButton'
import BoardScope from './BoardScope'
import { useEffect, useState } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { useNavigate, useHref } from './router'
import { keepPerUser } from './session-cache'
import Picker from './Picker'
import { ChevronIcon, CrownIcon, PlayIcon, ShieldIcon, SortIcon, TrophyIcon } from './icons'

type Sort = 'best' | 'solved'

type Row = {
  rank: number
  nickname: string
  me: boolean
  level?: number
  solved?: number
  best?: number
}

type Board = { rows: Row[]; me: Row | null; total: number }

type Column = {
  label: UiKey
  short: UiKey
  sort: Sort
  raw: (row: Row) => number
  value: (row: Row) => number
}

const TONES = 8

const toneOf = (nickname: string) => {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) % 9973
  return hash % TONES
}

const COLUMNS: Column[] = [
  { label: 'lb.colBest', short: 'lb.shortBest', sort: 'best', raw: (r) => r.best ?? 0, value: (r) => r.best ?? 0 },
  { label: 'lb.colSolved', short: 'lb.shortSolved', sort: 'solved', raw: (r) => r.solved ?? 0, value: (r) => r.solved ?? 0 },
]

const PAGE_SIZE = 10
const SKELETON_ROWS = PAGE_SIZE
const TOP = 10
const lastSize = new Map<string, number>()
const known = new Map<string, Board>()

function Avatar({ nickname, className }: { nickname: string; className?: string }) {
  return (
    <span className={`lb-av ${className ?? ''}`} data-tone={toneOf(nickname)} aria-hidden>
      {nickname.charAt(0).toUpperCase()}
    </span>
  )
}

keepPerUser(() => {
  known.clear()
})

export default function Leaderboard({ gameId, mode }: { gameId: GameId; mode: ModeId }) {
  const { t, l, error: errorText } = useI18n()
  const href = useHref()
  const game = gameById(gameId)
  const [sort, setSort] = useState<Sort>('best')
  const [reversed, setReversed] = useState(false)

  const pick = (next: Sort) => {
    if (next === sort) return setReversed((r) => !r)
    setSort(next)
    setReversed(false)
  }
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const cacheKey = `${gameId}:${mode}:${sort}:${reversed ? 'rev' : 'top'}`
  const [board, setBoard] = useState<Board | null>(known.get(cacheKey) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const slow = setTimeout(() => !cancelled && setLoading(true), 300)
    setError(null)
    setBoard(known.get(cacheKey) ?? null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}${reversed ? '&dir=rev' : ''}`)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) {
          known.set(cacheKey, data)
          setBoard(data)
        } else setError(data.error ?? 'server')
        clearTimeout(slow)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('network')
        clearTimeout(slow)
        setLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(slow)
    }
  }, [gameId, mode, sort, reversed])

  useEffect(() => setPage(1), [gameId, mode, sort, reversed])

  useEffect(() => {
    if (board) lastSize.set(`${gameId}:${mode}`, Math.min(board.rows.length, PAGE_SIZE))
  }, [board, gameId, mode])

  const boardKey = `${gameId}:${mode}`
  const columns = COLUMNS
  const active = columns.find((c) => c.sort === sort) ?? columns[0]
  const all = board?.rows ?? []
  const waiting = !board && !error
  const standing = !reversed && all.length > 0
  const podium = standing ? [all[0] ?? null, all[1] ?? null, all[2] ?? null] : waiting && !reversed ? [null, null, null] : []
  const listed = all.slice(standing ? 3 : 0).filter((row) => !row.me)
  const pages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE))
  const shown = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const peak = Math.max(1, ...all.map((r) => active.raw(r)))
  const me = board?.me ?? null
  const tenth = all[TOP - 1]
  const gap = me && tenth && me.rank > TOP ? Math.abs(active.raw(tenth) - active.raw(me)) : 0
  const reach = me && tenth ? active.raw(me) / Math.max(1, active.raw(tenth)) : 0
  const record = all.reduce<Row | null>((top, row) => (!top || (row.best ?? 0) > (top.best ?? 0) ? row : top), null)
  const onPodium = podium.some((row) => row?.me)
  const table = !board || !!error || all.length === 0 || listed.length > 0 || (!!me && !onPodium)
  const medals = ['gold', 'silver', 'bronze']
  const stand = [1, 0, 2]

  return (
    <div className="leaderboard">
      <div className="lb-top">
        <header className="lb-head">
          <BackButton href={href.home}>{t('play.back')}</BackButton>
          <h1>{t('lb.title')}</h1>
          <p className="muted">{t('lb.hint')}</p>
        </header>
        <BoardScope scope="game" game={gameId} mode={mode} />
      </div>

      <div className="lb-filters">
        <Picker
          label={t('duel.game')}
          value={gameId}
          onChange={(next) => {
            const picked = gameById(next as GameId)
            navigate(href.leaderboard(picked.id, picked.modes.includes(mode) ? mode : picked.modes[0]))
          }}
          options={GAMES.map((g) => ({
            value: g.id,
            label: l(g.label),
            accent: g.accent,
          }))}
        />
        <Picker
          label={t('duel.mode')}
          value={mode}
          onChange={(next) => navigate(href.leaderboard(gameId, next as ModeId))}
          options={MODES.filter((m) => game.modes.includes(m.id)).map((m) => ({
            value: m.id,
            label: (
              <>
                {m.icon} {t(m.label)}
              </>
            ),
          }))}
        />
        {board && <span className="lb-count">{t('lb.players', { count: board.total })}</span>}
      </div>

      <div className="lb-layout">
        <section className="lb-main">
          {podium.length > 0 && (
            <ol className={`lb-podium ${waiting ? 'waiting' : ''}`}>
              {stand.map((index) => {
                const row = podium[index]
                const rest = columns.filter((c) => c !== active)
                if (!row)
                  return (
                    <li key={`vacant-${index}`} className={`lb-step vacant ${medals[index]}`}>
                      <span className="lb-step-face">
                        <span className="lb-av big" aria-hidden>
                          ?
                        </span>
                        <span className="lb-step-rank">{index + 1}</span>
                      </span>
                      <b className="lb-step-name">{t('lb.vacant')}</b>
                      <span className="lb-step-main">
                        <em>—</em>
                      </span>
                    </li>
                  )
                return (
                  <li key={row.rank} className={`lb-step ${medals[index]}`}>
                    {index === 0 && <CrownIcon className="lb-crown" />}
                    <span className="lb-step-face">
                      <Avatar nickname={row.nickname} className="big" />
                      <span className="lb-step-rank">{row.rank}</span>
                    </span>
                    <b className="lb-step-name">{row.nickname}</b>
                    <span className="lb-step-main">
                      <em>{active.value(row)}</em>
                      {t(active.short)}
                    </span>
                    <span className="lb-step-sub">
                      {rest.map((c) => (
                        <span key={c.label}>
                          {c.value(row)} {t(c.short)}
                        </span>
                      ))}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          {table && (
            <div className={`lb-card ${loading ? 'loading' : ''}`}>
              {error ? (
                <div className="lb-state">{errorText(error)}</div>
              ) : (
                <div className="lb-scroll">
                  <table className="lb-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('lb.player')}</th>
                        {columns.map((c) => (
                          <th key={c.label} className={c.sort === sort ? 'sorted' : 'sortable'}>
                            <button type="button" onClick={() => pick(c.sort)} title={t('lb.sortMore')}>
                              {t(c.label)}
                              <SortIcon className={c.sort === sort ? (reversed ? 'up' : '') : 'idle'} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!board &&
                        Array.from({ length: lastSize.get(boardKey) ?? SKELETON_ROWS }, (_, i) => (
                          <tr key={`skeleton-${i}`} className="lb-skeleton-row">
                            {Array.from({ length: columns.length + 2 }, (_, c) => (
                              <td key={c}>
                                <span className="lb-skeleton" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      {board && all.length === 0 && (
                        <tr className="lb-blank">
                          <td colSpan={columns.length + 2}>
                            <div className="lb-blank-inner">
                              <span>{t('lb.empty')}</span>
                              <Link className="primary" href={href.play(gameId, mode)}>
                                {t('lb.play')}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                      {shown.map((row) => (
                        <tr key={`${row.rank}-${row.nickname}`} className={row.me ? 'me' : ''}>
                          <td className="lb-rank">{row.rank}</td>
                          <td className="lb-name">
                            <Avatar nickname={row.nickname} />
                            <span className="lb-nick">{row.nickname}</span>
                            {row.level ? <span className="lb-level">{t('nav.level', { level: row.level })}</span> : null}
                            {row.me && <span className="lb-you">{t('lb.you')}</span>}
                          </td>
                          {columns.map((c) => (
                            <td key={c.label} className={c.sort === sort ? 'sorted' : ''}>
                              {c === active ? (
                                <span className="lb-meter">
                                  <em>{c.value(row)}</em>
                                  <span className="lb-bar">
                                    <span
                                      style={{
                                        width: `${Math.round((c.raw(row) / peak) * 100)}%`,
                                      }}
                                    />
                                  </span>
                                </span>
                              ) : (
                                c.value(row)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {me && (
                      <tfoot>
                        <tr className="me">
                          <td className="lb-rank">{me.rank}</td>
                          <td className="lb-name">
                            <Avatar nickname={me.nickname} />
                            <span className="lb-nick">{me.nickname}</span>
                            <span className="lb-you">{t('lb.you')}</span>
                          </td>
                          {columns.map((c) => (
                            <td key={c.label} className={c.sort === sort ? 'sorted' : ''}>
                              {c.value(me)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {pages > 1 && (
                <div className="lb-pager">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label={t('lb.prev')}>
                    <ChevronIcon className="left" />
                  </button>
                  <span>{t('lb.page', { page, pages })}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} aria-label={t('lb.next')}>
                    <ChevronIcon className="right" />
                  </button>
                </div>
              )}
            </div>
          )}

        </section>

        <aside className="lb-side">
          <div className="lb-side-card">
            <span className="lb-side-title">{t('lb.yourPosition')}</span>
            {me ? (
              <>
                <p className="lb-mine">
                  <b>{me.rank}</b>
                  <span>{t('lb.outOf', { total: board?.total ?? 0 })}</span>
                </p>
                <div className="lb-goal">
                  <span>
                    <b>{t('lb.toTop')}</b>
                    <i>{gap ? t('lb.gap', { value: gap }) : t('lb.inTop')}</i>
                  </span>
                  <span className="lb-bar big">
                    <span
                      style={{
                        width: `${Math.min(100, Math.round(reach * 100))}%`,
                      }}
                    />
                  </span>
                </div>
              </>
            ) : (
              <p className="lb-mine empty">{t('lb.noRank')}</p>
            )}
            <Link className="primary lb-cta" href={href.play(gameId, mode)}>
              <PlayIcon /> {t('lb.playGame', { game: l(game.label) })}
            </Link>
          </div>

          {record && (
            <div className="lb-side-card">
              <span className="lb-side-title">{t('lb.record')}</span>
              <p className="lb-record">
                <span className="lb-record-icon">
                  <TrophyIcon />
                </span>
                <span>
                  <b>{record.best ?? 0}</b>
                  <i>
                    {t('lb.shortBest')} · {record.nickname}
                  </i>
                </span>
              </p>
            </div>
          )}

          <p className="lb-fair">
            <ShieldIcon />
            {t('lb.fair')}
          </p>
        </aside>
      </div>
    </div>
  )
}
