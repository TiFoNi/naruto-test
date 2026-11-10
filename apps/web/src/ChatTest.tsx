'use client'

import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type Reaction } from '@nanda/game'
import Avatar from './Avatar'
import { QUICK_REACT, ReactBar, ReactPills, lockedFor, mineOf, useGrowUp, withReact, type Me, type ReactLine } from './ChatReacts'
import { useI18n } from './i18n'
import { ReplyIcon } from './icons'

type Fake = { id: string; userId: string; nickname: string; text: string; at: number; reacts?: ReactLine[] }

const ME: Me = { id: 'me', nickname: 'Ти' }

const CROWD = [
  { id: 'u1', nick: 'Injani' },
  { id: 'u2', nick: 'Raxa' },
  { id: 'u3', nick: 'Arthas' },
  { id: 'u4', nick: 'Лавров' },
  { id: 'u5', nick: 'Sakura' },
]

const START = Date.parse('2026-11-10T16:28:00+02:00')

const SEED: Fake[] = [
  { id: 'l1', userId: 'u1', nickname: 'Injani', text: 'Хто вже пройшов щоденку по Наруто?', at: START, reacts: [{ kind: 'like', people: [CROWD[1], CROWD[2]] }] },
  { id: 'l2', userId: 'u2', nickname: 'Raxa', text: 'Я за 2 спроби 😎', at: START + 2 * 60_000, reacts: [{ kind: 'laugh', people: [CROWD[0]] }, { kind: 'heart', people: [CROWD[4]] }] },
  { id: 'l3', userId: 'u3', nickname: 'Arthas', text: 'а я за 9, не питайте', at: START + 3 * 60_000 },
  { id: 'l4', userId: 'u3', nickname: 'Arthas', text: 'там персонаж з філерів був, нечесно', at: START + 3 * 60_000 + 20_000, reacts: [{ kind: 'puke', people: [CROWD[1]] }] },
  { id: 'l5', userId: 'me', nickname: 'Ти', text: 'Завтра розпродаж −11% у магазині, не пропустіть', at: START + 10 * 60_000 },
  { id: 'l6', userId: 'u4', nickname: 'Лавров', text: '.', at: START + 15 * 60_000 },
  { id: 'l7', userId: 'u5', nickname: 'Sakura', text: 'Хтось хоче дуель карт? Кидайте виклик, я тут ще хвилин 10 буду, потім піду спати бо завтра рано вставати', at: START + 20 * 60_000 },
  { id: 'l8', userId: 'u1', nickname: 'Injani', text: '❤️', at: START + 21 * 60_000 },
  { id: 'l9', userId: 'u2', nickname: 'Raxa', text: 'гг', at: START + 23 * 60_000 },
  { id: 'l10', userId: 'u4', nickname: 'Лавров', text: 'Хто знає, коли новий всесвіт відкриють?', at: START + 26 * 60_000 },
  { id: 'l11', userId: 'u5', nickname: 'Sakura', text: 'Куроко вже відкрили для всіх', at: START + 27 * 60_000, reacts: [{ kind: 'heart', people: [CROWD[3]] }] },
  { id: 'l12', userId: 'me', nickname: 'Ти', text: 'ага, 56 персонажів', at: START + 28 * 60_000 },
]

const HOLD_MS = 450
const HOLD_SLIP = 10

