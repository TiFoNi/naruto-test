'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointer } from 'react'
import { POLL, type PollGroup } from '@nanda/game'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { CheckIcon } from './icons'
import { useHref } from './router'

type Tally = { counts: Record<string, number>; voters: number; mine: Record<string, string[]> | null }

const EMPTY: Tally = { counts: {}, voters: 0, mine: null }
const PER_PAGE = 6

const choose = (group: PollGroup, picked: string[], id: string) => {
  if (picked.includes(id)) return picked.filter((one) => one !== id)
  if (picked.length < group.max) return [...picked, id]
  return [...picked.slice(1), id]
}

const rank = (group: PollGroup, counts: Record<string, number>) =>
  group.options
    .map((option, index) => ({ id: option.id, index, n: counts[option.id] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.index - b.index)
    .map((one) => one.id)

export default function HomePoll() {
  const { t, l } = useI18n()
  const href = useHref()
  const { user } = useAuth()
  const [tally, setTally] = useState<Tally>(EMPTY)
  const [ready, setReady] = useState(false)
  const [at, setAt] = useState(0)
  const [order, setOrder] = useState<Record<string, string[]> | null>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const sent = useRef(0)

  useEffect(() => {
    let alive = true
    void api<Tally>('poll').then(({ ok, data }) => {
      if (!alive) return
      const counts = ok ? (data.counts ?? {}) : {}
      if (ok) setTally({ counts, voters: data.voters ?? 0, mine: data.mine ?? null })
      setOrder((known) => known ?? Object.fromEntries(POLL.groups.map((group) => [group.id, rank(group, counts)])))
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [user])

  const pages = useMemo(
    () =>
      POLL.groups.flatMap((group) => {
        const ids = order?.[group.id] ?? group.options.map((option) => option.id)
        const parts = Math.ceil(ids.length / PER_PAGE)
        return Array.from({ length: parts }, (_, part) => ({
          group,
          part,
          parts,
          options: ids.slice(part * PER_PAGE, (part + 1) * PER_PAGE).map((id) => group.options.find((option) => option.id === id)!),
        }))
      }),
    [order],
  )

  const page = pages[at] ?? pages[0]

  const vote = (group: PollGroup, id: string) => {
    if (!user) return
    const before = tally.mine?.[group.id] ?? []
    const after = choose(group, before, id)
    const counts = { ...tally.counts }
    for (const one of before) if (!after.includes(one)) counts[one] = Math.max(0, (counts[one] ?? 0) - 1)
    for (const one of after) if (!before.includes(one)) counts[one] = (counts[one] ?? 0) + 1
    const first = !tally.mine || !Object.values(tally.mine).some((list) => list.length)
    setTally({ counts, voters: tally.voters + (first && after.length ? 1 : 0), mine: { ...tally.mine, [group.id]: after } })
    const ticket = ++sent.current
    void api<Tally>('poll', { group: group.id, picks: after }).then(({ ok, data }) => {
      if (ok && ticket === sent.current) setTally({ counts: data.counts ?? {}, voters: data.voters ?? 0, mine: data.mine ?? null })
    })
  }

  const turn = (step: number) => setAt((one) => Math.max(0, Math.min(pages.length - 1, one + step)))

  const start = (event: ReactPointer<HTMLElement>) => {
    event.stopPropagation()
    swipe.current = { x: event.clientX, y: event.clientY }
  }

  const end = (event: ReactPointer<HTMLElement>) => {
    event.stopPropagation()
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = event.clientX - from.x
    if (Math.abs(dx) < 40 || Math.abs(event.clientY - from.y) > Math.abs(dx)) return
    turn(dx < 0 ? 1 : -1)
  }

  const peak = Math.max(1, ...Object.values(tally.counts))

  return (
    <div className="home-poll">
      <div className="home-poll-tabs" role="tablist">
        {POLL.groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={page.group.id === group.id}
            className={page.group.id === group.id ? 'is-on' : ''}
            onClick={() => setAt(pages.findIndex((one) => one.group.id === group.id))}
          >
            {l(group.label)}
            {!!tally.mine?.[group.id]?.length && <i aria-hidden />}
          </button>
        ))}
      </div>

      <div className="home-poll-pages" onPointerDown={start} onPointerUp={end} onPointerCancel={() => (swipe.current = null)}>
        <div className="home-poll-track" style={{ transform: `translateX(${-at * 100}%)` }}>
          {pages.map((one, index) => {
            const picked = tally.mine?.[one.group.id] ?? []
            return (
              <div key={`${one.group.id}-${one.part}`} className="home-poll-page" aria-hidden={index !== at} inert={index !== at}>
                <div className="home-poll-grid">
                  {one.options.map((option) => {
                    const count = tally.counts[option.id] ?? 0
                    const mine = picked.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`home-poll-option ${mine ? 'is-mine' : ''}`}
                        style={{ '--share': `${ready ? (count / peak) * 100 : 0}%` } as CSSProperties}
                        disabled={!user}
                        aria-pressed={mine}
                        title={l(option.label)}
                        onClick={() => vote(one.group, option.id)}
                      >
                        <i className="home-poll-fill" aria-hidden />
                        <i className="home-poll-check" aria-hidden>
                          {mine && <CheckIcon />}
                        </i>
                        <span className="home-poll-name">{l(option.label)}</span>
                        <b>{ready ? count : ' '}</b>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="home-poll-foot">
        <span>{t(page.group.max > 1 ? 'poll.pickTwo' : 'poll.pickOne')}</span>
        {ready && <span>{t('poll.voters', { count: tally.voters })}</span>}
        {!user && (
          <Link href={href.login} prefetch={false}>
            {t('poll.login')}
          </Link>
        )}
        <span className={`home-poll-more ${page.parts > 1 ? '' : 'is-idle'}`} aria-hidden={page.parts <= 1}>
          {Array.from({ length: Math.max(2, page.parts) }, (_, part) => (
            <button
              key={part}
              type="button"
              className={part === page.part ? 'is-on' : ''}
              aria-label={t('poll.page', { number: part + 1 })}
              aria-current={part === page.part}
              onClick={() => setAt(at - page.part + part)}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
