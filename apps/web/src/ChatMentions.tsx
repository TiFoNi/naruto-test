'use client'

import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import { api } from './api'
import { useI18n } from './i18n'

export type Person = { id: string; nickname: string; tag?: string | null; avatar?: string | null; frame?: string | null }

export type MentionPick = { id: string | null; nick: string }

export const EVERYONE_NICK = 'все'

const SEARCH_MS = 250
const SHOWN = 6

type Props = {
  query: string
  friends: Person[]
  me: string | null
  everyone: boolean
  active: number
  onActive: (index: number) => void
  onOptions: (options: MentionPick[]) => void
  onPick: (pick: MentionPick) => void
}

const fits = (person: Person, query: string) => person.nickname.toLowerCase().includes(query.toLowerCase())

export default function ChatMentions({ query, friends, me, everyone, active, onActive, onOptions, onPick }: Props) {
  const { t } = useI18n()
  const [found, setFound] = useState<Person[]>([])
  const [searched, setSearched] = useState('')

  useEffect(() => {
    if (query.length < 2) return setFound([])
    let alive = true
    const timer = window.setTimeout(() => {
      void api<{ players?: Person[] }>('duel', { action: 'players', q: query }).then(({ ok, data }) => {
        if (!alive) return
        setFound(ok ? (data.players ?? []) : [])
        setSearched(query)
      })
    }, SEARCH_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query])

  const known = new Set(friends.map((one) => one.id))
  const mates = friends.filter((one) => one.id !== me && fits(one, query)).slice(0, SHOWN)
  const others = found.filter((one) => one.id !== me && !known.has(one.id)).slice(0, SHOWN)
  const all = everyone && EVERYONE_NICK.startsWith(query.toLowerCase())
  const options: MentionPick[] = [
    ...(all ? [{ id: null, nick: EVERYONE_NICK }] : []),
    ...mates.map((one) => ({ id: one.id, nick: one.nickname })),
    ...others.map((one) => ({ id: one.id, nick: one.nickname })),
  ]
  const signature = options.map((one) => one.id ?? '*').join(',')
  const latest = useRef(options)
  latest.current = options

  useEffect(() => {
    onOptions(latest.current)
  }, [signature, onOptions])

  let at = -1
  const row = (person: Person | null, pick: MentionPick) => {
    at += 1
    const index = at
    return (
      <button
        key={pick.id ?? '*'}
        type="button"
        role="option"
        aria-selected={index === active}
        className={`chat-at-option ${index === active ? 'is-on' : ''}`}
        onMouseEnter={() => onActive(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPick(pick)}
      >
        {person ? (
          <Avatar id={person.id} name={person.nickname} avatar={person.avatar} className="chat-at-face" small />
        ) : (
          <span className="chat-at-face is-all" aria-hidden>
            @
          </span>
        )}
        <b>{person ? person.nickname : `@${EVERYONE_NICK}`}</b>
        {person?.tag ? <small>#{person.tag}</small> : !person && <small>{t('chat.mentionEveryone')}</small>}
      </button>
    )
  }

  return (
    <div className="chat-at-pop" role="listbox" aria-label={t('chat.mentionAct')}>
      {all && row(null, { id: null, nick: EVERYONE_NICK })}
      {mates.map((one) => row(one, { id: one.id, nick: one.nickname }))}
      {others.length > 0 && <span className="chat-at-head">{t('chat.mentionPlayers')}</span>}
      {others.map((one) => row(one, { id: one.id, nick: one.nickname }))}
      {query.length < 2 && <p className="chat-at-hint">{t('chat.mentionHint')}</p>}
      {query.length >= 2 && !options.length && (
        <p className="chat-at-empty">{searched === query ? t('chat.mentionNone', { query }) : t('chat.mentionSearching')}</p>
      )}
    </div>
  )
}
