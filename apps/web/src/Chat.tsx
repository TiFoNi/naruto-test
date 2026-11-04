'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { TONE_HEX } from '@nanda/game'
import Avatar from './Avatar'
import { GAMES } from './games'
import { api } from './api'
import { dropMentions, watchFeed } from './awards'
import ChatMentions, { EVERYONE_NICK, type MentionPick, type Person } from './ChatMentions'
import { onChatOpen } from './chatEvents'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { ChatIcon, CloseIcon, MuteIcon, SendIcon, SmileIcon, SwordsIcon, UserIcon, UsersIcon } from './icons'
import { useHref, useNavigate } from './router'
import { openStream } from './stream'

type Line = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  title?: string | null
  nickTone?: string | null
  text: string
  at: number
  tags?: { id: string; nick: string }[]
  everyone?: boolean
}

const AT_BEFORE = /(^|\s)@([^\s@]{0,32})$/

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toneOf = (tone?: string | null): CSSProperties | undefined => {
  const hex = GAMES.find((game) => game.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : null)
  return hex ? { color: hex } : undefined
}

const MENU_EDGE = 8
const GROUP_MS = 5 * 60_000
const TYPE_GAP_MS = 3500
const PULSE_MS = 45_000
const SEEN_KEY = 'chat:seen'
const NEWS_KEY = 'chat:news-seen'
const WHO_KEY = 'chat:who'

type Room = 'chat' | 'news'

const EMOJI_SETS = [
  {
    id: 'faces',
    icon: '😀',
    label: 'chat.emojiFaces',
    list: ['😀', '😁', '😂', '🤣', '😅', '😊', '🙂', '😉', '😍', '🥰', '😘', '😋', '😜', '🤪', '😎', '🤓', '🤔', '🤨', '😐', '😑', '😏', '🙄', '😬', '😴', '😮', '😯', '😱', '😭', '🥲', '😢', '😤', '😡', '🤬', '🤯', '🥺', '😇', '🫡', '🫠', '🤡', '🥳', '🤠', '😈', '💀', '👻', '👽', '🤖', '💩', '🙈'],
  },
  {
    id: 'hands',
    icon: '👍',
    label: 'chat.emojiHands',
    list: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤞', '🤌', '👌', '🤙', '👋', '✋', '👊', '🤛', '🫶', '👀', '🧠', '🫵'],
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'chat.emojiHearts',
    list: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❤️‍🔥', '💖', '💕', '💯', '🔥', '✨', '⭐', '🌟', '💥', '💢', '💤'],
  },
  {
    id: 'anime',
    icon: '⚔️',
    label: 'chat.emojiAnime',
    list: ['⚔️', '🗡️', '🛡️', '🏹', '⚡', '🌙', '☀️', '🌸', '🍥', '🍜', '🍙', '🍣', '🐸', '🦊', '🐉', '🐺', '🐱', '👹', '👺', '🎌', '🏯', '⛩️', '🎴', '🀄'],
  },
  {
    id: 'fun',
    icon: '🎉',
    label: 'chat.emojiFun',
    list: ['🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '🎮', '🎲', '🎯', '🧩', '🍿', '☕', '🍕', '🍰', '🚀', '💎', '💰', '🪙', '📈', '📉', '❓', '❗', '✅', '❌'],
  },
] as const

type EmojiSet = (typeof EMOJI_SETS)[number]['id'] | 'ours'

const readKey = (key: string) => {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

const keepKey = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* приватний режим */
  }
}

const lastSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

const whoAmI = () => {
  try {
    const known = localStorage.getItem(WHO_KEY)
    if (known) return known
    const made = crypto.randomUUID()
    localStorage.setItem(WHO_KEY, made)
    return made
  } catch {
    return ''
  }
}

const keepSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN_KEY, id)
  } catch {
    /* приватний режим */
  }
}
const KEEP = 300

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
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null)
  const [mates, setMates] = useState<{ friends: string[]; sent: string[]; asked: string[] }>({ friends: [], sent: [], asked: [] })
  const [sending, setSending] = useState(false)
  const [asking, setAsking] = useState<{ kind: 'drop' | 'mute' | 'unfriend'; line: Line } | null>(null)
  const [menu, setMenu] = useState<{ line: Line; x: number; y: number; above: number } | null>(null)
  const menuBox = useRef<HTMLDivElement>(null)
  const [menuTop, setMenuTop] = useState<number | null>(null)

  useLayoutEffect(() => {
    const node = menuBox.current
    if (!menu || !node) return setMenuTop(null)
    const height = node.offsetHeight
    const fits = menu.y + height <= window.innerHeight - MENU_EDGE
    setMenuTop(fits ? menu.y : Math.max(MENU_EDGE, menu.above - height))
  }, [menu, mates])
  const [online, setOnline] = useState(0)
  const [typers, setTypers] = useState<{ id: string; nickname: string }[]>([])
  const typedAt = useRef(0)
  const [fresh, setFresh] = useState(false)
  const [room, setRoom] = useState<Room>('chat')
  const roomRef = useRef<Room>('chat')
  roomRef.current = room
  const [newsTop, setNewsTop] = useState('')
  const [newsSeen, setNewsSeen] = useState('')
  const [faces, setFaces] = useState(false)
  const [faceSet, setFaceSet] = useState<EmojiSet>('faces')
  const [people, setPeople] = useState<Person[]>([])
  const [atAsk, setAtAsk] = useState<{ start: number; query: string } | null>(null)
  const [atOptions, setAtOptions] = useState<MentionPick[]>([])
  const [atActive, setAtActive] = useState(0)
  const [picked, setPicked] = useState<MentionPick[]>([])
  const [tagCount, setTagCount] = useState(0)
  const [focusLine, setFocusLine] = useState<string | null>(null)
  const feed = useRef<HTMLDivElement>(null)
  const nearEnd = useRef(true)
  const field = useRef<HTMLTextAreaElement>(null)

  const grow = useCallback(() => {
    const box = field.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 132)}px`
  }, [])

  const say = useCallback((text: string, bad = false) => setNote({ text, bad }), [])

  const beat = useCallback(async () => {
    const ask = new URLSearchParams()
    const seen = lastSeen()
    if (seen) ask.set('seen', seen)
    const who = whoAmI()
    if (who) ask.set('who', who)
    const { ok, data } = await api<{ online?: number; fresh?: boolean; news?: string | null }>(`pulse?${ask.toString()}`)
    if (!ok) return
    if (typeof data.online === 'number') setOnline(data.online)
    setFresh(Boolean(data.fresh))
    setNewsTop(data.news ?? '')
  }, [])

  useEffect(() => setNewsSeen(readKey(NEWS_KEY)), [])

  useEffect(
    () =>
      onChatOpen((ask) => {
        setRoom(ask.room)
        setFocusLine(ask.line ?? null)
        setOpen(true)
      }),
    [],
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    const asked = url.searchParams.get('chat')
    if (!asked) return
    url.searchParams.delete('chat')
    window.history.replaceState(window.history.state, '', url.toString())
    setRoom(asked === 'news' ? 'news' : 'chat')
    setOpen(true)
  }, [])

  useEffect(() => {
    const stop = watchFeed((feed) => setTagCount(feed.mentions.length))
    return () => {
      stop()
    }
  }, [])

  useEffect(() => {
    if (!open || room !== 'chat' || !tagCount) return
    dropMentions()
    void api('profile', { action: 'seenMentions' }).catch(() => null)
  }, [open, room, tagCount])

  useEffect(() => {
    if (!open || !focusLine) return
    const node = document.getElementById(`chat-line-${focusLine}`)
    if (!node) return
    node.scrollIntoView({ block: 'center' })
    node.classList.add('is-focus')
    const timer = window.setTimeout(() => {
      node.classList.remove('is-focus')
      setFocusLine(null)
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [open, focusLine, lines])

  const loadMates = useCallback(async () => {
    const { ok, data } = await api<{ friends?: Person[]; requests?: { id: string }[]; sent?: { id: string }[] }>('friends')
    if (!ok) return
    setPeople(data.friends ?? [])
    setMates({
      friends: (data.friends ?? []).map((one) => one.id),
      sent: (data.sent ?? []).map((one) => one.id),
      asked: (data.requests ?? []).map((one) => one.id),
    })
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
    const asked = roomRef.current
    setLoading(true)
    const query = new URLSearchParams()
    if (before) query.set('before', before)
    if (asked === 'news') query.set('channel', 'news')
    const { ok, data } = await api<{ lines?: Line[]; more?: boolean; online?: number }>(`chat${query.toString() ? `?${query.toString()}` : ''}`)
    setLoading(false)
    if (!ok || !data.lines || roomRef.current !== asked) return
    if (typeof data.online === 'number') setOnline(data.online)
    setMore(Boolean(data.more))
    if (!before) return setLines(data.lines.slice(-KEEP))
    setLines((kept) => {
      const known = new Set(kept.map((line) => line.id))
      return [...data.lines!.filter((line) => !known.has(line.id)), ...kept]
    })
  }, [])

  useEffect(() => {
    void beat()
    const timer = setInterval(() => document.visibilityState === 'visible' && void beat(), PULSE_MS)
    const wake = () => document.visibilityState === 'visible' && void beat()
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [beat])

  useEffect(() => {
    const last = lines[lines.length - 1]
    if (!open || !last) return
    if (room === 'news') {
      if (last.id > readKey(NEWS_KEY)) keepKey(NEWS_KEY, last.id)
      setNewsSeen(readKey(NEWS_KEY))
      return
    }
    keepSeen(last.id)
    setFresh(false)
  }, [open, lines, room])

  useEffect(() => {
    if (!open) return
    setLines([])
    setMore(false)
    void load()
  }, [load, open, room])

  const newsAsked = useRef('')

  useEffect(() => {
    if (!open || room !== 'news' || !newsTop) return
    if (!newsAsked.current) {
      newsAsked.current = newsTop
      return
    }
    if (newsAsked.current === newsTop) return
    newsAsked.current = newsTop
    void load()
  }, [open, room, newsTop, load])

  useEffect(() => {
    if (!open) return
    return openStream('stream/chat', {
      chat: (data) => {
        const line = data as Line | null
        if (!line?.id || roomRef.current !== 'chat') return
        setLines((kept) => (kept.some((one) => one.id === line.id) ? kept : [...kept, line].slice(-KEEP)))
      },
      drop: (data) => {
        const gone = (data as { id?: string } | null)?.id
        if (gone && roomRef.current === 'chat') setLines((kept) => kept.filter((line) => line.id !== gone))
      },
      typing: (data) => {
        const people = (data as { people?: { id: string; nickname: string }[] } | null)?.people
        setTypers(people ?? [])
      },
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (box && nearEnd.current) box.scrollTop = box.scrollHeight
  }, [lines, open])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (!box) return
    nearEnd.current = true
    box.scrollTop = box.scrollHeight
    const stick = () => {
      if (nearEnd.current) box.scrollTop = box.scrollHeight
    }
    const sizes = new ResizeObserver(stick)
    sizes.observe(box)
    for (const child of box.children) sizes.observe(child)
    const added = new MutationObserver((changes) => {
      for (const change of changes) for (const node of change.addedNodes) if (node instanceof Element) sizes.observe(node)
      stick()
    })
    added.observe(box, { childList: true })
    return () => {
      sizes.disconnect()
      added.disconnect()
    }
  }, [open])

  useEffect(() => {
    if (!open || !user) return
    void loadMates()
    const stop = watchFeed(() => void loadMates())
    return () => {
      stop()
    }
  }, [open, user, loadMates])

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(null), 2600)
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

  const typeBeat = useCallback(
    (on: boolean) => {
      if (!user) return
      const now = Date.now()
      if (on ? now - typedAt.current < TYPE_GAP_MS : !typedAt.current) return
      typedAt.current = on ? now : 0
      void api('chat/typing', { on })
    },
    [user],
  )

  useEffect(() => {
    if (open) return
    typedAt.current = 0
    setTypers([])
  }, [open])

  useEffect(
    () => () => {
      if (typedAt.current) void api('chat/typing', { on: false })
    },
    [],
  )

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const lower = body.toLowerCase()
    const tags = [...new Set(picked.filter((one) => one.id && lower.includes(`@${one.nick.toLowerCase()}`)).map((one) => one.id!))]
    const { ok, status, data } = await api<{ line?: Line }>('chat', room === 'news' ? { text: body, channel: 'news' } : { text: body, tags })
    setSending(false)
    if (ok && data.line) {
      typedAt.current = 0
      setText('')
      setPicked([])
      setAtAsk(null)
      requestAnimationFrame(grow)
      nearEnd.current = true
      setLines((kept) => (kept.some((one) => one.id === data.line!.id) ? kept : [...kept, data.line!]))
      return
    }
    say(status === 429 ? t('chat.slow') : status === 403 ? t('chat.muted') : t('chat.failed'), true)
  }

  const moderate = async (body: Record<string, unknown>, done: () => void) => {
    setAsking(null)
    const { ok } = await api('admin/chat', body)
    if (!ok) return say(t('chat.failed'), true)
    done()
  }

  const mate = async (line: Line, action: 'ask' | 'remove' | 'accept') => {
    setMenu(null)
    const { ok } = await api('friends', { action, id: line.userId })
    if (!ok) return say(t('chat.failed'), true)
    await loadMates()
    say(t(action === 'ask' ? 'chat.asked' : action === 'accept' ? 'chat.accepted' : 'chat.unfriended'))
  }

  const toDuel = async (line: Line) => {
    setMenu(null)
    const { ok, data } = await api<{ duel?: { code: string } }>('duel', { action: 'challenge', to: line.userId })
    if (ok && data.duel) return navigate(href.duel(data.duel.code))
    say(t('chat.failed'), true)
  }

  const newsFresh = Boolean(newsTop) && newsTop > newsSeen
  const canWrite = room === 'chat' || Boolean(user?.admin)

  const addEmoji = (emoji: string) => {
    const box = field.current
    const start = box?.selectionStart ?? text.length
    const end = box?.selectionEnd ?? text.length
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(0, room === 'news' ? 1500 : 300)
    setText(next)
    requestAnimationFrame(() => {
      if (!box) return
      box.focus()
      const at = Math.min(start + emoji.length, next.length)
      box.setSelectionRange(at, at)
      grow()
    })
  }

  const readAt = (value: string, caret: number) => {
    const hit = value.slice(0, caret).match(AT_BEFORE)
    if (!hit) return setAtAsk(null)
    setAtAsk({ start: caret - hit[2].length - 1, query: hit[2] })
    setAtActive(0)
  }

  const putTag = (pick: MentionPick, from?: { start: number; end: number }, base = text) => {
    const box = field.current
    const start = from?.start ?? box?.selectionStart ?? base.length
    const end = from?.end ?? box?.selectionEnd ?? base.length
    const chunk = `@${pick.nick} `
    const next = `${base.slice(0, start)}${chunk}${base.slice(end)}`
    setText(next)
    setAtAsk(null)
    if (pick.id) setPicked((was) => (was.some((one) => one.id === pick.id) ? was : [...was, pick]))
    requestAnimationFrame(() => {
      if (!box) return
      box.focus()
      const at = start + chunk.length
      box.setSelectionRange(at, at)
      grow()
    })
  }

  const pickAt = (pick: MentionPick) => {
    if (!atAsk) return
    const end = field.current?.selectionStart ?? atAsk.start + atAsk.query.length + 1
    putTag(pick, { start: atAsk.start, end })
  }

  const bodyOf = (line: Line) => {
    const tags = line.tags ?? []
    const names = [...tags.map((tag) => tag.nick), ...(line.everyone ? [EVERYONE_NICK, 'all', 'everyone', 'всех', 'усі', 'всім'] : [])]
    if (!names.length) return line.text
    const split = new RegExp(`(@(?:${[...names].sort((a, b) => b.length - a.length).map(escape).join('|')}))`, 'gi')
    return line.text.split(split).map((part, index) => {
      if (index % 2 === 0) return part
      const nick = part.slice(1).toLowerCase()
      const tag = tags.find((one) => one.nick.toLowerCase() === nick)
      if (!tag)
        return (
          <span key={index} className="chat-at is-all">
            {part}
          </span>
        )
      return (
        <Link
          key={index}
          className={`chat-at ${tag.id === user?.id ? 'is-me' : ''}`}
          href={tag.id === user?.id ? href.profile : href.player(tag.id)}
          prefetch={false}
          onClick={close}
        >
          {part}
        </Link>
      )
    })
  }

  const said = room === 'chat' ? typers.filter((one) => one.id !== user?.id) : []
  const typingText =
    said.length === 1
      ? t('chat.typingOne', { name: said[0].nickname })
      : said.length === 2
        ? t('chat.typingTwo', { one: said[0].nickname, two: said[1].nickname })
        : said.length > 2
          ? t('chat.typingMany', { one: said[0].nickname, two: said[1].nickname, count: said.length - 2 })
          : ''

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
        {!open && tagCount > 0 ? (
          <em className="chat-count" aria-label={t('chat.mentionNew')}>
            {tagCount > 9 ? '9+' : tagCount}
          </em>
        ) : (
          !open && (fresh || newsFresh) && <em className="chat-dot" aria-label={t('chat.fresh')} />
        )}
      </button>

      {open && <div className={`chat-shade ${leaving ? 'is-leaving' : ''}`} role="presentation" onClick={close} />}

      {open && (
        <section className={`chat-panel ${leaving ? 'is-leaving' : ''}`} aria-label={t('chat.title')}>
          <header className="chat-head">
            <div className="chat-rooms" role="tablist" aria-label={t('chat.title')}>
              {(['chat', 'news'] as const).map((one) => (
                <button
                  key={one}
                  type="button"
                  role="tab"
                  aria-selected={room === one}
                  className={room === one ? 'is-on' : ''}
                  onClick={() => {
                    setMenu(null)
                    setFaces(false)
                    setRoom(one)
                  }}
                >
                  {t(one === 'news' ? 'chat.roomNews' : 'chat.roomAll')}
                  {one === 'news' && newsFresh && room !== 'news' && <em className="chat-room-dot" aria-label={t('chat.newsFresh')} />}
                </button>
              ))}
            </div>
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
            {lines.length === 0 && !loading && <p className="chat-empty">{t(room === 'news' ? 'chat.newsEmpty' : 'chat.empty')}</p>}
            {lines.map((line, index) => {
              const before = lines[index - 1]
              const glued = before && before.userId === line.userId && line.at - before.at < GROUP_MS
              return (
                <article
                  key={line.id}
                  id={`chat-line-${line.id}`}
                  className={`chat-line ${glued ? 'is-glued' : ''} ${line.userId === user?.id ? 'is-mine' : ''} ${
                    user && line.userId !== user.id && (line.everyone || line.tags?.some((tag) => tag.id === user.id)) ? 'is-tagged' : ''
                  }`}
                >
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
                        setMenu((was) => (was?.line.id === line.id ? null : { line, x, y: box.bottom + 6, above: box.top - 6 }))
                        if (user) void loadMates()
                      }}
                    >
                      <Avatar id={line.userId} name={line.nickname} avatar={line.avatar} frame={line.frame} className="chat-av" small />
                    </button>
                  )}
                  <div className="chat-body">
                    {!glued && (
                      <header>
                        <Link
                          className="chat-nick"
                          href={line.userId === user?.id ? href.profile : href.player(line.userId)}
                          style={toneOf(line.nickTone)}
                          prefetch={false}
                          onClick={close}
                        >
                          {line.nickname}
                        </Link>
                        {line.title && <i className={`player-title is-slim is-${line.title}`}>{t(`title.${line.title}` as UiKey)}</i>}
                        <time dateTime={new Date(line.at).toISOString()}>{clock(line.at)}</time>
                      </header>
                    )}
                    <p>{bodyOf(line)}</p>
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

          {said.length > 0 && (
            <p className="chat-typing">
              <i aria-hidden>
                <em />
                <em />
                <em />
              </i>
              <span>{typingText}</span>
            </p>
          )}

          {user && !canWrite ? (
            <p className="chat-readonly">{t('chat.newsOnly')}</p>
          ) : user ? (
            <form
              className="chat-send"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              {atAsk && (
                <ChatMentions
                  query={atAsk.query}
                  friends={people}
                  me={user?.id ?? null}
                  everyone={room === 'news' && Boolean(user?.admin)}
                  active={atActive}
                  onActive={setAtActive}
                  onOptions={setAtOptions}
                  onPick={pickAt}
                />
              )}
              <textarea
                ref={field}
                value={text}
                rows={1}
                maxLength={room === 'news' ? 1500 : 300}
                placeholder={t('chat.placeholder')}
                onChange={(event) => {
                  setText(event.target.value)
                  grow()
                  typeBeat(Boolean(event.target.value.trim()))
                  readAt(event.target.value, event.target.selectionStart ?? event.target.value.length)
                }}
                onSelect={(event) => readAt(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
                onBlur={() => window.setTimeout(() => setAtAsk(null), 120)}
                onKeyDown={(event) => {
                  if (atAsk && atOptions.length) {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      const step = event.key === 'ArrowDown' ? 1 : -1
                      setAtActive((was) => (was + step + atOptions.length) % atOptions.length)
                      return
                    }
                    if (event.key === 'Enter' || event.key === 'Tab') {
                      event.preventDefault()
                      pickAt(atOptions[Math.min(atActive, atOptions.length - 1)])
                      return
                    }
                  }
                  if (atAsk && event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    setAtAsk(null)
                    return
                  }
                  if (event.key !== 'Enter' || event.shiftKey) return
                  event.preventDefault()
                  void send()
                }}
                disabled={sending}
              />
              <div className="chat-faces">
                <button
                  type="button"
                  className={`chat-face-open ${faces ? 'is-on' : ''}`}
                  title={t('chat.emoji')}
                  aria-label={t('chat.emoji')}
                  aria-expanded={faces}
                  onClick={() => setFaces((was) => !was)}
                >
                  <SmileIcon />
                </button>
                {faces && (
                  <>
                    <div className="chat-faces-away" role="presentation" onClick={() => setFaces(false)} />
                    <div className="chat-faces-pop" aria-label={t('chat.emoji')}>
                      <div className="chat-faces-tabs" role="tablist">
                        {EMOJI_SETS.map((set) => (
                          <button
                            key={set.id}
                            type="button"
                            role="tab"
                            aria-selected={faceSet === set.id}
                            className={faceSet === set.id ? 'is-on' : ''}
                            title={t(set.label)}
                            onClick={() => setFaceSet(set.id)}
                          >
                            {set.icon}
                          </button>
                        ))}
                        <button
                          type="button"
                          role="tab"
                          aria-selected={faceSet === 'ours'}
                          className={`is-ours ${faceSet === 'ours' ? 'is-on' : ''}`}
                          title={t('chat.emojiOurs')}
                          onClick={() => setFaceSet('ours')}
                        >
                          ?!
                        </button>
                      </div>
                      <b className="chat-faces-name">{t(faceSet === 'ours' ? 'chat.emojiOurs' : EMOJI_SETS.find((set) => set.id === faceSet)!.label)}</b>
                      {faceSet === 'ours' ? (
                        <div className="chat-faces-soon">
                          <span className="chat-faces-soon-art" aria-hidden>
                            ?!
                          </span>
                          <b>{t('chat.emojiSoonTitle')}</b>
                          <small>{t('chat.emojiSoonHint')}</small>
                        </div>
                      ) : (
                        <div className="chat-faces-grid" role="listbox">
                          {EMOJI_SETS.find((set) => set.id === faceSet)!.list.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button type="submit" className="primary chat-go" disabled={sending || !text.trim()} title={t('chat.send')} aria-label={t('chat.send')}>
                <SendIcon />
              </button>
            </form>
          ) : (
            <Link className="chat-join" href={href.login}>
              {t('chat.join')}
            </Link>
          )}

          {note && <span className={`chat-note ${note.bad ? 'is-bad' : ''}`}>{note.text}</span>}
        </section>
      )}

      {menu && (
        <>
          <div className="chat-menu-away" role="presentation" onClick={() => setMenu(null)} />
          <div ref={menuBox} className="chat-menu" style={{ left: menu.x, top: menuTop ?? menu.y, visibility: menuTop === null ? 'hidden' : undefined }} role="menu">
            <Link
              className="chat-menu-item"
              href={menu.line.userId === user?.id ? href.profile : href.player(menu.line.userId)}
              prefetch={false}
              onClick={() => {
                setMenu(null)
                close()
              }}
            >
              <UserIcon />
              {t('chat.profile')}
            </Link>
            {user && menu.line.userId !== user.id && (
              <>
                {mates.friends.includes(menu.line.userId) ? (
                  <button
                    type="button"
                    className="chat-menu-item"
                    onClick={() => {
                      const line = menu.line
                      setMenu(null)
                      setAsking({ kind: 'unfriend', line })
                    }}
                  >
                    <UsersIcon />
                    {t('chat.unfriend')}
                  </button>
                ) : mates.asked.includes(menu.line.userId) ? (
                  <button type="button" className="chat-menu-item" onClick={() => void mate(menu.line, 'accept')}>
                    <UsersIcon />
                    {t('chat.accept')}
                  </button>
                ) : mates.sent.includes(menu.line.userId) ? (
                  <button type="button" className="chat-menu-item" onClick={() => void mate(menu.line, 'remove')}>
                    <UsersIcon />
                    {t('chat.cancelAsk')}
                  </button>
                ) : (
                  <button type="button" className="chat-menu-item" onClick={() => void mate(menu.line, 'ask')}>
                    <UsersIcon />
                    {t('chat.befriend')}
                  </button>
                )}
                {room === 'chat' && (
                  <button
                    type="button"
                    className="chat-menu-item"
                    onClick={() => {
                      const line = menu.line
                      setMenu(null)
                      const base = text && !/\s$/.test(text) ? `${text} ` : text
                      putTag({ id: line.userId, nick: line.nickname }, { start: base.length, end: base.length }, base)
                    }}
                  >
                    <ChatIcon />
                    {t('chat.mentionAct')}
                  </button>
                )}
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
            aria-label={
              asking.kind === 'drop'
                ? t('chat.dropTitle')
                : asking.kind === 'unfriend'
                  ? t('friends.removeSure', { name: asking.line.nickname })
                  : t('chat.muteTitle', { name: asking.line.nickname })
            }
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label={t('chat.cancel')} onClick={() => setAsking(null)}>
              <CloseIcon />
            </button>

            <h2>
              {asking.kind === 'drop'
                ? t('chat.dropTitle')
                : asking.kind === 'unfriend'
                  ? t('friends.removeSure', { name: asking.line.nickname })
                  : t('chat.muteTitle', { name: asking.line.nickname })}
            </h2>
            <p className="muted">
              {asking.kind === 'drop' ? t('chat.dropHint') : asking.kind === 'unfriend' ? t('friends.removeHint') : t('chat.muteHint')}
            </p>
            {asking.kind !== 'unfriend' && <blockquote className="chat-quote">{asking.line.text}</blockquote>}

            {asking.kind === 'unfriend' ? (
              <div className="chat-ask-row">
                <button type="button" className="ghost" onClick={() => setAsking(null)}>
                  {t('profile.cancel')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    const line = asking.line
                    setAsking(null)
                    void mate(line, 'remove')
                  }}
                >
                  {t('friends.remove')}
                </button>
              </div>
            ) : asking.kind === 'drop' ? (
              <div className="chat-ask-row">
                <button type="button" className="ghost" onClick={() => setAsking(null)}>
                  {t('chat.cancel')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    void moderate({ drop: asking.line.id, ...(room === 'news' ? { channel: 'news' } : {}) }, () => setLines((kept) => kept.filter((one) => one.id !== asking.line.id)))
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
                        say(t(minutes ? 'chat.muteDone' : 'chat.unmuteDone', { name: asking.line.nickname })),
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