const clock = (at: number) => new Intl.DateTimeFormat('uk', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(at)

export default function ChatTest() {
  const { t } = useI18n()
  const [lines, setLines] = useState<Fake[]>(SEED)
  const [patron, setPatron] = useState(false)
  const [pointed, setPointed] = useState<{ line: Fake; x: number; y: number } | null>(null)
  const [held, setHeld] = useState<Fake | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const hold = useRef<{ x: number; y: number; timer: number } | null>(null)
  const feed = useRef<HTMLDivElement>(null)
  const growUp = useGrowUp(feed, lines)

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), 2600)
    return () => window.clearTimeout(timer)
  }, [note])

  const setReacts = (id: string, reacts: ReactLine[]) => {
    growUp(id)
    setLines((kept) => kept.map((one) => (one.id === id ? { ...one, reacts } : one)))
  }

  const react = (line: Fake, kind: Reaction) => {
    setPointed(null)
    setHeld(null)
    const now = lines.find((one) => one.id === line.id) ?? line
    const next = mineOf(now.reacts, ME.id) === kind ? null : kind
    if (next && lockedFor(next, patron)) return setNote(t('chat.reactPatron', { title: t('title.patron') }))
    setReacts(line.id, withReact(now.reacts, next, ME))
  }

  const someone = () => {
    const line = lines[Math.floor(Math.random() * lines.length)]!
    const who = CROWD[Math.floor(Math.random() * CROWD.length)]!
    const kind = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]!
    setReacts(line.id, withReact(line.reacts, kind, { id: who.id, nickname: who.nick }))
    setNote(`${who.nick}: ${kind} → «${line.text.slice(0, 24)}»`)
  }

  const letGo = () => {
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
  }

  const gestures = (line: Fake) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      letGo()
      hold.current = {
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          hold.current = null
          setHeld(line)
          navigator.vibrate?.(12)
        }, HOLD_MS),
      }
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = hold.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLIP) letGo()
    },
    onPointerUp: letGo,
    onPointerCancel: letGo,
    onDoubleClick: (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest('button, a')) return
      window.getSelection()?.removeAllRanges()
      react(line, QUICK_REACT)
    },
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault()
      if (window.matchMedia('(hover: none)').matches) return
      setPointed({ line, x: Math.min(event.clientX, window.innerWidth - 200), y: Math.min(event.clientY, window.innerHeight - 140) })
    },
  })

  const fresh = (line: Fake) => lines.find((one) => one.id === line.id) ?? line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520, margin: '0 auto', padding: '16px 0 40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
          <input type="checkbox" checked={patron} onChange={(event) => setPatron(event.target.checked)} />
          Я меценат
        </label>
        <button type="button" className="ghost" onClick={someone}>
          Хтось поставив реакцію
        </button>
        <button type="button" className="ghost" onClick={() => setLines(SEED)}>
          Скинути
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Тестовий чат: нічого не зберігається. ПК — правий клік або подвійний клік, телефон — довге натискання.
      </p>

      <section className="chat-panel" style={{ position: 'relative', inset: 'auto', width: '100%', height: '72vh', animation: 'none', border: '1px solid var(--line)', borderRadius: 20 }}>
        <header className="chat-head">
          <div className="chat-rooms">
            <button type="button" className="is-on">
              Тестовий чат
            </button>
          </div>
        </header>
        <div className="chat-feed-wrap">
          <div className="chat-feed" ref={feed}>
            {lines.map((line, index) => {
              const before = lines[index - 1]
              const glued = before && before.userId === line.userId && line.at - before.at < 5 * 60_000
              return (
                <article
                  key={line.id}
                  id={`chat-line-${line.id}`}
                  {...gestures(line)}
                  className={`chat-line is-holdable ${pointed?.line.id === line.id || held?.id === line.id ? 'is-pointed' : ''} ${glued ? 'is-glued' : ''} ${line.userId === ME.id ? 'is-mine' : ''}`}
                >
                  {glued ? (
                    <span className="chat-gap" aria-hidden />
                  ) : (
                    <span className="chat-face">
                      <Avatar id={line.userId} name={line.nickname} avatar={null} frame={null} className="chat-av" small />
                    </span>
                  )}
                  <div className="chat-body">
                    {!glued && (
                      <header>
                        <b className="chat-nick">{line.nickname}</b>
                        <time>{clock(line.at)}</time>
                      </header>
                    )}
                    <p>{line.text}</p>
                    <ReactPills reacts={line.reacts} me={ME.id} active onPick={(kind) => react(line, kind)} />
                  </div>
                </article>
              )
            })}
          </div>
        </div>
        {note && <span className="chat-note is-bad">{note}</span>}
      </section>

      {pointed && (
        <>
          <div
            className="chat-menu-away"
            role="presentation"
            onClick={() => setPointed(null)}
            onContextMenu={(event) => {
              event.preventDefault()
              setPointed(null)
            }}
          />
          <div className="chat-menu is-point" style={{ left: pointed.x, top: pointed.y }} role="menu">
            <ReactBar mine={mineOf(fresh(pointed.line).reacts, ME.id)} patron={patron} onPick={(kind) => react(pointed.line, kind)} />
            <button type="button" className="chat-menu-item" onClick={() => setPointed(null)}>
              <ReplyIcon />
              {t('chat.reply')}
            </button>
          </div>
        </>
      )}

      {held && (
        <div className="modal-backdrop chat-hold-away" onClick={() => setHeld(null)} role="presentation">
          <section className="card chat-hold" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <blockquote className="chat-quote">
              <b>{held.nickname}</b>
              {held.text}
            </blockquote>
            <ReactBar mine={mineOf(fresh(held).reacts, ME.id)} patron={patron} onPick={(kind) => react(held, kind)} />
            <button type="button" className="chat-hold-item" onClick={() => setHeld(null)}>
              <ReplyIcon />
              {t('chat.reply')}
            </button>
            <button type="button" className="chat-hold-item is-quiet" onClick={() => setHeld(null)}>
              {t('chat.cancel')}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
