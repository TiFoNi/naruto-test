import Link from 'next/link'
import BackButton from './BackButton'
import BoardScope from './BoardScope'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { Category, GameId } from './games/types'
import WorldMark from './WorldMark'
import { useI18n, type UiKey } from './i18n'
import { MODES, type ModeId } from './modes'
import { useNavigate, useHref } from './router'
import { keepPerUser } from './session-cache'
import Picker from './Picker'
import { ShieldIcon } from './icons'
import BoardFace from './BoardFace'
import { MARKS } from './Profile'
import { bannerPic, bannerSpot } from './banners'

type Sort = 'best' | 'solved'

type Row = {
  id?: string
  rank: number
  nickname: string
  avatar?: string | null
  frame?: string | null
  banner?: string | null
  title?: string | null
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

const CATEGORY_LABEL: Record<Category, UiKey> = {
  anime: 'dash.anime',
  manga: 'dash.mangaTitle',
  cartoon: 'dash.cartoon',
  games: 'dash.games',
  screen: 'dash.screen',
  sport: 'dash.sport',
}

const COLUMNS: Column[] = [
  { label: 'lb.colBest', short: 'lb.shortBest', sort: 'best', raw: (r) => r.best ?? 0, value: (r) => r.best ?? 0 },
  { label: 'lb.colSolved', short: 'lb.shortSolved', sort: 'solved', raw: (r) => r.solved ?? 0, value: (r) => r.solved ?? 0 },
]

const PAGE_SIZE = 10
const SKELETON_ROWS = PAGE_SIZE
const lastSize = new Map<string, number>()
const known = new Map<string, Board>()

keepPerUser(() => {
  known.clear()
})

export default function Leaderboard({ gameId, mode }: { gameId: GameId; mode: ModeId }) {
  const { t, l, error: errorText } = useI18n()
  const href = useHref()
  const game = gameById(gameId)
  const sort: Sort = 'best'
  const navigate = useNavigate()
  const [size, setSize] = useState(PAGE_SIZE)
  const more = useRef<HTMLDivElement>(null)
  const cacheKey = `${gameId}:${mode}:${sort}`
  const [board, setBoard] = useState<Board | null>(known.get(cacheKey) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const slow = setTimeout(() => !cancelled && setLoading(true), 300)
    setError(null)
    setBoard(known.get(cacheKey) ?? null)
    api<Board>(`leaderboard?game=${gameId}&mode=${mode}&sort=${sort}`)
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
  }, [gameId, mode, sort])

  useEffect(() => setSize(PAGE_SIZE), [gameId, mode])

  useEffect(() => {
    if (board) lastSize.set(`${gameId}:${mode}`, Math.min(board.rows.length, PAGE_SIZE))
  }, [board, gameId, mode])

  useEffect(() => {
    const node = more.current
    if (!node) return
    const watch = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setSize((one) => one + PAGE_SIZE), { rootMargin: '200px' })
    watch.observe(node)
    return () => watch.disconnect()
  }, [size, board])

  const boardKey = `${gameId}:${mode}`
  const columns = COLUMNS
  const active = columns.find((c) => c.sort === sort) ?? columns[0]
  const all = board?.rows ?? []
  const waiting = !board && !error
  const standing = all.length > 0
  const podium = standing ? [all[0] ?? null, all[1] ?? null, all[2] ?? null] : waiting ? [null, null, null] : []
  const listed = all
  const shown = listed.slice(0, size)
  const left = listed.length - shown.length
  const peak = Math.max(1, ...all.map((r) => active.raw(r)))
  const table = !board || !!error || all.length === 0 || listed.length > 0
  const medals = ['gold', 'silver', 'bronze']
  const stand = [0, 1, 2]

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
          rich
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
            hint: `${t('lb.world').toUpperCase()} · ${t(CATEGORY_LABEL[g.category])}`,
            media: <WorldMark game={g.id} className="picker-mark" style={{ '--tab-accent': g.accent } as CSSProperties} />,
          }))}
        />
        <Picker
          rich
          label={t('duel.mode')}
          value={mode}
          onChange={(next) => navigate(href.leaderboard(gameId, next as ModeId))}
          options={MODES.filter((m) => game.modes.includes(m.id)).map((m) => ({
            value: m.id,
            label: t(m.label),
            hint: `${t('duel.mode').toUpperCase()} · ${l(game.label)}`,
            media: (
              <span className="picker-mark" style={{ '--tab-accent': game.accent } as CSSProperties} aria-hidden>
                {m.icon}
              </span>
            ),
          }))}
        />
      </div>

      <div className="lb-layout">
        <section className="lb-main">
          {podium.length > 0 && (
            <ol className={`lb-podium is-cards ${waiting ? 'waiting' : ''}`}>
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
                      </span>
                      <span className="lb-step-text">
                        <b className="lb-step-name">{t('lb.vacant')}</b>
                        <span className="lb-step-main">
                          <em>—</em>
                        </span>
                      </span>
                      <span className="lb-step-rank">
                        <i className="lb-step-top">{t('lb.topWord')} </i>
                        {index + 1}
                      </span>
                    </li>
                  )
                return (
                  <li key={row.rank} className={`lb-step ${medals[index]} has-art`}>
                    <span className="lb-step-art" aria-hidden>
                      {row.banner ? (
                        <img src={bannerPic(row.banner)} alt="" style={{ objectPosition: bannerSpot(row.banner) }} />
                      ) : (
                        <i className="mini-me-marks lb-step-marks">
                          {MARKS.map((mark) => (
                            <em
                              key={mark.left}
                              style={
                                {
                                  left: mark.left,
                                  top: mark.top,
                                  fontSize: Math.round(mark.size * 0.34),
                                  transform: `translate(-50%, -50%) rotate(${mark.tilt}deg)`,
                                } as CSSProperties
                              }
                            >
                              ?!
                            </em>
                          ))}
                        </i>
                      )}
                    </span>
                    {row.id && (
                      <Link
                        className="lb-step-open"
                        href={row.me ? href.profile : href.player(row.id)}
                        aria-label={row.nickname}
                        prefetch={false}
                      />
                    )}
                    <span className="lb-step-face">
                      <BoardFace id={row.id} nickname={row.nickname} avatar={row.avatar} frame={row.frame} big />
                    </span>
                    <span className="lb-step-text">
                      <span className="lb-step-who">
                        <b className="lb-step-name">{row.nickname}</b>
                        {row.title && <i className={`player-title is-slim is-${row.title}`}>{t(`title.${row.title}` as UiKey)}</i>}
                      </span>
                      <span className="lb-step-sub">
                        {rest.map((c, spot) => (
                          <span key={c.label}>
                            {spot > 0 ? ' · ' : ''}
                            {c.value(row)} <i className="lb-step-unit">{t(c.short)}</i>
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="lb-step-main">
                      <em style={{ '--len': String(active.value(row)).length } as CSSProperties}>{active.value(row)}</em>
                      <i className="lb-step-unit">{t(active.short)}</i>
                    </span>
                    <span className="lb-step-rank">
                      <i className="lb-step-top">{t('lb.topWord')} </i>
                      {row.rank}
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
                          <th key={c.label} className={c === active ? 'sorted' : ''}>
                            {t(c.label)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!board &&
                        Array.from({ length: lastSize.get(boardKey) ?? SKELETON_ROWS }, (_, i) => (
                          <tr key={`skeleton-${i}`} className="lb-skeleton-row">
                            <td>
                              <span className="lb-skeleton is-rank" />
                            </td>
                            <td className="lb-name">
                              <span className="lb-skeleton is-face" />
                              <span className="lb-skeleton is-nick" />
                            </td>
                            {columns.map((column) => (
                              <td key={column.label}>
                                <span className="lb-skeleton is-num" />
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
                          <td className="lb-rank">#{row.rank}</td>
                          <td className="lb-name">
                            <Link className="lb-player" href={row.me || !row.id ? href.profile : href.player(row.id)} prefetch={false}>
                              <BoardFace id={row.id} nickname={row.nickname} avatar={row.avatar} frame={row.frame} />
                              <span className="lb-nick">{row.nickname}</span>
                            </Link>
                            {row.title && <i className={`player-title is-slim is-${row.title}`}>{t(`title.${row.title}` as UiKey)}</i>}
                            {row.level ? <span className="lb-level">{t('nav.level', { level: row.level })}</span> : null}
                          </td>
                          {columns.map((c) => (
                            <td key={c.label} className={c === active ? 'sorted' : ''}>
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
                  </table>
                </div>
              )}

              {left > 0 && (
                <div className="lb-more" ref={more}>
                  <button type="button" onClick={() => setSize((one) => one + PAGE_SIZE)}>
                    {t('lb.more')}
                  </button>
                </div>
              )}
            </div>
          )}

        </section>

        <aside className="lb-side">
          <div className="lb-side-card lb-how">
            <span className="lb-side-title">{t('lb.howTitle')}</span>
            <ol>
              <li>
                <i>1</i>
                {t('lb.gameHow1')}
              </li>
              <li>
                <i>2</i>
                {t('lb.gameHow2')}
              </li>
              <li>
                <i>3</i>
                {t('lb.gameHow3')}
              </li>
            </ol>
            <Link className="primary lb-cta" href={href.play(gameId, mode)} title={t('lb.playGame', { game: l(game.label) })}>
              <span>{t('lb.play')}</span>
            </Link>
          </div>

          <p className="lb-fair">
            <ShieldIcon />
            {t('lb.fair')}
          </p>
        </aside>
      </div>
    </div>
  )
}
