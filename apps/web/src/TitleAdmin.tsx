'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Avatar from './Avatar'
import { api } from './api'
import { useI18n, type UiKey } from './i18n'
import { useHref } from './router'

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
  const href = useHref()
  const [query, setQuery] = useState('')
  const [titles, setTitles] = useState<string[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [busy, setBusy] = useState('')

  const load = useCallback(async (ask: string) => {
    const { ok, data } = await api<{ titles: string[]; players: Player[] }>(`admin/titles?q=${encodeURIComponent(ask)}`)
    if (!ok) return
    setTitles(data.titles ?? [])
    setPlayers(data.players ?? [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim()), query.trim() ? 300 : 0)
    return () => clearTimeout(timer)
  }, [query, load])

  const flip = async (one: Player, title: string) => {
    const give = !one.titles.includes(title)
    setBusy(`${one.id}:${title}`)
    const { ok, data } = await api<{ titles: string[] }>('admin/titles', { id: one.id, title, give })
    setBusy('')
    if (ok) setPlayers((now) => now.map((row) => (row.id === one.id ? { ...row, titles: data.titles ?? [] } : row)))
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <h1>Титулы</h1>
        <p className="muted">Найди игрока по нику или #тегу и выдай титул. Снять — повторный клик.</p>
        <Link className="admin-more" href={href.admin}>
          Персонажи
        </Link>
      </header>

      <input className="admin-find" value={query} placeholder="ник или #TAG" onChange={(event) => setQuery(event.target.value)} />

      <ul className="title-admin-list">
        {players.map((one) => (
          <li key={one.id}>
            <Avatar id={one.id} name={one.nickname} avatar={one.avatar} frame={one.frame} />
            <span className="title-admin-who">
              <b>{one.nickname}</b>
              {one.tag && <em>#{one.tag}</em>}
            </span>
            <span className="title-admin-pins">
              {titles.map((title) => (
                <button
                  key={title}
                  type="button"
                  className={`title-pick ${one.titles.includes(title) ? 'on' : ''}`}
                  disabled={busy === `${one.id}:${title}`}
                  onClick={() => void flip(one, title)}
                >
                  {t(`title.${title}` as UiKey)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
