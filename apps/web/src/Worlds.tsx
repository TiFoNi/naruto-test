'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import BackButton from './BackButton'
import { api } from './api'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { CheckIcon } from './icons'
import { useHref } from './router'
import { SHOWCASE_MAX } from './showcase'

type Row = { game: string; pool: number; solved: number }
type Summary = { games: Row[]; showcase: string[] }

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export default function Worlds() {
  const { t, l } = useI18n()
  const href = useHref()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>('profile/summary')
    if (!ok) return setFailed(true)
    setRows(data.games ?? [])
    setPicked(data.showcase ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (id: string) => {
    const next = picked.includes(id) ? picked.filter((one) => one !== id) : picked.length < SHOWCASE_MAX ? [...picked, id] : picked
    if (next === picked) return
    const kept = picked
    setPicked(next)
    const { ok } = await api('profile', { action: 'showcase', showcase: next })
    if (!ok) {
      setPicked(kept)
      setFailed(true)
    }
  }

  return (
    <div className="worlds-page">
      <div className="worlds-top">
        <header className="lb-head">
          <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
          <h1>{t('worlds.title')}</h1>
          <p className="muted">{t('worlds.lead', { count: SHOWCASE_MAX })}</p>
        </header>
        <span className="worlds-counter">{t('worlds.picked', { count: picked.length, max: SHOWCASE_MAX })}</span>
      </div>

      {failed && <p className="notice worlds-failed">{t('err.server')}</p>}

      {!rows && failed ? (
        <div className="card center muted">{t('err.server')}</div>
      ) : (
        <ul className="world-shelf is-all">
          {(rows ?? Array.from({ length: 12 }, () => null)).map((row, index) => {
            if (!row)
              return (
                <li key={`ghost-${index}`}>
                  <span className="sk world-pic" />
                </li>
              )
            const game = GAMES.find((one) => one.id === row.game)
            const share = percent(row.solved, row.pool)
            const on = picked.includes(row.game)
            const full = !on && picked.length >= SHOWCASE_MAX

            return (
              <li key={row.game} className={on ? 'is-picked' : ''} style={{ '--world-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}>
                <Link href={href.world(row.game as GameId)} prefetch={false}>
                  <img
                    className="world-pic"
                    src={`/worlds/big/${row.game}.webp`}
                    alt=""
                    width={448}
                    height={448}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <span className="world-line">
                    <b>{game ? l(game.label) : row.game}</b>
                    <em>{share}%</em>
                  </span>
                  <span className="world-bar">
                    <i style={{ width: `${Math.max(share, 2)}%`, background: game?.accent ?? 'var(--accent)' }} />
                  </span>
                </Link>
                <button
                  type="button"
                  className={`world-pin ${on ? 'on' : ''}`}
                  disabled={full}
                  title={t(on ? 'worlds.unpin' : full ? 'worlds.full' : 'worlds.pin', { max: SHOWCASE_MAX })}
                  aria-label={t(on ? 'worlds.unpin' : 'worlds.pin')}
                  aria-pressed={on}
                  onClick={() => void toggle(row.game)}
                >
                  <CheckIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
