'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Avatar from './Avatar'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { ChatIcon, CloseIcon, MuteIcon, SendIcon, SwordsIcon, UserIcon, UsersIcon } from './icons'
import { useHref, useNavigate } from './router'
import { openStream } from './stream'

type Line = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  text: string
  at: number
}

const SEEN_KEY = 'chat:seen'
const GROUP_MS = 5 * 60_000
const KEEP = 300

const readSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

const markSeen = (at: number) => {
  try {
    localStorage.setItem(SEEN_KEY, String(at))
  } catch {
    /* приватний режим */
  }
}

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function Chat() {
  const { t } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [asking, setAsking] = useState<{ kind: 'drop' | 'mute'; line: Line } | null>(null)
  const [menu, setMenu] = useState<{ line: Line; x: number; y: number } | null>(null)
  const [unread, setUnread] = useState(0)
  const [online, setOnline] = useState(0)
  const seen = useRef(0)
  const feed = useRef<HTMLDivElement>(null)
  const nearEnd = useRef(true)

  useEffect(() => {
    seen.current = readSeen()
  }, [])

  const close = useCallback(() => {
    setMenu(null)
    setLeaving((was) => {
      if (was) return was
      setTimeout(() => {
        setOpen(false)
        setLeaving(false)
      }, 200)
      return true
    })
  }, [])

  const load = useCallback(async (before?: string) => {
    setLoading(true)
    const { ok, data } = await api<{ lines?: Line[]; more?: boolean; online?: number }>(`chat${before ? `?before=${before}` : ''}`)
    setLoading(false)
    if (!ok || !data.lines) return
    if (typeof data.online === 'number') setOnline(data.online)
    setMore(Boolean(data.more))
    setLines((kept) => {
      const known = new Set(kept.map((line) => line.id))
      const fresh = data.lines!.filter((line) => !known.has(line.id))
      return before ? [...fresh, ...kept] : [...kept, ...fresh].slice(-KEEP)
    })
  }, [])

  useEffect(() => {
    void load()
    return openStream('stream/chat', {
      chat: (data) => {
        const line = data as Line | null
        if (!line?.id) return
        setLines((kept) => (kept.some((one) => one.id === line.id) ? kept : [...kept, line].slice(-KEEP)))
      },
      online: (data) => {
        const live = (data as { online?: number } | null)?.online
        if (typeof live === 'number') setOnline(live)
      },
      drop: (data) => {
        const gone = (data as { id?: string } | null)?.id
        if (gone) setLines((kept) => kept.filter((line) => line.id !== gone))
      },
    })
  }, [load])

  useEffect(() => {
    const last = lines[lines.length - 1]
    if (!last) return
    if (open) {
      seen.current = last.at
      markSeen(last.at)
      setUnread(0)
      return
    }
    setUnread(lines.filter((line) => line.at > seen.current).length)
  }, [lines, open])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (box && nearEnd.current) box.scrollTop = box.scrollHeight
  }, [lines, open])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (box) box.scrollTop = box.scrollHeight
  }, [open])

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(''), 2600)
    return () => clearTimeout(timer)
  }, [note])

  useEffect(() => {
    if (!open) return
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menu) return setMenu(null)
      close()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [open, close, menu])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const { ok, status, data } = await api<{ line?: Line }>('chat', { text: body })
    setSending(false)
    if (ok && data.line) {
      setText('')
      nearEnd.current = true
      setLines((kept) => (kept.some((one) => one.id === data.line!.id) ? kept : [...kept, data.line!]))
      return
    }
    setNote(status === 429 ? t('chat.slow') : status === 403 ? t('chat.muted') : t('chat.failed'))
  }

  const moderate = async (body: Record<string, unknown>, done: () => void) => {
    setAsking(null)
    const { ok } = await api('admin/chat', body)
    if (!ok) return setNote(t('chat.failed'))
    done()
  }

  const befriend = async (line: Line) => {
    setMenu(null)
    const { ok } = await api('friends', { action: 'ask', id: line.userId })
    setNote(ok ? t('chat.asked') : t('chat.failed'))
  }

  const toDuel = async (line: Line) => {
    setMenu(null)
    const { ok, data } = await api<{ duel?: { code: string } }>('duel', { action: 'challenge', to: line.userId })
    if (ok && data.duel) return navigate(href.duel(data.duel.code))
    setNote(t('chat.failed'))
  }

  const watch = () => {
    const box = feed.current
    if (!box) return
    nearEnd.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80
    setMenu(null)
  }

  return (
    <>
      <button
        type="button"
        className={`chat-bubble ${open ? 'is-open' : ''}`}
        aria-label={t('chat.title')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && unread > 0 && <em className="chat-dot" aria-label={t('chat.fresh')} />}
      </button>

      {open && <div className={`chat-shade ${leaving ? 'is-leaving' : ''}`} role="presentation" onClick={close} />}

      {open && (
        <section className={`chat-panel ${leaving ? 'is-leaving' : ''}`} aria-label={t('chat.title')}>
          <header className="chat-head">
            <b>{t('chat.title')}</b>
            {online > 0 && <em className="chat-online">{t('chat.online', { count: online })}</em>}
            <button type="button" className="chat-x" aria-label={t('chat.close')} onClick={close}>
              <CloseIcon />
            </button>
          </header>

          <div className="chat-feed" ref={feed} onScroll={watch}>
            {more && (
              <button type="button" className="chat-earlier" disabled={loading} onClick={() => void load(lines[0]?.id)}>
                {t('chat.earlier')}
              </button>
            )}
            {lines.length === 0 && !loading && <p className="chat-empty">{t('chat.empty')}</p>}
            {lines.map((line, index) => {
              const before = lines[index - 1]
              const glued = before && before.userId === line.userId && line.at - before.at < GROUP_MS
              return (
                <article key={line.id} className={`chat-line ${glued ? 'is-glued' : ''} ${line.userId === user?.id ? 'is-mine' : ''}`}>
                  {glued ? (
                    <span className="chat-gap" aria-hidden />
                  ) : (
                    <button
                      type="button"
                      className="chat-face"
                      aria-label={line.nickname}
                      onClick={(event) => {
                        const box = event.currentTarget.getBoundingClientRect()
                        const x = Math.min(Math.max(box.left + box.width / 2, 96), window.innerWidth - 96)
                        setMenu((was) => (was?.line.id === line.id ? null : { line, x, y: box.bottom + 6 }))
                      }}
                    >
                      <Avatar id={line.userId} name={line.nickname} avatar={line.avatar} frame={line.frame} className="chat-av" />
                    </button>
                  )}
                  <div className="chat-body">
                    {!glued && (
                      <header>
                        <Link className="chat-nick" href={line.userId === user?.id ? href.profile : href.player(line.userId)} prefetch={false}>
                          {line.nickname}
                        </Link>
                        <time dateTime={new Date(line.at).toISOString()}>{clock(line.at)}</time>
                      </header>
                    )}
                    <p>{line.text}</p>
                  </div>
                  {user?.admin && (
                    <span className="chat-tools">
                      <button type="button" title={t('chat.drop')} aria-label={t('chat.drop')} onClick={() => setAsking({ kind: 'drop', line })}>
                        <CloseIcon />
                      </button>
                      {line.userId !== user.id && (
                        <button type="button" title={t('chat.mute')} aria-label={t('chat.mute')} onClick={() => setAsking({ kind: 'mute', line })}>
                          <MuteIcon />
                        </button>
                      )}
                    </span>
                  )}
                </article>
              )
            })}
          </div>

          {user ? (
            <form
              className="chat-send"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <input
                value={text}
                maxLength={300}
                placeholder={t('chat.placeholder')}
                onChange={(event) => setText(event.target.value)}
                disabled={sending}
              />
              <button type="submit" className="primary chat-go" disabled={sending || !text.trim()} title={t('chat.send')} aria-label={t('chat.send')}>
                <SendIcon />
              </button>
            </form>
          ) : (
            <Link className="chat-join" href={href.login}>
              {t('chat.join')}
            </Link>
          )}

          <span className={`chat-note ${note ? 'on' : ''}`}>{note}</span>
        </section>
      )}

      {menu && (
        <>
          <div className="chat-menu-away" role="presentation" onClick={() => setMenu(null)} />
          <div className="chat-menu" style={{ left: menu.x, top: menu.y }} role="menu">
            <Link
              className="chat-menu-item"
              href={menu.line.userId === user?.id ? href.profile : href.player(menu.line.userId)}
              prefetch={false}
              onClick={() => setMenu(null)}
            >
              <UserIcon />
              {t('chat.profile')}
            </Link>
            {user && menu.line.userId !== user.id && (
              <>
                <button type="button" className="chat-menu-item" onClick={() => void befriend(menu.line)}>
                  <UsersIcon />
                  {t('chat.befriend')}
                </button>
                <button type="button" className="chat-menu-item" onClick={() => void toDuel(menu.line)}>
                  <SwordsIcon />
                  {t('chat.duel')}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {asking && (
        <div className="modal-backdrop" onClick={() => setAsking(null)} role="presentation">
          <section
            className="card modal chat-ask"
            role="dialog"
            aria-modal="true"
            aria-label={asking.kind === 'drop' ? t('chat.dropTitle') : t('chat.muteTitle', { name: asking.line.nickname })}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label={t('chat.cancel')} onClick={() => setAsking(null)}>
              <CloseIcon />
            </button>

            <h2>{asking.kind === 'drop' ? t('chat.dropTitle') : t('chat.muteTitle', { name: asking.line.nickname })}</h2>
            <p className="muted">{asking.kind === 'drop' ? t('chat.dropHint') : t('chat.muteHint')}</p>
            <blockquote className="chat-quote">{asking.line.text}</blockquote>

            {asking.kind === 'drop' ? (
              <div className="chat-ask-row">
                <button type="button" className="ghost" onClick={() => setAsking(null)}>
                  {t('chat.cancel')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    void moderate({ drop: asking.line.id }, () => setLines((kept) => kept.filter((one) => one.id !== asking.line.id)))
                  }
                >
                  {t('chat.dropYes')}
                </button>
              </div>
            ) : (
              <div className="chat-ask-row is-times">
                {([
                  [15, 'chat.mute15'],
                  [60, 'chat.mute60'],
                  [1440, 'chat.muteDay'],
                  [0, 'chat.unmute'],
                ] as const).map(([minutes, key]) => (
                  <button
                    key={minutes}
                    type="button"
                    className={minutes ? 'ghost' : 'ghost is-off'}
                    onClick={() =>
                      void moderate({ mute: asking.line.userId, minutes }, () =>
                        setNote(t(minutes ? 'chat.muteDone' : 'chat.unmuteDone', { name: asking.line.nickname })),
                      )
                    }
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
