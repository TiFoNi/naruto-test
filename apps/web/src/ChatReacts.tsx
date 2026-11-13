'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { PATRON_REACTIONS, REACTIONS, type Reaction } from '@nanda/game'
import { useI18n, type UiKey } from './i18n'

export type ReactLine = { kind: Reaction; people: { id: string; nick: string }[] }

export type Me = { id: string; nickname: string }

export const REACT_FACE: Record<Reaction, string> = { like: '👍', laugh: '😂', puke: '🤮', heart: '❤️', cry: '😭', meh: '😑' }

export const QUICK_REACT: Reaction = 'like'

const lineNode = (id: string) => document.getElementById(`chat-line-${id}`)

export function useGrowUp(feed: { current: HTMLElement | null }, after: unknown) {
  const pin = useRef<{ id: string; bottom: number } | null>(null)

  useLayoutEffect(() => {
    const kept = pin.current
    pin.current = null
    const box = feed.current
    const node = kept && lineNode(kept.id)
    if (!kept || !box || !node) return
    box.scrollTop += node.getBoundingClientRect().bottom - kept.bottom
  }, [feed, after])

  return (id: string) => {
    const box = feed.current
    const node = lineNode(id)
    if (!box || !node) return
    const place = node.getBoundingClientRect()
    if (place.top >= box.getBoundingClientRect().bottom) return
    pin.current = { id, bottom: place.bottom }
  }
}

export const mineOf = (reacts: ReactLine[] | undefined, me: string | null | undefined) =>
  (me && reacts?.find((one) => one.people.some((who) => who.id === me))?.kind) || null

export const lockedFor = (kind: Reaction, patron: boolean) => PATRON_REACTIONS.includes(kind) && !patron

export const withReact = (reacts: ReactLine[] = [], kind: Reaction | null, me: Me): ReactLine[] =>
  REACTIONS.map((one) => {
    const people = (reacts.find((kept) => kept.kind === one)?.people ?? []).filter((who) => who.id !== me.id)
    return { kind: one, people: one === kind ? [...people, { id: me.id, nick: me.nickname }] : people }
  }).filter((one) => one.people.length)

export function ReactPills({ reacts, me, active, onPick }: { reacts?: ReactLine[]; me?: string | null; active: boolean; onPick: (kind: Reaction) => void }) {
  const { t } = useI18n()
  if (!reacts?.length) return null
  return (
    <div className="chat-reacts">
      {reacts.map((one) => {
        const mine = one.people.some((who) => who.id === me)
        return (
          <button
            key={one.kind}
            type="button"
            className={`chat-react ${mine ? 'is-mine' : ''}`}
            disabled={!active}
            aria-pressed={mine}
            aria-label={`${t(`chat.react.${one.kind}` as UiKey)}: ${one.people.length}`}
            title={one.people.map((who) => who.nick).join(', ')}
            onClick={() => onPick(one.kind)}
          >
            <span aria-hidden>{REACT_FACE[one.kind]}</span>
            <b key={one.people.length}>{one.people.length}</b>
          </button>
        )
      })}
    </div>
  )
}

export function ReactBar({ mine, patron, onPick }: { mine: Reaction | null; patron: boolean; onPick: (kind: Reaction) => void }) {
  const { t } = useI18n()
  return (
    <div className="chat-react-bar" role="group" aria-label={t('chat.react')}>
      {REACTIONS.map((kind, index) => (
        <button
          key={kind}
          type="button"
          className={`${mine === kind ? 'is-mine' : ''} ${lockedFor(kind, patron) ? 'is-locked' : ''}`}
          style={{ '--at': index } as CSSProperties}
          aria-label={t(`chat.react.${kind}` as UiKey)}
          aria-pressed={mine === kind}
          onClick={() => onPick(kind)}
        >
          {REACT_FACE[kind]}
        </button>
      ))}
    </div>
  )
}
