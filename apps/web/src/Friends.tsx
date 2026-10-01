'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import BackButton from './BackButton'
import { api } from './api'
import { useAuth } from './auth'
import { refreshFeed, watchFeed } from './awards'
import { useI18n } from './i18n'
import { CloseIcon, SearchIcon, SwordsIcon, UserIcon } from './icons'
import { useHref, useNavigate } from './router'

type Mate = { id: string; nickname: string; tag: string | null; at?: string }

type Lists = { friends: Mate[]; requests: Mate[]; sent: Mate[] }

const EMPTY: Lists = { friends: [], requests: [], sent: [] }

function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar small" aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export default function Friends() {
  const { t } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [lists, setLists] = useState<Lists>(EMPTY)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Mate[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [calling, setCalling] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Partial<Lists>>('friends')
    if (!ok) return
    setLists({ friends: data.friends ?? [], requests: data.requests ?? [], sent: data.sent ?? [] })
  }, [])

  useEffect(() => {
    if (!user) return
    void load()
    const stop = watchFeed(() => void load())
    return () => {
      stop()
    }
  }, [load, user])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) return setFound(null)
    let alive = true
    const timer = setTimeout(() => {
      void api<{ players?: Mate[] }>('friends', { action: 'search', q: value }).then(
        ({ ok, data }) => alive && ok && setFound(data.players ?? []),
      )
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  const act = async (action: string, id: string) => {
    setBusy(true)
    await api('friends', { action, id })
    await load()
    void refreshFeed()
    setBusy(false)
  }

  const challenge = async (target: string) => {
    setCalling(true)
    const { ok, data } = await api<{ duel?: { code: string } }>('duel', { action: 'challenge', to: target })
    setCalling(false)
    if (ok && data.duel) navigate(href.duel(data.duel.code))
  }

  const mates = new Set(lists.friends.map((one) => one.id))
  const asked = new Set(lists.sent.map((one) => one.id))
  const incoming = new Set(lists.requests.map((one) => one.id))

  const hint = (one: Mate) =>
    mates.has(one.id) ? t('friends.already') : asked.has(one.id) ? t('friends.sent') : incoming.has(one.id) ? t('friends.accept') : t('friends.add')

  const tap = (one: Mate) => {
    if (mates.has(one.id) || asked.has(one.id)) return
    void act(incoming.has(one.id) ? 'accept' : 'ask', one.id)
  }

  return (
    <div className="mates">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>

      <header className="mates-head">
        <h1>{t('friends.title')}</h1>
        <p className="muted">{t('friends.lead')}</p>
      </header>

      <section className="card mates-search">
        <div className="mates-field">
          <SearchIcon />
          <input
            value={query}
            placeholder={t('friends.searchHint')}
            maxLength={32}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query.length > 0 && (
            <button type="button" className="mates-clear" aria-label={t('friends.clear')} onClick={() => setQuery('')}>
              <CloseIcon />
            </button>
          )}
        </div>
        <small className="mates-tip">{t('friends.searchTip', { tag: user?.tag ? `#${user.tag}` : '#A1B2C' })}</small>

        {found !== null &&
          (found.length ? (
            <ul className="mates-rows">
              {found.map((one) => (
                <li key={one.id}>
                  <Link href={href.player(one.id)} className="mates-who">
                    <Avatar name={one.nickname} />
                    <b>
                      {one.nickname}
                      {one.tag && <i className="player-tag">#{one.tag}</i>}
                    </b>
                  </Link>
                  <button
                    type="button"
                    className={mates.has(one.id) || asked.has(one.id) ? 'ghost' : 'primary'}
                    disabled={busy || mates.has(one.id) || asked.has(one.id)}
                    onClick={() => tap(one)}
                  >
                    {hint(one)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small mates-none">{t('friends.nobody')}</p>
          ))}
      </section>

      {lists.requests.length > 0 && (
        <section className="card mates-box is-asks">
          <header>
            <h2>{t('friends.asks')}</h2>
            <span className="mates-count">{lists.requests.length}</span>
          </header>
          <ul className="mates-rows">
            {lists.requests.map((one) => (
              <li key={one.id}>
                <Link href={href.player(one.id)} className="mates-who">
                  <Avatar name={one.nickname} />
                  <span className="mates-name">
                    <b>
                      {one.nickname}
                      {one.tag && <i className="player-tag">#{one.tag}</i>}
                    </b>
                    <small>{t('friends.wants')}</small>
                  </span>
                </Link>
                <span className="mates-acts">
                  <button type="button" className="primary" disabled={busy} onClick={() => void act('accept', one.id)}>
                    {t('friends.accept')}
                  </button>
                  <button type="button" className="ghost" disabled={busy} onClick={() => void act('decline', one.id)}>
                    {t('friends.decline')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mates-box">
        <header>
          <h2>{t('friends.mine')}</h2>
          <span className="mates-count">{lists.friends.length}</span>
        </header>

        {lists.friends.length ? (
          <ul className="mates-grid">
            {lists.friends.map((one) => (
              <li key={one.id}>
                <Link href={href.player(one.id)} className="mates-who">
                  <Avatar name={one.nickname} />
                  <span className="mates-name">
                    <b>{one.nickname}</b>
                    {one.tag && <small className="player-tag">#{one.tag}</small>}
                  </span>
                </Link>
                <span className="mates-acts">
                  <button type="button" className="ghost mates-duel" disabled={calling} onClick={() => void challenge(one.id)}>
                    <SwordsIcon />
                    {t('friends.duel')}
                  </button>
                  <button
                    type="button"
                    className="ghost mates-drop"
                    aria-label={t('friends.remove')}
                    title={t('friends.remove')}
                    disabled={busy}
                    onClick={() => void act('remove', one.id)}
                  >
                    <CloseIcon />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mates-empty">
            <span className="mates-mark" aria-hidden>
              <UserIcon />
            </span>
            <b>{t('friends.empty')}</b>
            <p className="muted">{t('friends.emptyHint')}</p>
          </div>
        )}
      </section>

      {lists.sent.length > 0 && (
        <section className="card mates-box is-sent">
          <header>
            <h2>{t('friends.outgoing')}</h2>
            <span className="mates-count">{lists.sent.length}</span>
          </header>
          <ul className="mates-rows">
            {lists.sent.map((one) => (
              <li key={one.id}>
                <Link href={href.player(one.id)} className="mates-who">
                  <Avatar name={one.nickname} />
                  <span className="mates-name">
                    <b>
                      {one.nickname}
                      {one.tag && <i className="player-tag">#{one.tag}</i>}
                    </b>
                    <small>{t('friends.waiting')}</small>
                  </span>
                </Link>
                <button type="button" className="ghost" disabled={busy} onClick={() => void act('remove', one.id)}>
                  {t('friends.cancel')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
