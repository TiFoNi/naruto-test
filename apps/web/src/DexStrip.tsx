'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { useEntities } from './entities'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { ArrowIcon, BookIcon } from './icons'
import { cardUrl, miniUrl } from './pics'
import { useHref } from './router'
import { torn } from './torn'

const PEEK = 3
const TILT = [-7, 1, 6]

const shuffle = (list: Entity[]) => [...list].sort((a, b) => ((a.id * 7919) % 997) - ((b.id * 7919) % 997))

export default function DexStrip({ game }: { game: Game }) {
  const { t } = useI18n()
  const href = useHref()
  const { user, loading: checking } = useAuth()
  const ready = useEntities(game)
  const [ids, setIds] = useState<number[] | null>(null)

  useEffect(() => {
    if (checking) return
    if (!user) {
      setIds([])
      return
    }
    let alive = true
    void api<{ ids?: number[] }>(`dex?game=${game.id}`).then(({ ok, data }) => {
      if (alive) setIds(ok ? (data.ids ?? []) : [])
    })
    return () => {
      alive = false
    }
  }, [game, user, checking])

  const cast = useMemo(() => (game.entities ?? []).filter((one) => one.answer), [game, ready])
  const known = useMemo(() => new Set(ids ?? []), [ids])
  const total = cast.length
  const got = cast.filter((one) => known.has(one.id)).length

  const peek = useMemo(() => {
    if (!ids || !cast.length) return []
    const byId = new Map(cast.map((one) => [one.id, one]))
    const recent = [...ids]
      .reverse()
      .map((id) => byId.get(id))
      .filter((one): one is Entity => !!one)
    const hidden = shuffle(cast.filter((one) => !known.has(one.id)))
    const shown = recent.slice(0, hidden.length ? PEEK - 1 : PEEK).map((one) => ({ one, open: true }))
    const fog = hidden.slice(0, PEEK - shown.length).map((one) => ({ one, open: false }))
    return [...shown, ...fog]
  }, [ids, cast, known])

  return (
    <Link className="world-dex" href={href.bestiary(game.id)} prefetch={false}>
      <span className="world-dex-icon">
        <BookIcon />
      </span>
      <span className="world-dex-body">
        <b>{t('dex.title')}</b>
        <small>{total && ids ? t('dex.count', { got, total }) : ' '}</small>
      </span>
      <span className="world-dex-peek" aria-hidden>
        {peek.map(({ one, open }, index) => (
          <span key={one.id} className={`world-dex-card ${open ? '' : 'is-locked'}`} style={{ '--tilt': `${TILT[index]}deg` } as CSSProperties}>
            <i className="world-dex-paper" style={{ clipPath: torn(one.id, 6, 6) }} />
            <span className="world-dex-pic" style={{ clipPath: torn(one.id * 3 + 1, 5, 5) }}>
              <img src={open ? cardUrl(game.id, one.id, one.image) : miniUrl(game.id, one.id, one.image)} alt="" decoding="async" draggable={false} />
            </span>
            {!open && <em>?</em>}
          </span>
        ))}
      </span>
      <ArrowIcon className="world-dex-go" />
    </Link>
  )
}
