'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { TONE_HEX, type Reaction } from '@nanda/game'
import { QUICK_REACT, ReactBar, ReactPills, lockedFor, mineOf, useGrowUp, withReact, type ReactLine } from './ChatReacts'
import Avatar from './Avatar'
import { GAMES } from './games'
import { api } from './api'
import { dropMentions, watchFeed } from './awards'
import ChatBout, { BOUT_TITLE, boutWorlds, type Bout } from './ChatBout'
import ChatMentions, { EVERYONE_NICK, type MentionPick, type Person } from './ChatMentions'
import { onChatOpen } from './chatEvents'
import { useDuelTalk } from './duelTalk'
import { useAuth } from './auth'
import { useI18n, type UiKey } from './i18n'
import { CardsIcon, ChatIcon, CloseIcon, DownIcon, InfoIcon, MuteIcon, ReplyIcon, SendIcon, SmileIcon, SwordsIcon, UserIcon, UsersIcon } from './icons'
import { useHref, useNavigate } from './router'
import { openStream } from './stream'
import { uiUrl } from './pics'
import { hyphenate } from './hyphen'

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
  reply?: { id: string; userId: string; nickname: string; text: string; gone?: boolean }
  bout?: Bout
  reacts?: ReactLine[]
}

const BOUT_ERRORS: Record<string, UiKey> = {
  bout_open: 'chat.boutOpen',
  bout_taken: 'chat.boutTaken',
  bout_gone: 'chat.boutGone',
  bout_too_fast: 'chat.slow',
  bout_cooldown: 'chat.boutCooldown',
  bout_muted: 'chat.muted',
}

const AT_BEFORE = /(^|\s)@([^\s@]{0,32})$/

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PICTURE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null

const emojiOnly = (text: string) => {
  const bare = text.replace(/\s+/g, '')
  if (!bare || bare.length > 40 || !graphemes) return 0
  const parts = [...graphemes.segment(bare)].map((one) => one.segment)
  return parts.length <= 3 && parts.every((part) => PICTURE.test(part)) ? parts.length : 0
}

export const toneOf = (tone?: string | null): CSSProperties | undefined => {
  const hex = GAMES.find((game) => game.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : null)
  return hex ? { color: hex } : undefined
}

const MENU_EDGE = 8
const POINT_EDGE = 16
const HOLD_MS = 450
const HOLD_SLIP = 10
const GROUP_MS = 5 * 60_000
const TYPE_GAP_MS = 3500
const PULSE_MS = 45_000
const SEEN_KEY = 'chat:seen'
const NEWS_KEY = 'chat:news-seen'
const WHO_KEY = 'chat:who'

type Room = 'chat' | 'news' | 'duel'

