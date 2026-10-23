'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { api } from './api'
import BackButton from './BackButton'
import BoardScope from './BoardScope'
import { useI18n, type UiKey } from './i18n'
import { useHref } from './router'
import { keepPerUser } from './session-cache'
import Avatar from './Avatar'
import BoardFace from './BoardFace'
import { useAuth } from './auth'
import { MARKS } from './Profile'
import { bannerPic, bannerSpot } from './banners'

type Row = {
  id: string
  rank: number
  nickname: string
  avatar?: string | null
  frame?: string | null
  banner?: string | null
  title?: string | null
  level: number
  xp: number
  solved: number
  days: number
  me: boolean
}

type Board = {
  season: { number: number; from: string; to: string }
  total: number
  rows: Row[]
  me: Row | null
  toTop: number
}

const PRIZES = [
  { place: 'lb.reward1' as UiKey, title: 'champion', frame: 'top1', tone: 'gold' },
  { place: 'lb.reward10' as UiKey, title: 'runner', frame: null, tone: 'silver' },
  { place: 'lb.reward100' as UiKey, title: 'hundred', frame: null, tone: 'bronze' },
]

const PAGE = 15
const TOP = 100

let known: Board | null = null

keepPerUser(() => {
  known = null
})

export default function SeasonBoard() {
  const { t, lang, error: errorText } = useI18n()
  const { user } = useAuth()
  const href = useHref()
  const [board, setBoard] = useState<Board | null>(known)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [size, setSize] = useState(PAGE)

  useEffect(() => {
    let cancelled = false
    api<Board>('season')
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) {
          known = data
          setBoard(data)
        } else setError(data.error ?? 'server')
      })
      .catch(() => !cancelled && setError('network'))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const season = board?.season
  const from = season ? new Date(season.from) : null
  const to = season ? new Date(season.to) : null
  const day = (date: Date) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : `${lang}-UA`, { day: 'numeric', month: 'short' }).format(date)
  const span = from && to ? Math.max(1, to.getTime() - from.getTime()) : 1
  const length = Math.round(span / 86_400_000)
  const gone = from ? Math.min(1, Math.max(0, (now - from.getTime()) / span)) : 0
  const parts = Math.min(14, Math.max(2, length))
  const done = Math.min(parts, Math.max(1, Math.ceil(gone * parts)))


  const rows = board?.rows ?? []
  const peak = Math.max(1, ...rows.map((row) => row.xp))
  const waiting = !board && !error
  const podium = rows.length > 0 || waiting ? [rows[0] ?? null, rows[1] ?? null, rows[2] ?? null] : []
  const medals = ['gold', 'silver', 'bronze']
  const stand = [0, 1, 2]
  const count = (value: number) => value.toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA')
  const ranked = rows.slice(0, TOP)
  const rest = ranked.slice(podium.length ? 3 : 0)
  const shown = rest.slice(0, size)
  const left = rest.length - shown.length
  const outside = board?.me && board.me.rank > TOP ? board.me : null

  return (
    <div className="leaderboard season-board">
      <div className="lb-top">
        <header className="lb-head">
          <BackButton href={href.home}>{t('play.back')}</BackButton>
          <h1>{t('lb.seasonTitle')}</h1>
          <p className="muted">{t('lb.seasonHint')}</p>
        </header>
        <BoardScope scope="season" />
      </div>

      <section className="season-card">
        <div className="season-left">
          <div className="season-head">
            <div className="season-copy">
              <b>{season ? t('lb.seasonNo', { number: season.number }) : ' '}</b>
              <p>{from && to ? `${day(from)} — ${day(new Date(to.getTime() - 86_400_000))}` : ''}</p>
            </div>
          </div>
        </div>

        <ul className="season-rewards">
          {PRIZES.map((prize) => (
            <li key={prize.title} className={prize.tone}>
              {prize.frame && (
                <Avatar className="season-prize-face" id={user?.id} name={user?.nickname ?? '?'} avatar={user?.avatar} frame={prize.frame} />
              )}
              <span className="season-prize-what">
                <b>{t(prize.place)}</b>
                <i className={`player-title is-slim is-${prize.title}`}>{t(`title.${prize.title}` as UiKey)}</i>
              </span>
            </li>
          ))}
        </ul>

        <div className="season-sticks" aria-hidden>
          {Array.from({ length: parts }, (_, index) => (
            <i key={index} className={index < done - 1 ? 'is-done' : index === done - 1 ? 'is-now' : ''} />
          ))}
        </div>
      </section>

      <div className="lb-layout">
        <section className="lb-main">
          {podium.length > 0 && (
            <ol className={`lb-podium is-cards ${waiting ? 'waiting' : ''}`}>
              {stand.map((index) => {
                const row = podium[index]
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
                    <Link
                      className="lb-step-open"
                      href={row.me ? href.profile : href.player(row.id)}
                      aria-label={row.nickname}
                      prefetch={false}
                    />
                    <span className="lb-step-face">
                      <BoardFace id={row.id} nickname={row.nickname} avatar={row.avatar} frame={row.frame} big />
                    </span>
                    <span className="lb-step-text">
                      <span className="lb-step-who">
                        <b className="lb-step-name">{row.nickname}</b>
                        {row.title && <i className={`player-title is-slim is-${row.title}`}>{t(`title.${row.title}` as UiKey)}</i>}
                      </span>
                      <span className="lb-step-sub">
                        {row.solved} <i className="lb-step-unit">{t('lb.shortSolved')}</i> · {row.days}/{length}{' '}
                        <i className="lb-step-unit">{t('lb.colDays')}</i>
                      </span>
                    </span>
                    <span className="lb-step-main">
                      {(() => {
                        const shownXp = row.xp.toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA')
                        return <em style={{ '--len': shownXp.length } as CSSProperties}>{shownXp}</em>
                      })()}
                      <i className="lb-step-unit">{t('lb.colXp')}</i>
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
          {error ? (
            <div className="lb-state">{errorText(error)}</div>
          ) : board && rows.length === 0 ? (
            <div className="lb-state">{t('lb.seasonEmpty')}</div>
          ) : (
            <div className="lb-card">
              <div className="lb-scroll season-scroll">
                <table className="lb-table season-table">
                <thead>
                  <tr>
                    <th className="lb-rank">#</th>
                    <th>{t('lb.player')}</th>
                    <th className="season-xp-col">{t('lb.colXp')}</th>
                    <th className="lb-num">{t('lb.shortSolved')}</th>
                    <th className="lb-num">{t('lb.colDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(board ? shown : Array.from({ length: PAGE }, () => null)).map((row, index) =>
                    row ? (
                      <tr key={row.rank} className={row.me ? 'me' : ''}>
                        <td className="lb-rank">
                          <span className={`season-rank ${row.rank <= 3 ? ['gold', 'silver', 'bronze'][row.rank - 1] : ''}`}>{row.rank}</span>
                        </td>
                        <td className="lb-name">
                          <Link className="lb-player" href={row.me ? href.profile : href.player(row.id)} prefetch={false}>
                            <BoardFace id={row.id} nickname={row.nickname} avatar={row.avatar} frame={row.frame} />
                            <span className="lb-who">
                              <span className="lb-nick">{row.nickname}</span>
                              {row.title && <i className={`player-title is-slim is-${row.title}`}>{t(`title.${row.title}` as UiKey)}</i>}
                            </span>
                          </Link>
                        </td>
                        <td className="season-xp-col">
                          <span className="season-xp">
                            <b>{row.xp.toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA')}</b>
                            <span className="season-bar">
                              <i style={{ width: `${Math.max(4, Math.round((row.xp / peak) * 100))}%` }} />
                            </span>
                          </span>
                        </td>
                        <td className="lb-num">{row.solved}</td>
                        <td className="lb-num">
                          {row.days}
                          <em>/{length}</em>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`skeleton-${index}`} className="lb-skeleton-row">
                        <td>
                          <span className="lb-skeleton is-rank" />
                        </td>
                        <td className="lb-name">
                          <span className="lb-skeleton is-face" />
                          <span className="lb-skeleton is-nick" />
                        </td>
                        <td className="season-xp-col">
                          <span className="lb-skeleton is-xp" />
                        </td>
                        <td className="lb-num">
                          <span className="lb-skeleton is-num" />
                        </td>
                        <td className="lb-num">
                          <span className="lb-skeleton is-num" />
                        </td>
                      </tr>
                    ),
                  )}
                  </tbody>
                </table>
              </div>

              {left > 0 && (
                <div className="lb-more">
                  <button type="button" onClick={() => setSize((one) => one + PAGE)}>
                    {t('lb.more')}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="lb-side">
          {!!board && (
            <section className="card season-me">
              <span className="play-card-title">{t('lb.myPlace')}</span>
              {board.me ? (
                <>
                  <p className="season-place">
                    <b>#{board.me.rank}</b>
                    <em>{t('lb.ofPlayers', { total: count(board.total) })}</em>
                  </p>
                  {outside && board.toTop > 0 && (
                    <p className="season-gap">
                      {t('lb.toTop100')} — {t('lb.moreXp', { xp: count(board.toTop) })}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="season-place is-none">
                    <b>—</b>
                    <em>{t('lb.ofPlayers', { total: count(board.total) })}</em>
                  </p>
                  <p className="season-gap">{t('lb.noPlace')}</p>
                </>
              )}
            </section>
          )}

          <section className="card season-how">
            <span className="play-card-title">{t('lb.howTitle')}</span>
            <ol>
              <li>
                <i>1</i>
                {t('lb.how1')}
              </li>
              <li>
                <i>2</i>
                {t('lb.how2')}
              </li>
              <li>
                <i>3</i>
                {t('lb.how3')}
              </li>
            </ol>
          </section>
        </aside>
      </div>

    </div>
  )
}
