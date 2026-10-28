'use client'

import AdminNav from './AdminNav'
import { useCallback, useEffect, useState } from 'react'
import Avatar from './Avatar'
import { api } from './api'
import { useI18n, type UiKey } from './i18n'

type Player = {
  id: string
  nickname: string
  tag: string | null
  avatar: string | null
  frame: string | null
  titles: string[]
  title: string | null
}

export default function TitleAdmin() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [titles, setTitles] = useState<string[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')

  const load = useCallback(async (ask: string) => {
    setLoading(!!ask)
    const { ok, data } = await api<{ titles: string[]; players: Player[] }>(`admin/titles?q=${encodeURIComponent(ask)}`)
    setLoading(false)
    if (!ok) return
    setTitles(data.titles ?? [])
    setPlayers(data.players ?? [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim()), query.trim() ? 250 : 0)
    return () => clearTimeout(timer)
  }, [query, load])

  const flip = async (one: Player, title: string) => {
    const give = !one.titles.includes(title)
    setBusy(`${one.id}:${title}`)
    const { ok, data } = await api<{ titles: string[]; title: string | null }>('admin/titles', { id: one.id, title, give })
    setBusy('')
    if (ok) setPlayers((now) => now.map((row) => (row.id === one.id ? { ...row, titles: data.titles ?? [], title: data.title ?? null } : row)))
  }

  const chip = (title: string, slim = false) => (
    <i className={`player-title ${slim ? 'is-slim' : ''} is-${title}`}>{t(`title.${title}` as UiKey)}</i>
  )

  return (
    <div className="admin title-admin">
      <AdminNav />
      <header className="admin-head">
        <h1>Титулы</h1>
        <p className="muted">Ищи по нику, части ника, #тегу или id. Клик по титулу выдаёт, повторный — снимает.</p>
      </header>

      {!!titles.length && (
        <div className="title-admin-deck">
          <span className="title-admin-deck-label">все титулы</span>
          <div className="title-admin-deck-row">{titles.map((title) => <span key={title}>{chip(title)}</span>)}</div>
        </div>
      )}

      <input className="admin-find" value={query} placeholder="ник, #TAG или id" onChange={(event) => setQuery(event.target.value)} />

      {loading && <p className="muted title-admin-state">Ищем…</p>}
      {!loading && !!query.trim() && !players.length && <p className="muted title-admin-state">Никого не нашли</p>}
      {!loading && !query.trim() && <p className="muted title-admin-state">Начни вводить ник</p>}

      <ul className="title-admin-list">
        {players.map((one) => (
          <li key={one.id}>
            <Avatar id={one.id} name={one.nickname} avatar={one.avatar} frame={one.frame} />
            <span className="title-admin-who">
              <b>{one.nickname}</b>
              {one.tag && <em>#{one.tag}</em>}
              {one.title ? <span className="title-admin-worn">носит {chip(one.title, true)}</span> : <em className="title-admin-none">без титула</em>}
            </span>
            <span className="title-admin-pins">
              {titles.map((title) => {
                const has = one.titles.includes(title)
                return (
                  <button
                    key={title}
                    type="button"
                    className={`title-admin-pin ${has ? 'on' : ''}`}
                    disabled={busy === `${one.id}:${title}`}
                    title={has ? 'снять титул' : 'выдать титул'}
                    onClick={() => void flip(one, title)}
                  >
                    {chip(title, true)}
                  </button>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