const EMOJI_SETS = [
  {
    id: 'faces',
    icon: '😀',
    label: 'chat.emojiFaces',
    list: [
      '😀',
      '😁',
      '😂',
      '🤣',
      '😅',
      '😊',
      '🙂',
      '😉',
      '😍',
      '🥰',
      '😘',
      '😋',
      '😜',
      '🤪',
      '😎',
      '🤓',
      '🤔',
      '🤨',
      '😐',
      '😑',
      '😏',
      '🙄',
      '😬',
      '😴',
      '😮',
      '😯',
      '😱',
      '😭',
      '🥲',
      '😢',
      '😤',
      '😡',
      '🤬',
      '🤯',
      '🥺',
      '😇',
      '🫡',
      '🫠',
      '🤡',
      '🥳',
      '🤠',
      '😈',
      '💀',
      '👻',
      '👽',
      '🤖',
      '💩',
      '🙈',
    ],
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

const SHARE_SEEN_MS = 1500
const shared: Record<'chat' | 'news', string> = { chat: '', news: '' }
const sharing: Record<'chat' | 'news', number> = { chat: 0, news: 0 }

const shareSeen = (channel: 'chat' | 'news', id: string) => {
  if (!id || id <= shared[channel]) return
  shared[channel] = id
  window.clearTimeout(sharing[channel])
  sharing[channel] = window.setTimeout(() => {
    void api(`chat?seen=${shared[channel]}&channel=${channel}`, {}).catch(() => null)
  }, SHARE_SEEN_MS)
}
const KEEP = 300
const HUNT_PAGES = 12

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const IDLE_MS = 3 * 60_000

let lastInput = Date.now()

const present = () => document.visibilityState === 'visible' && (document.hasFocus() || Date.now() - lastInput < IDLE_MS)



const RULES = ['chat.rule.respect', 'chat.rule.personal', 'chat.rule.politics', 'chat.rule.spam', 'chat.rule.admins', 'chat.rule.private'] as const
const goneReply = (line: Line, id: string): Line => (line.reply?.id === id ? { ...line, reply: { ...line.reply, text: '', gone: true } } : line)
export default function Chat() {
  const { t, l } = useI18n()
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
  const [held, setHeld] = useState<Line | null>(null)
  const [replyTo, setReplyTo] = useState<Line | null>(null)
  const [rules, setRules] = useState(false)
  const [pointed, setPointed] = useState<{ line: Line; x: number; y: number } | null>(null)
  const pointBox = useRef<HTMLDivElement>(null)
  const [pointAt, setPointAt] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const node = pointBox.current
    if (!pointed || !node) return setPointAt(null)
    const x = Math.min(pointed.x, window.innerWidth - node.offsetWidth - POINT_EDGE)
    const y = Math.min(pointed.y, window.innerHeight - node.offsetHeight - POINT_EDGE)
    setPointAt({ x: Math.max(MENU_EDGE, x), y: Math.max(MENU_EDGE, y) })
  }, [pointed])
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
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
  const [throwing, setThrowing] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [rolled, setRolled] = useState<Set<string>>(() => new Set())
  const [faceSet, setFaceSet] = useState<EmojiSet>('faces')
  const [people, setPeople] = useState<Person[]>([])
  const [atAsk, setAtAsk] = useState<{ start: number; query: string } | null>(null)
  const [atOptions, setAtOptions] = useState<MentionPick[]>([])
  const [atActive, setAtActive] = useState(0)
  const [picked, setPicked] = useState<MentionPick[]>([])
  const [tagCount, setTagCount] = useState(0)
  const [focusLine, setFocusLine] = useState<string | null>(null)
  const [hunting, setHunting] = useState(false)
  const talk = useDuelTalk()
  const talkCode = talk?.code ?? null
  const [talkSeen, setTalkSeen] = useState('')
  const feed = useRef<HTMLDivElement>(null)
  const growUp = useGrowUp(feed, lines)
  const nearEnd = useRef(true)
  const anchor = useRef<number | null>(null)
  const [away, setAway] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)

  const grow = useCallback(() => {
    const box = field.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 132)}px`
    box.style.overflowY = box.scrollHeight > 132 ? 'auto' : 'hidden'
  }, [])

  const say = useCallback((text: string, bad = false) => setNote({ text, bad }), [])

  const beat = useCallback(async () => {
    const ask = new URLSearchParams()
    const seen = lastSeen()
    if (seen) ask.set('seen', seen)
    const who = whoAmI()
    if (who) ask.set('who', who)
    if (!present()) ask.set('idle', '1')
    const { ok, data } = await api<{ online?: number; fresh?: boolean; news?: string | null; seen?: { chat?: string; news?: string } }>(`pulse?${ask.toString()}`)
    if (!ok) return
    if (typeof data.online === 'number') setOnline(data.online)
    setFresh(Boolean(data.fresh))
    setNewsTop(data.news ?? '')
    const told = data.seen
    if (told?.chat && told.chat > lastSeen()) {
      shared.chat = told.chat
      keepSeen(told.chat)
    }
    if (told?.news && told.news > readKey(NEWS_KEY)) {
      shared.news = told.news
      keepKey(NEWS_KEY, told.news)
      setNewsSeen(told.news)
    }
  }, [])

  useEffect(() => setNewsSeen(readKey(NEWS_KEY)), [])

  useEffect(() => {
    const synced = (event: StorageEvent) => {
      if (event.key === NEWS_KEY) setNewsSeen(readKey(NEWS_KEY))
      if (event.key === SEEN_KEY) void beat()
    }
    window.addEventListener('storage', synced)
    return () => window.removeEventListener('storage', synced)
  }, [beat])

  useEffect(() => {
    if (talkCode) return setRoom('duel')
    setRoom((was) => (was === 'duel' ? 'chat' : was))
  }, [talkCode])

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
    if (asked === 'duel') return null
    setLoading(true)
    const query = new URLSearchParams()
    if (before) query.set('before', before)
    if (asked === 'news') query.set('channel', 'news')
    const { ok, data } = await api<{ lines?: Line[]; more?: boolean; online?: number }>(`chat${query.toString() ? `?${query.toString()}` : ''}`)
    setLoading(false)
    if (!ok || !data.lines || roomRef.current !== asked) return null
    if (typeof data.online === 'number') setOnline(data.online)
    setMore(Boolean(data.more))
    if (!before) {
      setLines(data.lines.slice(-KEEP))
      return { lines: data.lines.slice(-KEEP), more: Boolean(data.more) }
    }
    const box = feed.current
    anchor.current = box ? box.scrollHeight - box.scrollTop : null
    let merged: Line[] = []
    setLines((kept) => {
      const known = new Set(kept.map((line) => line.id))
      merged = [...data.lines!.filter((line) => !known.has(line.id)), ...kept]
      return merged
    })
    return { lines: merged, more: Boolean(data.more) }
  }, [])

  const catchUp = useCallback(async () => {
    if (roomRef.current !== 'chat') return
    const { ok, data } = await api<{ lines?: Line[] }>('chat')
    if (!ok || !data.lines || roomRef.current !== 'chat') return
    const fresh = new Map(data.lines.map((line) => [line.id, line]))
    const settled: string[] = []
    setLines((kept) => {
      const known = new Set(kept.map((line) => line.id))
      const merged = kept.map((line) => {
        const next = fresh.get(line.id)
        if (!next) return line
        if (line.bout && !line.bout.rival && next.bout?.rival) settled.push(line.id)
        return next
      })
      const added = data.lines!.filter((line) => !known.has(line.id))
      return added.length ? [...merged, ...added].sort((one, two) => (one.id < two.id ? -1 : 1)).slice(-KEEP) : merged
    })
    if (settled.length) setRolled((had) => new Set([...had, ...settled]))
  }, [])

  useEffect(() => {
    const touch = () => {
      lastInput = Date.now()
    }
    const kinds = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    for (const kind of kinds) window.addEventListener(kind, touch, { passive: true })
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, touch)
    }
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

  const [looking, setLooking] = useState(true)

  useEffect(() => {
    const look = () => setLooking(document.visibilityState === 'visible')
    look()
    document.addEventListener('visibilitychange', look)
    return () => document.removeEventListener('visibilitychange', look)
  }, [])

  useEffect(() => {
    if (!looking) return
    if (open && room === 'duel') {
      setTalkSeen(talk?.lines.at(-1)?.id ?? '')
      return
    }
    const last = lines[lines.length - 1]
    if (!open || !last) return
    if (room === 'news') {
      if (last.id > readKey(NEWS_KEY)) keepKey(NEWS_KEY, last.id)
      setNewsSeen(readKey(NEWS_KEY))
      if (user) shareSeen('news', last.id)
      return
    }
    keepSeen(last.id)
    setFresh(false)
    if (user) shareSeen('chat', last.id)
  }, [open, lines, room, talk, user, looking])

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
    let dropped = false
    return openStream('stream/chat', {
      chat: (data) => {
        const line = data as Line | null
        if (!line?.id || roomRef.current !== 'chat') return
        setLines((kept) => (kept.some((one) => one.id === line.id) ? kept : [...kept, line].slice(-KEEP)))
      },
      bout: (data) => {
        const line = data as Line | null
        if (!line?.id || roomRef.current !== 'chat') return
        setLines((kept) => {
          const was = kept.find((one) => one.id === line.id)
          if (!was || was.bout?.rival) return kept
          setRolled((had) => new Set(had).add(line.id))
          return kept.map((one) => (one.id === line.id ? line : one))
        })
      },
      react: (data) => {
        const got = data as { id?: string; reacts?: ReactLine[] } | null
        if (!got?.id || roomRef.current !== 'chat') return
        growUp(got.id)
        setLines((kept) => kept.map((one) => (one.id === got.id ? { ...one, reacts: got.reacts } : one)))
      },
      drop: (data) => {
        const gone = (data as { id?: string } | null)?.id
        if (gone && roomRef.current === 'chat') setLines((kept) => kept.filter((line) => line.id !== gone).map((line) => goneReply(line, gone)))
      },
      typing: (data) => {
        const people = (data as { people?: { id: string; nickname: string }[] } | null)?.people
        setTypers(people ?? [])
      },
    }, (live) => {
      if (live && dropped) void catchUp()
      dropped = !live
    })
  }, [open, catchUp])

  useEffect(() => {
    if (!open) return
    const back = () => document.visibilityState === 'visible' && void catchUp()
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [open, catchUp])

  useLayoutEffect(() => {
    const box = feed.current
    if (!box || anchor.current === null) return
    box.scrollTop = box.scrollHeight - anchor.current
    anchor.current = null
  }, [lines])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (box && nearEnd.current) box.scrollTop = box.scrollHeight
  }, [lines, open, talk])

  useEffect(() => {
    if (!open) return
    const box = feed.current
    if (!box) return
    nearEnd.current = true
    setAway(false)
    box.scrollTop = box.scrollHeight
    let tall = box.clientHeight
    const stick = () => {
      if (nearEnd.current) box.scrollTop = box.scrollHeight
      else if (box.clientHeight !== tall) box.scrollTop += tall - box.clientHeight
      tall = box.clientHeight
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
      if (pointed) return setPointed(null)
      if (replyTo) return setReplyTo(null)
      if (menu) return setMenu(null)
      close()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [open, close, menu, pointed, replyTo])

  const typeBeat = useCallback(
    (on: boolean) => {
      if (!user || roomRef.current !== 'chat') return
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

  const focusField = (box = field.current) => {
    if (!box || document.activeElement === box || window.matchMedia('(pointer: coarse)').matches) return
    box.focus({ preventScroll: true })
  }

  const refocus = () => requestAnimationFrame(() => focusField())

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    refocus()
    if (room === 'duel') {
      const result = talk ? await talk.say(body) : 'failed'
      setSending(false)
      refocus()
      if (result === 'ok') {
        setText((now) => (now.trim() === body ? '' : now))
        requestAnimationFrame(grow)
        nearEnd.current = true
        return
      }
      return say(result === 'too_fast' ? t('chat.slow') : result === 'muted' ? t('chat.muted') : t('chat.failed'), true)
    }
    const lower = body.toLowerCase()
    const tags = [...new Set(picked.filter((one) => one.id && lower.includes(`@${one.nick.toLowerCase()}`)).map((one) => one.id!))]
    const { ok, status, data } = await api<{ line?: Line }>(
      'chat',
      room === 'news' ? { text: body, channel: 'news' } : { text: body, tags, ...(replyTo ? { reply: replyTo.id } : {}) },
    )
    setSending(false)
    refocus()
    if (ok && data.line) {
      typedAt.current = 0
      setText((now) => (now.trim() === body ? '' : now))
      setReplyTo(null)
      setPicked([])
      setAtAsk(null)
      requestAnimationFrame(grow)
      nearEnd.current = true
      setLines((kept) => (kept.some((one) => one.id === data.line!.id) ? kept : [...kept, data.line!]))
      return
    }
    say(status === 429 ? t('chat.slow') : status === 403 ? t('chat.muted') : t('chat.failed'), true)
  }

  const throwBout = async (game: string) => {
    setThrowing(false)
    setSending(true)
    const { ok, data } = await api<{ line?: Line }>('chat', { bout: game })
    setSending(false)
    if (ok && data.line) {
      nearEnd.current = true
      setLines((kept) => (kept.some((one) => one.id === data.line!.id) ? kept : [...kept, data.line!]))
      return
    }
    say(t(BOUT_ERRORS[data.error ?? ''] ?? 'chat.failed'), true)
  }

  const joinBout = async (id: string) => {
    setJoining(id)
    const { ok, data } = await api<{ line?: Line }>('chat', { join: id })
    setJoining(null)
    if (ok && data.line) {
      setRolled((had) => new Set(had).add(id))
      setLines((kept) => kept.map((one) => (one.id === id && !one.bout?.rival ? data.line! : one)))
      return
    }
    say(t(BOUT_ERRORS[data.error ?? ''] ?? 'chat.failed'), true)
  }

  const setReacts = (id: string, reacts: ReactLine[] | undefined) => {
    growUp(id)
    setLines((kept) => kept.map((one) => (one.id === id ? { ...one, reacts } : one)))
  }

  const react = async (line: Line, kind: Reaction) => {
    if (!user) return
    setPointed(null)
    setHeld(null)
    const now = lines.find((one) => one.id === line.id) ?? line
    const next = mineOf(now.reacts, user.id) === kind ? null : kind
    if (next && lockedFor(next, patron)) return say(t('chat.reactPatron', { title: t('title.patron') }), true)
    setReacts(line.id, withReact(now.reacts, next, user))
    const { ok, data } = await api<{ reacts?: ReactLine[] }>('chat', { react: line.id, kind: next })
    if (ok && data.reacts) return setReacts(line.id, data.reacts)
    setReacts(line.id, now.reacts)
    if (data.error === 'react_patron') return say(t('chat.reactPatron', { title: t('title.patron') }), true)
    say(t(data.error === 'muted' ? 'chat.muted' : data.error === 'too_fast' ? 'chat.slow' : 'chat.reactFailed'), true)
  }

  const reactBar = (line: Line) => (
    <ReactBar mine={mineOf((lines.find((one) => one.id === line.id) ?? line).reacts, user?.id)} patron={patron} onPick={(kind) => void react(line, kind)} />
  )

  const moderate = async (body: Record<string, unknown>, done: () => void) => {
    setAsking(null)
    const { ok } = await api('admin/chat', body)
    if (!ok) return say(t('chat.failed'), true)
    done()
  }

  const drop = async (line: Line) => {
    const gone = () => setLines((kept) => kept.filter((one) => one.id !== line.id).map((one) => goneReply(one, line.id)))
    if (user?.admin) return moderate({ drop: line.id, ...(room === 'news' ? { channel: 'news' } : {}) }, gone)
    setAsking(null)
    const { ok } = await api('chat', { drop: line.id })
    if (!ok) return say(t('chat.failed'), true)
    gone()
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
  const patron = Boolean(user?.titles?.includes(BOUT_TITLE))
  const canWrite = room === 'chat' || room === 'duel' || Boolean(user?.admin)
  const limit = room === 'news' ? 1500 : room === 'duel' ? 200 : 300
  const shown: Line[] = room === 'duel' ? (talk?.lines ?? []) : lines
  const shownIds = new Set(shown.map((line) => line.id))
  const mine = (line: Line) => line.userId === user?.id
  const talkFresh = Boolean(talk?.lines.length) && talk!.lines.at(-1)!.id !== talkSeen && !mine(talk!.lines.at(-1)!)
  const rooms: Room[] = talkCode ? ['duel', 'chat', 'news'] : ['chat', 'news']

  const addEmoji = (emoji: string) => {
    const box = field.current
    const start = box?.selectionStart ?? text.length
    const end = box?.selectionEnd ?? text.length
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(0, limit)
    setText(next)
    requestAnimationFrame(() => {
      if (!box) return
      focusField(box)
      const at = Math.min(start + emoji.length, next.length)
      box.setSelectionRange(at, at)
      grow()
    })
  }

  const readAt = (value: string, caret: number) => {
    if (room === 'duel') return setAtAsk(null)
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
      focusField(box)
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
    if (!names.length) return hyphenate(line.text)
    const split = new RegExp(
      `(@(?:${[...names]
        .sort((a, b) => b.length - a.length)
        .map(escape)
        .join('|')}))`,
      'gi',
    )
    return line.text.split(split).map((part, index) => {
      if (index % 2 === 0) return hyphenate(part)
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

  const canReply = Boolean(user) && room === 'chat'
  const reactable = (line: Line) => canReply && !line.bout
  const canModerate = Boolean(user?.admin) && room !== 'duel'
  const canDrop = (line: Line) => canModerate || (room === 'chat' && Boolean(user) && line.userId === user?.id)
  const holdable = canReply || canModerate

  const answer = (line: Line) => {
    setMenu(null)
    setPointed(null)
    setHeld(null)
    setReplyTo(line)
    requestAnimationFrame(() => focusField())
  }

  const jump = async (id: string) => {
    if (shownIds.has(id)) return setFocusLine(id)
    if (room === 'duel' || hunting) return say(t('chat.replyGone'))
    setHunting(true)
    try {
      let older = lines[0]?.id
      let left = more
      for (let page = 0; page < HUNT_PAGES && left && older; page++) {
        const got = await load(older)
        if (!got) break
        if (got.lines.some((line) => line.id === id)) return setFocusLine(id)
        if (got.lines[0]?.id === older) break
        older = got.lines[0]?.id
        left = got.more
      }
      say(t(left ? 'chat.replyFar' : 'chat.replyGone'))
    } finally {
      setHunting(false)
    }
  }

  const letGo = () => {
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
  }

  const holdOn = (line: Line) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (!holdable || event.pointerType !== 'touch') return
      letGo()
      hold.current = {
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          hold.current = null
          setMenu(null)
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
      if (!reactable(line) || (event.target as HTMLElement).closest('button, a, .bout')) return
      window.getSelection()?.removeAllRanges()
      void react(line, QUICK_REACT)
    },
    onContextMenu: (event: React.MouseEvent) => {
      if (!holdable) return
      event.preventDefault()
      if (window.matchMedia('(hover: none)').matches) return
      setMenu(null)
      setPointed({ line, x: event.clientX, y: event.clientY })
    },
  })

  const watch = () => {
    const box = feed.current
    if (!box) return
    const left = box.scrollHeight - box.scrollTop - box.clientHeight
    nearEnd.current = left < 80
    setAway(left > 320)
  }

  const shut = () => {
    setMenu(null)
    setPointed(null)
  }

  const toEnd = () => {
    const box = feed.current
    if (!box) return
    nearEnd.current = true
    box.scrollTop = box.scrollHeight
    setAway(false)
  }

  return (
    <>
      <button type="button" className={`chat-bubble ${open ? 'is-open' : ''}`} aria-label={t('chat.title')} onClick={() => (open ? close() : setOpen(true))}>
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && tagCount > 0 ? (
          <em className="chat-count" aria-label={t('chat.mentionNew')}>
            {tagCount > 9 ? '9+' : tagCount}
          </em>
        ) : (
          !open && (fresh || newsFresh || talkFresh) && <em className="chat-dot" aria-label={t('chat.fresh')} />
        )}
      </button>

      {open && <div className={`chat-shade ${leaving ? 'is-leaving' : ''}`} role="presentation" onClick={close} />}

      {open && (
        <section className={`chat-panel ${leaving ? 'is-leaving' : ''}`} aria-label={t('chat.title')}>
          <header className="chat-head">
            <div className="chat-rooms" role="tablist" aria-label={t('chat.title')}>
              {rooms.map((one) => (
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
                  {t(one === 'news' ? 'chat.roomNews' : one === 'duel' ? 'chat.roomDuel' : 'chat.roomAll')}
                  {one === 'news' && newsFresh && room !== 'news' && <em className="chat-room-dot" aria-label={t('chat.newsFresh')} />}
                  {one === 'duel' && talkFresh && room !== 'duel' && <em className="chat-room-dot" aria-label={t('chat.fresh')} />}
                </button>
              ))}
            </div>
            {online > 0 && <em className="chat-online">{t('chat.online', { count: online })}</em>}
            <button type="button" className="chat-x" aria-label={t('chat.rules')} title={t('chat.rules')} onClick={() => setRules(true)}>
              <InfoIcon />
            </button>
            <button type="button" className="chat-x" aria-label={t('chat.close')} onClick={close}>
              <CloseIcon />
            </button>
          </header>

          <div className="chat-feed-wrap">
            <div className="chat-feed" ref={feed} onScroll={watch} onWheel={shut} onTouchMove={shut}>
              {more && room !== 'duel' && (
                <button type="button" className="chat-earlier" disabled={loading} onClick={() => void load(lines[0]?.id)}>
                  {t('chat.earlier')}
                </button>
              )}
              {shown.length === 0 && (room === 'duel' || !loading) && (
                <p className="chat-empty">{t(room === 'news' ? 'chat.newsEmpty' : room === 'duel' ? 'chat.duelEmpty' : 'chat.empty')}</p>
              )}
              {shown.map((line, index) => {
                const before = shown[index - 1]
                const glued = !line.reply && before && before.userId === line.userId && line.at - before.at < GROUP_MS
                return (
                  <article
                    key={line.id}
                    id={`chat-line-${line.id}`}
                    {...holdOn(line)}
                    className={`chat-line ${holdable ? 'is-holdable' : ''} ${pointed?.line.id === line.id || held?.id === line.id ? 'is-pointed' : ''} ${line.reply ? 'has-reply' : ''} ${glued ? 'is-glued' : ''} ${line.userId === user?.id ? 'is-mine' : ''} ${
                      user && line.userId !== user.id && (line.everyone || line.tags?.some((tag) => tag.id === user.id)) ? 'is-tagged' : ''
                    }`}
                  >
                    {line.reply && (
                      <button type="button" className="chat-thread" onClick={() => void jump(line.reply!.id)} title={t('chat.replyJump')}>
                        <i aria-hidden />
                        <b>{line.reply.nickname}</b>
                        <span className={line.reply.gone ? 'is-gone' : ''}>{line.reply.gone ? t('chat.replyDeleted') : line.reply.text}</span>
                      </button>
                    )}
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
                        <Avatar id={line.userId} name={line.nickname} avatar={line.avatar} frame={line.frame} className="chat-av" small live />
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
                      {line.bout ? (
                        <ChatBout
                          id={line.id}
                          bout={line.bout}
                          host={{ id: line.userId, nickname: line.nickname, avatar: line.avatar, frame: line.frame }}
                          at={line.at}
                          me={user?.id ?? null}
                          live={rolled.has(line.id)}
                          joining={joining === line.id}
                          onJoin={(id) => void joinBout(id)}
                          onLeave={close}
                        />
                      ) : (
                        (() => {
                          const big = line.tags?.length || line.everyone ? 0 : emojiOnly(line.text)
                          return <p className={big ? `is-emoji is-emoji-${big}` : undefined}>{bodyOf(line)}</p>
                        })()
                      )}
                      {!line.bout && <ReactPills reacts={line.reacts} me={user?.id} active={canReply} onPick={(kind) => void react(line, kind)} />}
                    </div>
                  </article>
                )
              })}
            </div>
            {away && (
              <button type="button" className="chat-to-end" aria-label={t('chat.toEnd')} title={t('chat.toEnd')} onClick={toEnd}>
                <DownIcon />
              </button>
            )}
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

          {user && room === 'duel' && talk?.alone ? (
            <p className="chat-readonly">{t('chat.duelAlone')}</p>
          ) : user && !canWrite ? (
            <p className="chat-readonly">{t('chat.newsOnly')}</p>
          ) : user ? (
            <>
              {replyTo && room === 'chat' && (
                <div className="chat-reply-bar">
                  <ReplyIcon />
                  <button type="button" className="chat-reply-what" onClick={() => void jump(replyTo.id)}>
                    <b>{t('chat.replyTo', { name: replyTo.nickname })}</b>
                    <span>{replyTo.text}</span>
                  </button>
                  <button
                    type="button"
                    className="chat-reply-x"
                    aria-label={t('chat.replyCancel')}
                    title={t('chat.replyCancel')}
                    onClick={() => setReplyTo(null)}
                  >
                    <CloseIcon />
                  </button>
                </div>
              )}
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
                  maxLength={limit}
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
                />
                {room === 'chat' && (
                  <div className="chat-faces">
                    <button
                      type="button"
                      className={`chat-face-open ${throwing ? 'is-on' : ''}`}
                      aria-label={t('chat.boutThrow')}
                      aria-expanded={throwing}
                      disabled={sending}
                      onClick={() => {
                        setFaces(false)
                        setThrowing((was) => !was)
                      }}
                    >
                      <CardsIcon />
                      <span className="chat-face-tip" aria-hidden>
                        {t('chat.boutThrow')}
                      </span>
                    </button>
                    {throwing && !patron && (
                      <>
                        <div className="chat-faces-away" role="presentation" onClick={() => setThrowing(false)} />
                        <div className="chat-faces-pop chat-bout-lock" role="tooltip">
                          {t('chat.boutPatron')} <i className="player-title is-slim is-patron">{t('title.patron')}</i>
                        </div>
                      </>
                    )}
                    {throwing && patron && (
                      <>
                        <div className="chat-faces-away" role="presentation" onClick={() => setThrowing(false)} />
                        <div className="chat-faces-pop chat-bout-pop" aria-label={t('chat.boutPick')}>
                          <b className="chat-faces-name">{t('chat.boutPick')}</b>
                          <ul className="card-worlds">
                            {boutWorlds().map((game) => (
                              <li key={game.id}>
                                <button type="button" onClick={() => void throwBout(game.id)}>
                                  <img src={uiUrl(`worlds/big/${game.id}.webp`)} alt="" width={36} height={36} loading="lazy" decoding="async" draggable={false} />
                                  <span>{l(game.label)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="chat-faces">
                  <button
                    type="button"
                    className={`chat-face-open ${faces ? 'is-on' : ''}`}
                    aria-label={t('chat.emoji')}
                    aria-expanded={faces}
                    onClick={() => {
                      setThrowing(false)
                      setFaces((was) => !was)
                    }}
                  >
                    <SmileIcon />
                    <span className="chat-face-tip" aria-hidden>
                      {t('chat.emoji')}
                    </span>
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
                <button
                  type="submit"
                  className="primary chat-go"
                  disabled={sending || !text.trim()}
                  title={t('chat.send')}
                  aria-label={t('chat.send')}
                  onPointerDown={(event) => event.preventDefault()}
                >
                  <SendIcon />
                </button>
              </form>
            </>
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
          <div
            ref={menuBox}
            className="chat-menu"
            style={{ left: menu.x, top: menuTop ?? menu.y, visibility: menuTop === null ? 'hidden' : undefined }}
            role="menu"
          >
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
                {room === 'chat' && (
                  <button type="button" className="chat-menu-item" onClick={() => answer(menu.line)}>
                    <ReplyIcon />
                    {t('chat.reply')}
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
          <div
            ref={pointBox}
            className="chat-menu is-point"
            style={{ left: pointAt?.x ?? pointed.x, top: pointAt?.y ?? pointed.y, visibility: pointAt ? undefined : 'hidden' }}
            role="menu"
            aria-label={t('chat.holdAct')}
          >
            {reactable(pointed.line) && reactBar(pointed.line)}
            {canReply && (
              <button type="button" className="chat-menu-item" onClick={() => answer(pointed.line)}>
                <ReplyIcon />
                {t('chat.reply')}
              </button>
            )}
            {canDrop(pointed.line) && (
              <button
                type="button"
                className="chat-menu-item is-bad"
                onClick={() => {
                  setAsking({ kind: 'drop', line: pointed.line })
                  setPointed(null)
                }}
              >
                <CloseIcon />
                {t('chat.drop')}
              </button>
            )}
            {canModerate && pointed.line.userId !== user?.id && (
              <button
                type="button"
                className="chat-menu-item"
                onClick={() => {
                  setAsking({ kind: 'mute', line: pointed.line })
                  setPointed(null)
                }}
              >
                <MuteIcon />
                {t('chat.mute')}
              </button>
            )}
          </div>
        </>
      )}

      {held && (
        <div className="modal-backdrop chat-hold-away" onClick={() => setHeld(null)} role="presentation">
          <section className="card chat-hold" role="dialog" aria-modal="true" aria-label={t('chat.holdAct')} onClick={(event) => event.stopPropagation()}>
            <blockquote className="chat-quote">
              <b>{held.nickname}</b>
              {held.text}
            </blockquote>
            {reactable(held) && reactBar(held)}
            {canReply && (
              <button type="button" className="chat-hold-item" onClick={() => answer(held)}>
                <ReplyIcon />
                {t('chat.reply')}
              </button>
            )}
            {canDrop(held) && (
              <button
                type="button"
                className="chat-hold-item is-bad"
                onClick={() => {
                  setAsking({ kind: 'drop', line: held })
                  setHeld(null)
                }}
              >
                <CloseIcon />
                {t('chat.drop')}
              </button>
            )}
            {canModerate && held.userId !== user?.id && (
              <button
                type="button"
                className="chat-hold-item"
                onClick={() => {
                  setAsking({ kind: 'mute', line: held })
                  setHeld(null)
                }}
              >
                <MuteIcon />
                {t('chat.mute')}
              </button>
            )}
            <button type="button" className="chat-hold-item is-quiet" onClick={() => setHeld(null)}>
              {t('chat.cancel')}
            </button>
          </section>
        </div>
      )}

      {rules && (
        <div className="modal-backdrop" onClick={() => setRules(false)} role="presentation">
          <section className="card modal chat-ask chat-rules" role="dialog" aria-modal="true" aria-label={t('chat.rules')} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('chat.cancel')} onClick={() => setRules(false)}>
              <CloseIcon />
            </button>
            <h2>{t('chat.rules')}</h2>
            <ol>
              {RULES.map((key, at) => (
                <li key={key}>
                  <b>{at + 1}</b>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ol>
            <p className="chat-rules-foot">{t('chat.rulesFoot')}</p>
            <div className="chat-ask-row">
              <button type="button" className="chat-rules-ok" onClick={() => setRules(false)}>
                {t('chat.rulesOk')}
              </button>
            </div>
          </section>
        </div>
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
            <p className="muted">{asking.kind === 'drop' ? t('chat.dropHint') : asking.kind === 'unfriend' ? t('friends.removeHint') : t('chat.muteHint')}</p>
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
                  onClick={() => void drop(asking.line)}
                >
                  {t('chat.dropYes')}
                </button>
              </div>
            ) : (
              <div className="chat-ask-row is-times">
                {(
                  [
                    [15, 'chat.mute15'],
                    [60, 'chat.mute60'],
                    [1440, 'chat.muteDay'],
                    [0, 'chat.unmute'],
                  ] as const
                ).map(([minutes, key]) => (
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
