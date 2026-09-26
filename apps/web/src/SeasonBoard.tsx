'use client'

import { useEffect, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import BoardScope from './BoardScope'
import { useI18n } from './i18n'
import { useHref } from './router'
import { keepPerUser } from './session-cache'
import { TrophyIcon } from './icons'

type Row = { rank: number; nickname: string; level: number; xp: number; solved: number; days: number; me: boolean }

type Board = {
  season: { number: number; from: string; to: string }
  total: number
  rows: Row[]
  me: Row | null
  toTop: number
}

const TONES = 8

const toneOf = (nickname: string) => {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) % 9973
  return hash % TONES
}

const pad = (value: number) => String(value).padStart(2, '0')

const countdown = (to: number, now: number) => {
  const left = Math.max(0, to - now)
  const days = Math.floor(left / 86_400_000)
  const hours = Math.floor((left % 86_400_000) / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  const seconds = Math.floor((left % 60_000) / 1000)
  return days > 0 ? `${days} д ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

let known: Board | null = null

keepPerUser(() => {
  known = null
})

export default function SeasonBoard() {
  const { t, lang, error: errorText } = useI18n()
  const href = useHref()
  const [board, setBoard] = useState<Board | null>(known)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

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
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const season = board?.season
  const from = season ? new Date(season.from) : null
  const to = season ? new Date(season.to) : null
  const day = (date: Date) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : `${lang}-UA`, { day: 'numeric', month: 'short' }).format(date)
  const span = from && to ? Math.max(1, to.getTime() - from.getTime()) : 1
  const length = Math.round(span / 86_400_000)
  const gone = from ? Math.min(1, Math.max(0, (now - from.getTime()) / span)) : 0

  const rows = board?.rows ?? []
  const me = board?.me ?? null
  const peak = Math.max(1, ...rows.map((row) => row.xp))
  const crowd = (board?.total ?? 0) >= 10
  const share = me && board ? Math.max(1, Math.round((me.rank / Math.max(1, board.total)) * 100)) : 0

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
        <span className="season-mark" aria-hidden>
          <TrophyIcon />
        </span>
        <div className="season-copy">
          <b>{season ? t('lb.seasonNo', { number: season.number }) : ' '}</b>
          <p>{t('lb.seasonAbout')}</p>
        </div>
        <div className="season-time">
          <span className="season-time-head">
            <em>{from ? day(from) : ''}</em>
            <b>{to ? t('lb.seasonLeft', { time: countdown(to.getTime(), now) }) : ' '}</b>
            <em>{to ? day(new Date(to.getTime() - 86_400_000)) : ''}</em>
          </span>
          <span className="season-line">
            <i style={{ width: `${Math.round(gone * 100)}%` }} />
          </span>
        </div>
        <ul className="season-rewards">
          <li className="gold">
            <b>{t('lb.reward1')}</b>
            <small>{t('lb.reward1sub')}</small>
          </li>
          <li className="silver">
            <b>{t('lb.reward10')}</b>
            <small>{t('lb.rewardBadge')}</small>
          </li>
          <li className="bronze">
            <b>{t('lb.reward100')}</b>
            <small>{t('lb.rewardBadge')}</small>
          </li>
        </ul>
      </section>

      <div className="lb-layout">
        <section className="lb-main">
          {board && <span className="lb-count season-count">{t('lb.players', { count: board.total })}</span>}
          {error ? (
            <div className="lb-state">{errorText(error)}</div>
          ) : board && rows.length === 0 ? (
            <div className="lb-state">{t('lb.seasonEmpty')}</div>
          ) : (
            <div className="lb-card">
              <div className="lb-scroll">
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
                  {(board ? rows : Array.from({ length: 10 }, () => null)).map((row, index) =>
                    row ? (
                      <tr key={row.rank} className={row.me ? 'me' : ''}>
                        <td className="lb-rank">
                          <span className={`season-rank ${row.rank <= 3 ? ['gold', 'silver', 'bronze'][row.rank - 1] : ''}`}>{row.rank}</span>
                        </td>
                        <td className="lb-name">
                          <span className="lb-av" data-tone={toneOf(row.nickname)} aria-hidden>
                            {row.nickname.charAt(0).toUpperCase()}
                          </span>
                          <span className="lb-nick">{row.nickname}</span>
                          {row.me && <span className="lb-you">{t('lb.you')}</span>}
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
                        <td colSpan={5}>
                          <span className="lb-skeleton" />
                        </td>
                      </tr>
                    ),
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <aside className="lb-side">
          <section className="card lb-me season-me">
            <span className="play-card-title">{t('lb.yourPosition')}</span>
            {me ? (
              <>
                <p className="season-place">
                  <b>#{me.rank}</b>
                  <span>{t('lb.outOf', { total: board?.total ?? 0 })}</span>
                </p>
                <div className="season-chips">
                  {crowd && <span className="season-chip">{t('lb.topShare', { percent: share })}</span>}
                </div>
                <div className="season-goal">
                  <span>
                    {t('lb.toTop100')}
                    <em>{board && board.toTop > 0 ? t('lb.moreXp', { xp: board.toTop }) : t('lb.inTop100')}</em>
                  </span>
                  <span className="season-line">
                    <i style={{ width: `${board && board.toTop > 0 ? Math.min(96, Math.round((me.xp / (me.xp + board.toTop)) * 100)) : 100}%` }} />
                  </span>
                </div>
              </>
            ) : (
              <p className="muted">{t('lb.seasonNoRank')}</p>
            )}
          </section>

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
