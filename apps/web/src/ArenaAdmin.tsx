'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { ARENA_GAMES, ARENA_TIERS } from '@nanda/game'
import AdminNav from './AdminNav'
import { api } from './api'
import { gameById } from './games'
import type { Entity, GameId } from './games/types'
import { useI18n } from './i18n'
import Thumb from './Thumb'

type Row = Entity & { tier: number; atk: number; hp: number; locked: boolean; edited: boolean }

const DEFAULTS: Record<number, [number, number]> = {
  0: [5, 5],
  1: [3, 4],
  2: [5, 5],
  3: [6, 7],
  4: [8, 8],
  5: [9, 10],
  6: [11, 12],
}

const BANDS: Record<number, string> = {
  0: 'не випадають у таверні',
  1: 'академія й геніни · сума 7',
  2: 'чуніни · сума 10',
  3: 'джоніни · сума 13',
  4: 'еліта, Акацукі, джинчурікі · сума 16',
  5: 'Каге й легенди · сума 19',
  6: 'боги · сума 23',
}

const BANDS_ORDER = [...Array.from({ length: ARENA_TIERS }, (_, i) => ARENA_TIERS - i), 0]

export default function ArenaAdmin() {
  const { name } = useI18n()
  const gameId = ARENA_GAMES[0] as GameId
  const game = gameById(gameId)
  const [list, setList] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [held, setHeld] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await api<{ list?: Row[] }>(`admin/arena?game=${gameId}`)
    setList(data.list ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    (id: number, tier: number, atk: number, hp: number) => {
      setList((now) => now.map((row) => (row.id === id ? { ...row, tier, atk, hp, edited: true } : row)))
      void api('admin/arena', { game: gameId, id, tier, atk, hp })
    },
    [gameId],
  )

  const move = useCallback(
    (id: number, tier: number) => {
      setMenu(null)
      setList((now) => {
        const row = now.find((one) => one.id === id)
        if (!row || row.tier === tier) return now
        const [atk, hp] = DEFAULTS[tier] ?? [4, 4]
        void api('admin/arena', { game: gameId, id, tier, atk, hp })
        return now.map((one) => (one.id === id ? { ...one, tier, atk, hp, edited: true } : one))
      })
    },
    [gameId],
  )

  useEffect(() => {
    if (!menu) return
    const shut = () => setMenu(null)
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', shut)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', shut)
      window.removeEventListener('scroll', shut, true)
      window.removeEventListener('keydown', key)
    }
  }, [menu])

  const drop = (tier: number) => (event: DragEvent) => {
    event.preventDefault()
    setOver(null)
    setHeld(null)
    move(Number(event.dataTransfer.getData('text/plain')), tier)
  }

  const hunt = query.trim().toLowerCase()
  const bands = useMemo(() => {
    const out = new Map<number, Row[]>(BANDS_ORDER.map((tier) => [tier, []]))
    for (const row of list) out.get(row.tier)?.push(row)
    for (const rows of out.values())
      rows.sort((a, b) => b.atk + b.hp - (a.atk + a.hp) || a.id - b.id)
    return out
  }, [list])

  return (
    <div className="admin">
      <AdminNav />
      <header className="admin-head">
        <h1>Арена · тіри</h1>
        <input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук персонажа" />
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Оновити
        </button>
      </header>

      {loading ? (
        <p className="admin-note">Завантажуємо…</p>
      ) : (
        <div className="ara-list">
          {BANDS_ORDER.map((tier) => {
            const rows = bands.get(tier) ?? []
            return (
              <section
                key={tier}
                className={`ara-band ${over === tier ? 'is-over' : ''} ${tier === 0 ? 'is-out' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOver(tier)
                }}
                onDragLeave={() => setOver((was) => (was === tier ? null : was))}
                onDrop={drop(tier)}
              >
                <header className={`ara-tag lv-${tier}`}>
                  <b>{tier === 0 ? 'Поза пулом' : `Тір ${tier}`}</b>
                  <small>{BANDS[tier]}</small>
                  <i>{rows.length}</i>
                </header>
                <ul>
                  {rows.map((row) => {
                    const dim = !!hunt && !name(row).toLowerCase().includes(hunt)
                    return (
                      <li
                        key={row.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', String(row.id))
                          setHeld(row.id)
                        }}
                        onDragEnd={() => setHeld(null)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          setMenu({ id: row.id, x: event.clientX, y: event.clientY })
                        }}
                        className={`ara-chip ${held === row.id ? 'is-held' : ''} ${dim ? 'is-dim' : ''} ${row.locked ? 'is-locked' : ''}`}
                        title={`${name(row)}${row.locked ? ' · призив або хвостатий, у таверні не випадає' : ''}`}
                      >
                        {game ? <Thumb game={game} entity={row} size={46} /> : null}
                        <span className="ara-stats">
                          <input
                            type="number"
                            className="ara-stat is-atk"
                            value={row.atk}
                            onChange={(event) => save(row.id, row.tier, Number(event.target.value), row.hp)}
                          />
                          <input
                            type="number"
                            className="ara-stat is-hp"
                            value={row.hp}
                            onChange={(event) => save(row.id, row.tier, row.atk, Number(event.target.value))}
                          />
                        </span>
                      </li>
                    )
                  })}
                  {!rows.length && <li className="ara-empty">перетягни сюди</li>}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {menu && (
        <div className="ara-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <b>{name(list.find((one) => one.id === menu.id) ?? ({ name: '' } as Row))}</b>
          {BANDS_ORDER.map((tier) => (
            <button key={tier} type="button" className={`lv-${tier}`} onClick={() => move(menu.id, tier)}>
              {tier === 0 ? 'Поза пулом' : `Тір ${tier}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
