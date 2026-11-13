import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Avatar from './Avatar'
import TilePop from './TilePop'
import AvatarPicker from './AvatarPicker'
import BackButton from './BackButton'
import { useAuth } from './auth'
import { api } from './api'
import { GAMES } from './games'
import { l10n, type GameId } from './games/types'
import { useI18n } from './i18n'
import { type Level } from './Quests'
import type { UiKey } from './i18n/ui'
import { MODES } from './modes'
import { ProfileGhost } from './PageSkeleton'
import Rail from './Rail'
import { ArrowIcon, CalendarIcon, CloseIcon, GearIcon, GripIcon, LockIcon, PaletteIcon, PencilIcon, PictureIcon, PlusIcon, SwordsIcon, TrophyIcon, UserCheckIcon, UserPlusIcon, UsersIcon, UserWaitIcon } from './icons'
import AwardIcon from './awardIcons'
import { useHref, useNavigate } from './router'
import { refreshFeed } from './awards'
import { SHOWCASE_MAX } from './showcase'
import { keepPerUser } from './session-cache'
import { showTone } from './tone'
import BannerArt, { mediaSize } from './BannerArt'
import BannerTuner from './BannerTuner'
import GemIcon from './GemIcon'
import ProfileStage, { useNarrow } from './ProfileStage'
import { liveZoom, pageZoom } from './profile-zoom'
import { bannerPic, bannerSpot, spotLook } from './banners'
import BannerFrame from './BannerFrame'
import {
  CARD_PINS_MAX,
  cardPinsMax,
  HERO_TILES,
  HERO_TILES_DEFAULT,
  HERO_TILES_MAX,
  BANNERS,
  PROFILE_BLOCKS,
  PROFILE_BLOCKS_DEFAULT,
  TONES,
  TONE_HEX,
  isBanner,
  isHeroTile,
  isTone,
  scrapValue,
  type Banner,
  type BannerLook,
  type HeroTile,
  type ProfileBlock,
} from '@nanda/game'
import { uiUrl } from './pics'
import { ShowcaseCard } from './Bestiary'
import { tornPoints } from './torn'
import { useShelfSort } from './useShelfSort'
import { afterHold } from './hold'
import ProfileBoard, { type BoardSave } from './ProfileBoard'

const UNPIN_POINTS = tornPoints(42, 9, 4)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')
const GLOW_CROP = 1.12
const GLOW_WIDE = 1440
const GLOW_GROW = 1.5

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  pinned: { id: string | null; family: string | null; tier: string; at: string | null; rarity?: number | null; hidden?: boolean }[]
  awards: number
  awardsTotal: number
  level: Level
  totals: {
    solved: number
    played: number
    gaveUp: number
    guesses: number
    characters: number
  }
  duels: {
    played: number
    wins: number
    losses: number
    draws: number
    modes?: { mode: string; played: number; wins: number }[]
    recent?: { rivalId: string | null; rival: string; game: string | null; mode: string | null; wins: number; losses: number; board?: number[]; won: boolean; at: string }[]
  }
  challenges: { solved: number }
  favourite: GameId | null
  rank: { position: number; players: number } | null
  nickname?: string
  tag?: string | null
  avatar?: string | null
  frame?: string | null
  friend?: FriendState
  blocks?: string[] | null
  blockSizes?: Record<string, number>
  blockSides?: Record<string, number>
  blockSeen?: Record<string, number>
  gamePlaces: { game: GameId; mode: string; position: number }[]
  showcase: string[]
  tests?: { published: number; plays: number; likes: number; list: { id: string; game: string; title: string; plays: number; likes: number }[] }
  cards?: { game: GameId; id: number; xp: number; image?: string; name: Named }[]
  tiles?: (string | null)[] | null
  banner?: string | null
  bannerLook?: Partial<Record<'desktop' | 'tablet' | 'phone' | 'board', { x: number; y: number; z: number; lift?: number }>> | null
  banners?: string[]
  bannersGiven?: string[]
  tone?: string | null
  nickTone?: string | null
  title?: string | null
  streak: {
    current: number
    best: number
    week: { day: string; played: boolean }[]
  }
  games: { game: GameId; pool: number; solved: number }[]
  modes: { mode: string; played: number; won: number; guesses: number }[]
  recent: {
    game: string
    mode: string
    answerId?: number
    status: string
    guessCount?: number
    daily?: string
    challenge?: string
    finishedAt?: string
    name?: Named | null
    hidden?: boolean
  }[]
}

type FriendState = 'none' | 'out' | 'in' | 'friends'

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

const DAYS = {
  ru: ['день подряд', 'дня подряд', 'дней подряд'],
  uk: ['день поспіль', 'дні поспіль', 'днів поспіль'],
  en: ['day in a row', 'days in a row', 'days in a row'],
} as const

const ROUNDS = {
  ru: ['игра', 'игры', 'игр'],
  uk: ['гра', 'гри', 'ігор'],
  en: ['round', 'rounds', 'rounds'],
} as const

const pluralOf = (count: number, lang: keyof typeof ROUNDS, forms: typeof ROUNDS | typeof DAYS = ROUNDS) => {
  if (lang === 'en') return forms.en[count === 1 ? 0 : 1]
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return forms[lang][0]
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return forms[lang][1]
  return forms[lang][2]
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

let knownSummary: Summary | null = null

keepPerUser(() => {
  knownSummary = null
})

export const MARKS = [
  { left: '7%', top: '28%', size: 76, tilt: -9 },
  { left: '20%', top: '66%', size: 28, tilt: 6 },
  { left: '33%', top: '16%', size: 42, tilt: -4 },
  { left: '51%', top: '60%', size: 98, tilt: -11 },
  { left: '64%', top: '21%', size: 34, tilt: 7 },
  { left: '78%', top: '64%', size: 56, tilt: -6 },
  { left: '93%', top: '32%', size: 24, tilt: 5 },
]

function FitLabel({ full, short }: { full: string; short: string }) {
  const node = useRef<HTMLSpanElement>(null)
  const ghost = useRef<HTMLSpanElement>(null)
  const [tight, setTight] = useState(false)

  useLayoutEffect(() => {
    const label = node.current
    const probe = ghost.current
    if (!label || !probe) return
    const check = () => setTight(probe.scrollWidth > label.clientWidth + 1)
    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(label)
    return () => watcher.disconnect()
  }, [full, short])

  return (
    <span ref={node} className="fact-label" title={tight ? full : undefined}>
      {tight ? short : full}
      <span ref={ghost} className="fact-label-probe" aria-hidden>
        {full}
      </span>
    </span>
  )
}


const dim = (hex: string) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((one) => one + one).join('')}` : hex
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 0.28
}
export default function Profile({ id }: { id?: string }) {
  const { user, refresh } = useAuth()
  const own = !id
  const { t, l, lang, name: nameOf } = useI18n()
  const named = (value: Named) => nameOf({ name: value.ru, nameUk: value.uk !== value.ru ? value.uk : undefined, nameEn: value.en })
  const href = useHref()

  const [summary, setSummary] = useState<Summary | null>(own ? knownSummary : null)
  const [adding, setAdding] = useState<HTMLElement | null>(null)
  const [locked, setLocked] = useState<HTMLElement | null>(null)
  const [awardTip, setAwardTip] = useState<{ at: HTMLElement; id: string | null; got: string | null; share: number | null; secret: boolean } | null>(null)
  const blankAt = useRef<(HTMLButtonElement | null)[]>([])
  const lockAt = useRef<(HTMLButtonElement | null)[]>([])
  const [places, setPlaces] = useState(false)
  const [edit, setEdit] = useState(false)
  const [layout, setLayout] = useState<ProfileBlock[] | null>(null)
  const [board, setBoard] = useState<Omit<BoardSave, 'blocks'> | null>(null)

  useEffect(() => {
    if (!places) return
    const away = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.('.profile-facts')) setPlaces(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setPlaces(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [places])

  const [tip, setTip] = useState(false)
  const modesRef = useRef<HTMLDivElement>(null)
  const [tipAt, setTipAt] = useState<HTMLElement | null>(null)
  const [weekAt, setWeekAt] = useState<HTMLElement | null>(null)
  const [week, setWeek] = useState(false)
  const weekRef = useRef<HTMLDivElement>(null)
  const [duelAt, setDuelAt] = useState<HTMLElement | null>(null)
  const [duelOpen, setDuelOpen] = useState(false)
  const [shop, setShop] = useState<number | null>(null)
  const shopRef = useRef<HTMLDivElement>(null)
  const [mix, setMix] = useState<(HeroTile | null)[] | null>(null)
  const [paint, setPaint] = useState<string | null | undefined>(undefined)
  const [ink, setInk] = useState<string | null | undefined>(undefined)
  const [badge, setBadge] = useState<string | null | undefined>(undefined)
  const [dye, setDye] = useState(false)
  const [dyeAt, setDyeAt] = useState<HTMLElement | null>(null)
  const [skin, setSkin] = useState<Banner | null | undefined>(undefined)
  const [skins, setSkins] = useState(false)
  const [scrap, setScrap] = useState<Banner | null>(null)
  const [tuning, setTuning] = useState(false)
  const [framing, setFraming] = useState<BannerLook | null>(null)
  const [framingBusy, setFramingBusy] = useState(false)
  useEffect(() => {
    if (!edit) setFraming(null)
  }, [edit])
  const [tones, setTones] = useState(false)
  const tonesRef = useRef<HTMLDivElement>(null)
  const skinsRef = useRef<HTMLDivElement>(null)
  const dyes = useRef<HTMLDivElement>(null)
  const [grabbed, setGrabbed] = useState<number | null>(null)
  const [lift, setLift] = useState<{ one: HeroTile; w: number; h: number } | null>(null)
  const liftAt = useRef({ x: 0, y: 0 })
  const liftBox = useRef<HTMLSpanElement | null>(null)
  const pads = useRef<HTMLDivElement>(null)
  const [tight, setTight] = useState(false)
  const narrow = useNarrow()
  const fresh = !narrow

  useEffect(() => {
    if (narrow) setFraming(null)
  }, [narrow])

  useEffect(() => {
    if (!skins && !tones) return
    const away = (event: MouseEvent) => {
      if (!skinsRef.current?.contains(event.target as Node)) setSkins(false)
      if (!tonesRef.current?.contains(event.target as Node)) setTones(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSkins(false)
      setTones(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [skins, tones])

  useEffect(() => {
    if (shop === null) return
    const away = (event: MouseEvent) => {
      if (!shopRef.current?.contains(event.target as Node)) setShop(null)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setShop(null)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [shop])

  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<Summary>(own ? 'profile/summary' : `profile/summary?id=${id}`)
    if (!ok) return setFailed(true)
    if (own) knownSummary = data
    setSummary(data)
  }, [id, own])

  useEffect(() => {
    void load()
    if (own) void refresh()
  }, [load, own, refresh])

  const [friend, setFriend] = useState<FriendState>('none')
  const [unfriending, setUnfriending] = useState(false)
  const [calling, setCalling] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setFriend(summary?.friend ?? 'none')
  }, [summary?.friend])

  const askFriend = async (target: string) => {
    const { ok, data } = await api<{ state?: FriendState }>('friends', { action: 'ask', id: target })
    if (ok) setFriend(data.state ?? 'out')
  }

  const answerFriend = async (target: string, accept: boolean) => {
    const { ok, data } = await api<{ state?: FriendState }>('friends', { action: accept ? 'accept' : 'decline', id: target })
    if (ok) setFriend(data.state ?? 'none')
    void refreshFeed()
  }

  const removeFriend = async (target: string) => {
    const { ok } = await api('friends', { action: 'remove', id: target })
    if (ok) setFriend('none')
  }

  const challenge = async (target: string) => {
    setCalling(true)
    const { ok, data } = await api<{ duel?: { code: string } }>('duel', { action: 'challenge', to: target })
    setCalling(false)
    if (ok && data.duel) navigate(href.duel(data.duel.code))
  }

  const nickname = (own ? user?.nickname : summary?.nickname) ?? ''
  const tag = (own ? user?.tag : summary?.tag) ?? null
  const mine = user?.titles ?? []
  const title = (own ? (badge === undefined ? (user?.title ?? null) : badge) : (summary?.title ?? null)) ?? null

  const pinned = summary?.pinned ?? []
  const best = summary?.gamePlaces?.[0] ?? null

  const date = (value?: string, long = false) => {
    if (!value) return '—'
    const when = new Date(value)
    if (long) {
      const parts = new Intl.DateTimeFormat(LOCALES[lang], { month: 'short', year: 'numeric' }).formatToParts(when)
      const month = parts.find((part) => part.type === 'month')?.value ?? ''
      const year = parts.find((part) => part.type === 'year')?.value ?? ''
      return `${month} ${year}`
    }
    const today = new Date().toDateString() === when.toDateString()
    return today
      ? when.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })
      : when.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' })
  }

  const medal = (position: number) => (position === 1 ? 'gold' : position === 2 ? 'silver' : position === 3 ? 'bronze' : '')

  const games = summary?.games ?? []
  const picked = (summary?.showcase ?? [])
    .map((id) => games.find((row) => row.game === id))
    .filter((row): row is NonNullable<typeof row> => !!row)
    .slice(0, SHOWCASE_MAX)
  const shelf = picked.length ? picked : games.slice(0, SHOWCASE_MAX)
  const blanks = Math.max(0, SHOWCASE_MAX - shelf.length)

  const deck = (summary?.cards ?? []).slice(0, CARD_PINS_MAX)
  const homes = games.filter((row) => row.solved > 0).sort((a, b) => b.solved - a.solved)
  const sorting = edit && own && !!user
  const worldSort = useShelfSort(shelf, (row) => row.game, sorting, (next) => {
    const ids = next.map((row) => row.game)
    setSummary((was) => (was ? { ...was, showcase: ids } : was))
    void api('profile', { action: 'showcase', showcase: ids })
  })
  const awardSort = useShelfSort(pinned, (award) => award.id ?? 'secret', sorting, (next) => {
    setSummary((was) => (was ? { ...was, pinned: next } : was))
    void api('achievements', { pinned: next.map((award) => award.id).filter(Boolean) })
  })
  const cardSort = useShelfSort(deck, (card) => `${card.game}:${card.id}`, sorting, (next) => {
    setSummary((was) => (was ? { ...was, cards: next } : was))
    void api('profile', { action: 'cardPins', pins: next.map((one) => `${one.game}:${one.id}`) })
  })
  useEffect(() => {
    if (!sorting) setAdding(null)
  }, [sorting])
  const holdLinks = (event: ReactMouseEvent<HTMLElement>) => {
    if (sorting && !(event.target as Element).closest('.is-blank, .free')) event.preventDefault()
  }

  const unpin = (card: (typeof deck)[number]) => {
    const rest = deck.filter((one) => one !== card)
    setSummary((was) => (was ? { ...was, cards: rest } : was))
    void api('profile', { action: 'cardPins', pins: rest.map((one) => `${one.game}:${one.id}`) })
  }
  const gameLabel = (id: string) => GAMES.find((g) => g.id === id)?.label
  const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label ?? 'mode.classic'

  const saidTone = summary?.tone
  const tone = paint === undefined ? (isTone(saidTone) ? saidTone : null) : paint
  const toneHex = GAMES.find((game) => game.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : undefined)
  const toneText = toneHex && dim(toneHex) ? '#ffffff' : toneHex
  const saidNick = summary?.nickTone
  const nickTone = ink === undefined ? (isTone(saidNick) ? saidNick : null) : ink
  const nickHex = GAMES.find((game) => game.id === nickTone)?.accent ?? (nickTone && TONE_HEX.test(nickTone) ? nickTone : undefined)
  const dyeList = [
    ...TONES.map((id) => GAMES.find((game) => game.id === id)).filter((game) => !!game),
    { id: '#f2f4f8', accent: '#f2f4f8', label: l10n('Белый', 'Білий', 'White') },
    { id: '#2b3038', accent: '#2b3038', label: l10n('Чёрный', 'Чорний', 'Black') },
  ]

  const heroBox = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!fresh) return
    const body = document.body
    const fit = () => {
      const zoom = pageZoom(window.innerWidth)
      body.style.zoom = zoom === 1 ? '' : String(zoom)
      body.style.setProperty('--page-zoom', String(zoom))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      body.style.zoom = ''
      body.style.removeProperty('--page-zoom')
    }
  }, [fresh])

  useLayoutEffect(() => {
    const hero = heroBox.current
    const glow = hero?.querySelector<HTMLElement>('.profile-glow')
    const art = glow?.querySelector(':scope > :is(img, video)')
    if (!hero || !glow || !art || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      let top = 0
      for (let node: HTMLElement | null = hero; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop
      top = Math.max(0, Math.round(top + hero.clientTop))
      hero.style.setProperty('--glow-top', `${top}px`)
      const natural = mediaSize(art)
      if (!natural?.w || !natural.h) return
      const stretch = GLOW_CROP + (Math.max(0, GLOW_WIDE - window.innerWidth) / GLOW_WIDE) * GLOW_GROW
      hero.style.setProperty('--glow-h', `${Math.round(((glow.clientWidth * natural.h) / natural.w) * stretch)}px`)
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(hero)
    watch.observe(glow)
    window.addEventListener('resize', fit)
    art.addEventListener('load', fit)
    art.addEventListener('loadedmetadata', fit)
    return () => {
      watch.disconnect()
      window.removeEventListener('resize', fit)
      art.removeEventListener('load', fit)
      art.removeEventListener('loadedmetadata', fit)
    }
  }, [summary?.banner, skin, fresh])

  useLayoutEffect(() => {
    showTone(tone)
    return () => showTone(null)
  }, [tone])

  useLayoutEffect(() => {
    const grid = pads.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const wide = grid.parentElement?.getBoundingClientRect().width ?? 0
      const room = wide - 60
      const seats = HERO_TILES_MAX
      const area = (440 + Math.max(0, (room - 802) / 2)) * 0.8
      const slot = Math.max(120, Math.round((area - (seats - 1) * 10) / seats))
      grid.style.setProperty('--slot', `${Math.round(slot * 0.85)}px`)
      const cell = grid.firstElementChild?.getBoundingClientRect()
      setTight(!!cell && cell.width < 200)
    }
    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(grid)
    window.addEventListener('resize', check)
    return () => {
      watcher.disconnect()
      window.removeEventListener('resize', check)
    }
  })

  useEffect(() => {
    const strip = dyes.current
    if (!strip) return
    const roll = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      strip.scrollLeft += event.deltaY
    }
    strip.addEventListener('wheel', roll, { passive: false })
    return () => strip.removeEventListener('wheel', roll)
  }, [skins])

  const nickBox = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const nick = nickBox.current
    const body = nick?.closest<HTMLElement>('.profile-hero-body')
    if (!nick || !body || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      nick.style.removeProperty('--nick-room')
      nick.style.removeProperty('--nick-fit')
      if (narrow) {
        const line = nick.closest<HTMLElement>('.hero-nick-line')
        const dye = nick.parentElement?.querySelector<HTMLElement>('.nick-dye')
        const room = (line?.clientWidth ?? 0) - (dye ? dye.offsetWidth + 7 : 0) - 4
        const need = nick.scrollWidth
        if (room > 0 && need > room) nick.style.setProperty('--nick-fit', String(Math.max(0.55, room / need)))
        return
      }
      const tiles = body.querySelector<HTMLElement>(':scope > .profile-hero-tiles')
      const box = nick.getBoundingClientRect()
      if (!tiles || tiles.getBoundingClientRect().top < box.bottom) return
      const used = parseFloat(getComputedStyle(nick).width)
      const scale = used > 0 ? box.width / used : 1
      const shell = body.getBoundingClientRect()
      const pad = parseFloat(getComputedStyle(body).paddingRight) * (shell.width / (parseFloat(getComputedStyle(body).width) || shell.width))
      const dye = nick.parentElement?.querySelector<HTMLElement>('.nick-dye')
      const edge = shell.right - pad - (dye ? dye.getBoundingClientRect().width + 7 * scale : 0)
      nick.style.setProperty('--nick-room', `${Math.max(0, Math.floor((edge - box.left) / scale))}px`)
    }
    fit()
    let alive = true
    void document.fonts?.ready.then(() => alive && fit())
    const watch = new ResizeObserver(fit)
    watch.observe(body)
    return () => {
      alive = false
      watch.disconnect()
    }
  }, [nickname, edit, narrow, summary])

  if (!summary && !failed) return <ProfileGhost visit={!!id} />

  const shown = layout ?? ((summary?.blocks as ProfileBlock[] | null | undefined) ?? PROFILE_BLOCKS_DEFAULT)
  const rest = PROFILE_BLOCKS.filter((block) => !shown.includes(block))

  const keep = (next: ProfileBlock[]) => {
    setLayout(next)
    void api('profile', { action: 'blocks', blocks: next, sizes: boardSizes, sides: boardSides, seen: boardSeen })
  }

  const saveBoard = (next: BoardSave) => {
    setLayout(next.blocks)
    setBoard({ sides: next.sides, seen: next.seen, sizes: next.sizes })
    void api('profile', { action: 'blocks', blocks: next.blocks, sizes: next.sizes, sides: next.sides, seen: next.seen })
  }

  const hide = (block: ProfileBlock) => keep(shown.filter((one) => one !== block))

  const saved = mix ?? (summary?.tiles as (HeroTile | null)[] | null | undefined) ?? HERO_TILES_DEFAULT
  const seats: (HeroTile | null)[] = Array.from({ length: HERO_TILES_MAX }, (_, spot) => (isHeroTile(saved[spot]) ? saved[spot] : null))
  const slots = seats.filter(isHeroTile)
  const spare = HERO_TILES.filter((one) => !slots.includes(one))
  const holes: null[] = slots.length < HERO_TILES_MAX ? [null] : []
  const cells: (HeroTile | null)[] = !own || !edit ? slots : [...slots, ...holes]

  const keepTiles = (next: (HeroTile | null)[]) => {
    setMix(next)
    void api('profile', { action: 'tiles', tiles: next })
  }

  const putTile = (spot: number, one: HeroTile) => {
    const next = cells.map((item) => (item === one ? null : item))
    next[spot] = one
    keepTiles(next)
  }

  const dropTile = (spot: number) => keepTiles(cells.map((item, index) => (index === spot ? null : item)))

  const banner = skin === undefined ? (isBanner(summary?.banner) ? summary.banner : null) : skin
  const heroLooks = banner ? (own ? user?.bannerLooks?.[banner] : summary?.bannerLook) : null
  const heroLook = framing ?? heroLooks?.desktop ?? (banner ? spotLook(banner) : undefined)

  const keepFraming = async () => {
    if (!banner || !framing) return
    setFramingBusy(true)
    const { ok } = await api('profile', { action: 'bannerLook', banner, look: { ...(user?.bannerLooks?.[banner] ?? {}), desktop: framing } })
    if (ok) await refresh()
    setFramingBusy(false)
    if (ok) setFraming(null)
  }
  const owned = BANNERS.filter((one) => (summary?.banners ?? []).includes(one))

  const keepBanner = (next: Banner | null) => {
    setSkin(next)
    void api('profile', { action: 'banner', banner: next }).then(() => refresh())
  }

  const refundOf = (one: Banner) => ((summary?.bannersGiven ?? []).includes(one) ? null : scrapValue(one))

  const scrapBanner = async (one: Banner) => {
    setScrap(null)
    const { ok } = await api('profile', { action: 'breakBanner', banner: one })
    if (!ok) return
    if (banner === one) setSkin(null)
    setSummary((was) => (was ? { ...was, banners: (was.banners ?? []).filter((id) => id !== one), banner: was.banner === one ? null : was.banner } : was))
    void refresh()
  }

  const keepTone = (next: string | null) => {
    setPaint(next)
    void api('profile', { action: 'tone', tone: next }).then(() => refresh())
  }

  const keepNick = (next: string | null) => {
    setInk(next)
    void api('profile', { action: 'nickTone', nickTone: next }).then(() => refresh())
  }

  const keepTitle = (next: string | null) => {
    setBadge(next)
    void api('profile', { action: 'title', title: next }).then(() => refresh())
  }

  const grabTile = (spot: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button !== 0) return
    if ((event.target as HTMLElement).closest('.tile-off')) return
    const one = cells[spot]
    if (!one) return

    const cell = event.currentTarget
    const row = cell.parentElement
    const box = cell.getBoundingClientRect()
    const zoom = liveZoom()
    const grip = { x: event.clientX - box.left, y: event.clientY - box.top }
    const start = { x: event.clientX, y: event.clientY }
    const base = cells.slice()
    let order = base.slice()
    let at = spot
    let moved = false

    const seatAt = (x: number, y: number) =>
      [...(row?.querySelectorAll<HTMLElement>(':scope > .hero-tile') ?? [])].findIndex((node) => {
        const seat = node.getBoundingClientRect()
        return x >= seat.left && x <= seat.right && y >= seat.top && y <= seat.bottom
      })

    const place = (step: PointerEvent) => {
      liftAt.current = { x: (step.clientX - grip.x) / zoom, y: (step.clientY - grip.y) / zoom }
      const node = liftBox.current
      if (node) node.style.transform = `translate3d(${liftAt.current.x}px, ${liftAt.current.y}px, 0)`
    }

    const move = (step: PointerEvent) => {
      if (!moved && Math.abs(step.clientX - start.x) < 5 && Math.abs(step.clientY - start.y) < 5) return
      if (!moved) {
        moved = true
        setGrabbed(spot)
        setLift({ one, w: box.width / zoom, h: box.height / zoom })
      }

      place(step)

      const seat = seatAt(step.clientX, step.clientY)
      if (seat < 0 || seat === at || seat >= base.length) return
      const next = base.slice()
      next[spot] = base[seat]
      next[seat] = one
      order = next
      at = seat
      setGrabbed(seat)
      setMix(next)
    }

    const drop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
      setGrabbed(null)
      setLift(null)
      if (moved) keepTiles(order)
    }

    afterHold(event, (held) => {
      if (held) {
        moved = true
        setGrabbed(spot)
        setLift({ one, w: box.width / zoom, h: box.height / zoom })
        liftAt.current = { x: (start.x - grip.x) / zoom, y: (start.y - grip.y) / zoom }
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', drop)
      window.addEventListener('pointercancel', drop)
    })
  }

  const tileName = (wide: UiKey, slim: UiKey) => t(tight ? slim : wide)

  const tileFace = (one: HeroTile) => {
    if (one === 'duels')
      return { label: t('profile.duelsTitle'), value: summary?.duels.played ? `${percent(summary.duels.wins, summary.duels.played)}%` : '—' }
    if (one === 'rank') return { label: tileName('profile.rank', 'profile.rankShort'), value: summary?.rank ? `#${summary.rank.position}` : '—' }
    if (one === 'awards')
      return { label: tileName('profile.block.awards', 'profile.awardsShort'), value: `${summary?.awards ?? 0}`, tail: `/ ${summary?.awardsTotal ?? 0}` }
    if (one === 'challenges')
      return { label: tileName('profile.challengeSolved', 'profile.challengeShort'), value: `${summary?.challenges.solved ?? 0}` }
    if (one === 'streak') return { label: tileName('profile.streakTitle', 'profile.streakShort'), value: `${summary?.streak.current ?? 0}` }
    return { label: tileName('profile.characters', 'profile.charactersShort'), value: `${summary?.totals.solved ?? 0}` }
  }

  const boardSides = board?.sides ?? summary?.blockSides ?? {}
  const boardSeen = board?.seen ?? summary?.blockSeen ?? {}
  const boardSizes = board?.sizes ?? summary?.blockSizes ?? {}

  const shutPops = () => {
    setPlaces(false)
    setTip(false)
    setWeek(false)
    setShop(null)
  }

  const show = (block: ProfileBlock) => keep([...shown, block])

  const tune = () => setEdit((was) => !was)

  const panels: Record<ProfileBlock, ReactNode | ((cols: number) => ReactNode)> = {
    facts: (
      <section className="card profile-card facts-card">
        <header>
          <h2>{t('profile.block.facts')}</h2>
        </header>
        <div className="profile-facts">
          {best ? (
            <button
              type="button"
              className={`fact fact-rank ${medal(best.position)} ${places ? 'open' : ''}`}
              aria-expanded={places}
              onClick={() => setPlaces((was) => !was)}
            >
              <FitLabel full={t('profile.bestGame')} short={t('profile.bestGameShort')} />
              <b className="fact-value">#{best.position}</b>
            </button>
          ) : (
            <div className="fact fact-rank">
              <FitLabel full={t('profile.bestGame')} short={t('profile.bestGameShort')} />
              <b className="fact-value empty">—</b>
            </div>
          )}

          {places && summary && (
            <div className="places-pop" role="dialog" aria-label={t('profile.placesTitle')}>
              <span className="places-pop-title">{t('profile.placesTitle')}</span>
              <ol className="places-list">
                {summary.gamePlaces.map((row) => (
                  <li key={`${row.game}_${row.mode}`} className={medal(row.position)}>
                    <b>#{row.position}</b>
                    <span>
                      <i title={l(gameLabel(row.game)!)}>{l(gameLabel(row.game)!)}</i>
                      <small>{t(modeLabel(row.mode))}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="fact">
            <FitLabel full={t('profile.favourite')} short={t('profile.favouriteShort')} />
            {summary?.favourite ? (
              <b className="fact-value" title={l(gameLabel(summary.favourite)!)}>
                {l(gameLabel(summary.favourite)!)}
              </b>
            ) : (
              <b className="fact-value empty">—</b>
            )}
          </div>
        </div>

      </section>
    ),
    quizzes: (
      <section className="card profile-card tests-card">
        <header>
          <h2>{t('quiz.title')}</h2>
          {own && !summary?.tests?.published && (
            <Link className="tests-make" href={href.makeTest()} prefetch={false}>
              <PlusIcon />
              {t('profile.testsMake')}
            </Link>
          )}
        </header>
        {summary?.tests?.published ? (
          <div className="tests-stats">
            <span>
              <small>{t('profile.testsPublished')}</small>
              <b>{summary.tests.published.toLocaleString(LOCALES[lang])}</b>
            </span>
            <span>
              <small>{t('profile.testsPlays')}</small>
              <b>{summary.tests.plays.toLocaleString(LOCALES[lang])}</b>
            </span>
            <span>
              <small>{t('profile.testsLikes')}</small>
              <b>{summary.tests.likes.toLocaleString(LOCALES[lang])}</b>
            </span>
          </div>
        ) : (
          <p className="tests-empty muted">{t('profile.testsNone')}</p>
        )}
      </section>
    ),
    activity: (
      <section className="card activity-card">
        <header>
          <h2>{t('profile.activity')}</h2>
        </header>
        {summary?.recent.length ? (
          <ul className="activity">
            {summary.recent.map((round, index) => (
              <li key={`${round.game}-${round.answerId}-${index}`}>
                <span className={`activity-dot ${round.status}`} aria-hidden />
                <span className="activity-text">
                  <i>
                    {t(round.status === 'won' ? 'profile.won' : round.status === 'skipped' ? 'profile.gaveUp' : 'profile.lost', {
                      name: round.name ? named(round.name) : round.hidden ? t('profile.secret') : `#${round.answerId}`,
                    })}
                  </i>
                  <small>
                    {gameLabel(round.game) ? l(gameLabel(round.game)!) : round.game} · {t(modeLabel(round.mode))}
                    {round.challenge ? ` · ${t('profile.fromFriend')}` : ''}
                    {round.guessCount ? ` · ${t('profile.tries', { count: round.guessCount })}` : ''}
                  </small>
                </span>
                <span className="activity-when muted">{date(round.finishedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted center">{t('profile.activityEmpty')}</p>
        )}
      </section>
    ),
    worlds: (cols: number) => (
      <section className="card worlds-card">
        <header>
          <h2>{t('profile.worlds')}</h2>
          {!!user && (
            <Link prefetch={false} className="worlds-all" href={own || !id ? href.worlds : href.playerWorlds(id)}>
              {t('profile.worldsAll', { count: summary?.games.length ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        {shelf.length || own ? (
          <ul className={`world-shelf ${sorting ? 'is-sortable' : ''}`} ref={worldSort.list} onClickCapture={holdLinks}>
            {worldSort.sorted.map((row) => {
              const game = GAMES.find((g) => g.id === row.game)
              const share = percent(row.solved, row.pool)
              return (
                <li
                  key={row.game}
                  {...worldSort.handle(row.game)}
                  className={worldSort.dragging === row.game ? 'is-dragging' : undefined}
                  style={{ '--world-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}
                >
                  <Link href={own || !id ? href.bestiary(row.game as GameId) : href.playerBestiary(id, row.game as GameId)} prefetch={false}>
                    <span className="world-pic" style={{ '--fill': `${share}%` } as CSSProperties}>
                      <img
                        className="world-art"
                        src={uiUrl(`worlds/big/${row.game}.webp`)}
                        alt=""
                        width={448}
                        height={448}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className="world-lit" style={{ backgroundImage: `url(${uiUrl(`worlds/big/${row.game}.webp`)})` }} />
                      {share > 0 && share < 100 && <i className="world-edge" />}
                      <em className={`world-share ${share >= 100 ? 'is-full' : ''}`}>
                        {share}%
                      </em>
                      <b className="world-count">
                        {row.solved}
                        <small>/ {row.pool}</small>
                      </b>
                    </span>
                    <span className="world-line">
                      <b>{game ? l(game.label) : row.game}</b>
                    </span>
                  </Link>
                </li>
              )
            })}
            {Array.from({ length: sorting ? blanks : Math.min(blanks, (cols - (shelf.length % cols)) % cols) }, (_, index) => (
              <li key={`blank-${index}`} className="is-blank">
                {own && user ? (
                  <Link
                    className="world-blank"
                    href={href.worlds}
                    aria-label={t('worlds.pin')}
                    title={t('worlds.pin')}
                    prefetch={false}
                  >
                    <span className="world-pic is-empty">
                      <PlusIcon />
                    </span>
                    <span className="world-line" aria-hidden>
                      <b />
                    </span>
                  </Link>
                ) : (
                  <span className="world-blank" aria-hidden>
                    <span className="world-pic is-empty" />
                    <span className="world-line">
                      <b />
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted center">{t('profile.activityEmpty')}</p>
        )}
      </section>
    ),
    cards: (
      <section className={`card cards-card ${deck.length || sorting ? '' : 'is-empty'}`} aria-label={t('profile.cardsTitle')}>
        <ul className={`card-shelf ${sorting ? 'is-sortable' : ''}`} ref={cardSort.list}>
          {cardSort.sorted.map((card) => (
            <li
              key={`${card.game}:${card.id}`}
              {...cardSort.handle(`${card.game}:${card.id}`)}
              className={cardSort.dragging === `${card.game}:${card.id}` ? 'is-dragging' : undefined}
              style={{ '--dex': GAMES.find((one) => one.id === card.game)?.accent ?? 'var(--accent)' } as CSSProperties}
            >
              {edit && own ? (
                <span className="card-edit">
                  <ShowcaseCard game={card.game} id={card.id} image={card.image} label={named(card.name)} xp={card.xp} />
                  <button type="button" className="card-unpin" aria-label={t('profile.cardsRemove')} title={t('profile.cardsRemove')} onClick={() => unpin(card)}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                      <polygon points={UNPIN_POINTS} vectorEffect="non-scaling-stroke" />
                    </svg>
                    <CloseIcon />
                  </button>
                </span>
              ) : (
                <Link href={own || !id ? href.bestiary(card.game) : href.playerBestiary(id, card.game)} prefetch={false} aria-label={named(card.name)}>
                  <ShowcaseCard game={card.game} id={card.id} image={card.image} label={named(card.name)} xp={card.xp} />
                </Link>
              )}
            </li>
          ))}
          {sorting &&
            Array.from({ length: Math.max(0, CARD_PINS_MAX - deck.length) }, (_, index) =>
              deck.length + index >= cardPinsMax(user?.titles) ? (
                <li key={`blank-${index}`} className="is-blank">
                  <button
                    type="button"
                    className={`card-blank is-locked ${locked && locked === lockAt.current[index] ? 'is-open' : ''}`}
                    ref={(node) => {
                      lockAt.current[index] = node
                    }}
                    aria-label={t('profile.cardsPatron')}
                    title={t('profile.cardsPatron')}
                    onClick={(event) => setLocked(event.currentTarget)}
                  >
                    <LockIcon />
                  </button>
                </li>
              ) : (
              <li key={`blank-${index}`} className="is-blank">
                <button
                  type="button"
                  className={`card-blank ${adding && adding === blankAt.current[index] ? 'is-open' : ''}`}
                  ref={(node) => {
                    blankAt.current[index] = node
                  }}
                  aria-label={t('profile.cardsAdd')}
                  title={t('profile.cardsAdd')}
                  onClick={(event) => setAdding(event.currentTarget)}
                >
                  <PlusIcon />
                </button>
              </li>
            ))}
        </ul>
        {locked && (
          <TilePop at={locked} wide={300} onClose={() => setLocked(null)}>
            <div className="patron-slot">
              <span className="patron-slot-mark" aria-hidden>
                <LockIcon />
              </span>
              <h2>{t('profile.cardsPatron')}</h2>
              <p>{t('profile.cardsPatronHint', { title: t('title.patron') })}</p>
              <Link className="primary" href={href.support} prefetch={false} onClick={() => setLocked(null)}>
                {t('profile.cardsPatronGo')}
              </Link>
            </div>
          </TilePop>
        )}
        {adding && (
          <TilePop at={adding} wide={300} onClose={() => setAdding(null)}>
            <header>
              <h2>{t('profile.cardsPick')}</h2>
            </header>
            <ul className="card-worlds">
              {homes.map((row) => {
                const game = GAMES.find((one) => one.id === row.game)
                return (
                  <li key={row.game}>
                    <Link href={href.bestiary(row.game as GameId)} prefetch={false} onClick={() => setAdding(null)}>
                      <img src={uiUrl(`worlds/big/${row.game}.webp`)} alt="" width={36} height={36} loading="lazy" decoding="async" draggable={false} />
                      <span>{game ? l(game.label) : row.game}</span>
                      <small>{row.solved}</small>
                    </Link>
                  </li>
                )
              })}
              {!homes.length && <li className="muted">{t('profile.activityEmpty')}</li>}
            </ul>
          </TilePop>
        )}
      </section>
    ),
    awards: (cols: number) => (
      <section className="card soon-card">
        <header>
          <h2>
            {t('profile.awardsTitle')}
            <small>
              {summary?.awards ?? 0} / {summary?.awardsTotal ?? 0}
            </small>
          </h2>
          {!!user && (
            <Link prefetch={false} className="worlds-all" href={own || !id ? href.achievements : href.playerAwards(id)}>
              {t('profile.worldsAll', { count: summary?.awardsTotal ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        <ul className={`soon-badges ${sorting ? 'is-sortable' : ''}`} ref={awardSort.list} onClickCapture={holdLinks}>
          {Array.from({ length: sorting ? SHOWCASE_MAX : Math.min(SHOWCASE_MAX, Math.ceil(awardSort.sorted.length / cols) * cols) }, (_, index) => {
            const award = awardSort.sorted[index]
            if (!award)
              return (
                <li key={index} className="free">
                  {own && user ? (
                    <Link href={href.achievements} aria-label={t('profile.awardsFreeHint')} prefetch={false}>
                      <span className="soon-mark" aria-hidden>
                        <PlusIcon />
                      </span>
                      <b aria-hidden />
                    </Link>
                  ) : (
                    <>
                      <span className="soon-mark" aria-hidden />
                      <b aria-hidden />
                    </>
                  )}
                </li>
              )
            const secret = award.hidden || !award.id
            return (
              <li
                key={award.id ?? `secret-${index}`}
                {...(award.id ? awardSort.handle(award.id) : {})}
                className={`on tier-${award.tier} ${awardSort.dragging && awardSort.dragging === award.id ? 'is-dragging' : ''}`}
              >
                <button
                  type="button"
                  className="soon-open"
                  aria-expanded={awardTip?.id === award.id && !!awardTip}
                  onClick={(event) => {
                    if (sorting) return
                    const at = event.currentTarget
                    setAwardTip((was) => (was?.at === at ? null : { at, id: award.id, got: award.at, share: award.rarity ?? null, secret }))
                  }}
                >
                  <span className="soon-mark" aria-hidden>
                    {award.family ? <AwardIcon family={award.family} award={award.id} /> : <TrophyIcon />}
                  </span>
                  <b>{secret ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                </button>
              </li>
            )
          })}
        </ul>
        {awardTip && (
          <TilePop at={awardTip.at} wide={270} onClose={() => setAwardTip(null)}>
            <div className="award-tip">
              <p>{awardTip.secret ? t('ach.secretHint') : t(`ach.${awardTip.id}.hint` as UiKey)}</p>
              {(awardTip.got || awardTip.share != null) && (
                <dl>
                  {awardTip.got && (
                    <div>
                      <dt>
                        <CalendarIcon />
                        {t('ach.gotTitle')}
                      </dt>
                      <dd>{new Date(awardTip.got).toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                    </div>
                  )}
                  {awardTip.share != null && (
                    <div>
                      <dt>
                        <UsersIcon />
                        {t('ach.shareTitle')}
                      </dt>
                      <dd>{t('ach.shareOf', { share: awardTip.share.toLocaleString(LOCALES[lang]) })}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </TilePop>
        )}
      </section>
    ),
  }

  const tilesBlock =
    cells.length > 0 ? (
      <div className={`profile-hero-tiles ${narrow ? 'is-under' : ''} ${edit ? 'is-edit' : ''}`} ref={pads}>
        {cells.map((one, spot) => {
          if (!one)
            return (
              <div
                key={`free-${spot}`}
                className={`hero-tile is-add ${shop === spot ? 'is-open' : ''} ${edit ? '' : 'is-hole'} ${grabbed === spot ? 'is-held' : ''}`}
                ref={shop === spot ? shopRef : undefined}
              >
                {edit && (
                  <button type="button" className="hero-tile-open" aria-label={t('profile.tileAdd')} onClick={() => setShop(shop === spot ? null : spot)}>
                    <PlusIcon />
                  </button>
                )}
                {shop === spot && (
                  <div className="modes-pop" role="dialog">
                    <header>
                      <h2>{t('profile.tileAdd')}</h2>
                    </header>
                    <ul className="tile-shop">
                      {spare.map((free) => (
                        <li key={free}>
                          <button
                            type="button"
                            className="hero-tile"
                            onClick={() => {
                              putTile(spot, free)
                              setShop(null)
                            }}
                          >
                            <span>{tileFace(free).label}</span>
                            <b>
                              {tileFace(free).value}
                              {(() => {
                                const face = tileFace(free)
                                return 'tail' in face && face.tail ? <i>{face.tail}</i> : null
                              })()}
                            </b>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
  
          const off = edit && (
            <button type="button" className="tile-off" aria-label={t('profile.tileHide')} onClick={() => dropTile(spot)}>
              <CloseIcon />
            </button>
          )
  
          if (one === 'solved')
            return (
              <div
                key={one}
                className={`hero-tile is-modes ${tip ? 'is-open' : ''} ${grabbed === spot ? 'is-held' : ''}`}
                onPointerDown={grabTile(spot)}
                ref={modesRef}
              >
                <button
                  type="button"
                  className="hero-tile-open"
                  aria-expanded={tip}
                  onClick={(event) => {
                    setTipAt(event.currentTarget.closest<HTMLElement>('.hero-tile'))
                    setTip((was) => !was)
                  }}
                >
                  <span>{tileName('profile.characters', 'profile.charactersShort')}</span>
                  <b>{summary?.totals.solved ?? 0}</b>
                </button>
                {off}
                {tip && (
                  <TilePop at={tipAt} onClose={() => setTip(false)}>
                    <header>
                      <h2>{t('profile.modes')}</h2>
                      <span className="muted">{t('profile.accuracy')}</span>
                    </header>
                    <ul className="modes-list">
                      {MODES.filter((mode) => mode.id !== 'clue').map((mode) => {
                        const row = summary?.modes.find((item) => item.mode === mode.id)
                        const duel = summary?.duels?.modes?.find((item) => item.mode === mode.id)
                        const played = (row?.played ?? 0) + (duel?.played ?? 0)
                        const share = percent((row?.won ?? 0) + (duel?.wins ?? 0), played)
                        return (
                          <li key={mode.id} className={played ? '' : 'is-empty'}>
                            <span className="mode-name">{t(mode.label)}</span>
                            <span className="mode-count muted">
                              {played} {pluralOf(played, lang)}
                            </span>
                            <b>{share}%</b>
                            <span className="mode-bar">{!!played && <i style={{ width: `${Math.max(share, 2)}%` }} />}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </TilePop>
                )}
              </div>
            )
  
          if (one === 'streak')
            return (
              <div
                key={one}
                className={`hero-tile is-modes is-streak ${week ? 'is-open' : ''} ${grabbed === spot ? 'is-held' : ''}`}
                onPointerDown={grabTile(spot)}
                ref={weekRef}
              >
                <button
                  type="button"
                  className="hero-tile-open"
                  aria-expanded={week}
                  onClick={(event) => {
                    setWeekAt(event.currentTarget.closest<HTMLElement>('.hero-tile'))
                    setWeek((was) => !was)
                  }}
                >
                  <span>{tileName('profile.streakTitle', 'profile.streakShort')}</span>
                  <b>{summary?.streak.current ?? 0}</b>
                </button>
                {off}
                {week && (
                  <TilePop at={weekAt} onClose={() => setWeek(false)}>
                    <header>
                      <h2>{t('profile.streakTitle')}</h2>
                      <span className="muted">{t('profile.streakRecord', { days: summary?.streak.best ?? 0 })}</span>
                    </header>
                    <ul className="streak-days">
                      {(summary?.streak.week ?? []).map((day) => (
                        <li key={day.day} className={day.played ? 'is-on' : ''}>
                          <span />
                          <small>{new Date(day.day).toLocaleDateString(lang, { weekday: 'short' })}</small>
                        </li>
                      ))}
                    </ul>
                  </TilePop>
                )}
              </div>
            )
  
          if (one === 'duels') {
            const record = summary?.duels
            const played = record?.played ?? 0
            const byMode = (record?.modes ?? []).filter((row) => row.played > 0).sort((a, b) => b.played - a.played)
            return (
              <div
                key={one}
                className={`hero-tile is-modes is-duels ${duelOpen ? 'is-open' : ''} ${grabbed === spot ? 'is-held' : ''}`}
                onPointerDown={grabTile(spot)}
              >
                <button
                  type="button"
                  className="hero-tile-open"
                  aria-expanded={duelOpen}
                  onClick={(event) => {
                    setDuelAt(event.currentTarget.closest<HTMLElement>('.hero-tile'))
                    setDuelOpen((was) => !was)
                  }}
                >
                  <span>{tileName('profile.duelsTitle', 'profile.duelsTitle')}</span>
                  <b>{played ? `${percent(record?.wins ?? 0, played)}%` : '—'}</b>
                </button>
                {off}
                {duelOpen && (
                  <TilePop at={duelAt} onClose={() => setDuelOpen(false)}>
                    <header>
                      <h2>{t('profile.duelsTitle')}</h2>
                      <span className="muted">{t('profile.duelPlayed', { count: played })}</span>
                    </header>
                    {played ? (
                      <div className="duel-pop">
                        <ul className="duel-pop-score">
                          <li className="is-won">
                            <b>{record?.wins ?? 0}</b>
                            <small>{t('profile.duelWon')}</small>
                          </li>
                          <li className="is-lost">
                            <b>{record?.losses ?? 0}</b>
                            <small>{t('profile.duelLosses')}</small>
                          </li>
                          <li>
                            <b>{record?.draws ?? 0}</b>
                            <small>{t('profile.duelDraws')}</small>
                          </li>
                        </ul>
                        {byMode.length > 0 && (
                          <>
                            <h3>{t('profile.duelModes')}</h3>
                            <ul className="modes-list">
                              {byMode.map((row) => {
                                const mode = MODES.find((item) => item.id === row.mode)
                                const share = percent(row.wins, row.played)
                                return (
                                  <li key={row.mode}>
                                    <span className="mode-name">{mode ? t(mode.label) : row.mode}</span>
                                    <span className="mode-count muted">{t('profile.duelPlayed', { count: row.played })}</span>
                                    <b>{share}%</b>
                                    <span className="mode-bar">
                                      <i style={{ width: `${Math.max(share, 2)}%` }} />
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </>
                        )}
                        {(record?.recent?.length ?? 0) > 0 && (
                          <>
                            <h3>{t('profile.duelRecent')}</h3>
                            <ul className="duel-pop-log">
                              {record!.recent!.map((row, at) => {
                                const game = GAMES.find((item) => item.id === row.game)
                                const mode = MODES.find((item) => item.id === row.mode)
                                return (
                                  <li key={`${row.at}-${at}`} className={row.won ? 'is-won' : 'is-lost'}>
                                    <em>{t(row.won ? 'profile.duelWin' : 'profile.duelLoss')}</em>
                                    <span>
                                      <b>{row.rival}</b>
                                      <small>{[game ? l(game.label) : null, mode ? t(mode.label) : null].filter(Boolean).join(' · ')}</small>
                                    </span>
                                    <strong>{(row.board ?? [row.wins, row.losses]).join(':')}</strong>
                                  </li>
                                )
                              })}
                            </ul>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="muted">{t('profile.duelNone')}</p>
                    )}
                  </TilePop>
                )}
              </div>
            )
          }

          const face = tileFace(one)
          return (
            <div
              key={one}
              className={`hero-tile ${one === 'rank' && summary?.rank ? medal(summary.rank.position) : ''} ${grabbed === spot ? 'is-held' : ''}`}
              onPointerDown={grabTile(spot)}
            >
              <span>{face.label}</span>
              <b>
                {face.value}
                {'tail' in face && face.tail ? <i>{face.tail}</i> : null}
              </b>
              {off}
            </div>
          )
        })}
      </div>
    ) : null

  const heroActs =
    own && edit ? (
          <div className={`hero-acts ${narrow ? 'is-bar' : ''}`}>
            <div className={`banner-pick ${skins ? 'is-open' : ''}`} ref={skinsRef}>
                <button
                  type="button"
                  className="hero-act"
                  aria-label={t('profile.banner')}
                  title={t('profile.banner')}
                  onClick={() => setSkins(!skins)}
                >
                  <PictureIcon />
                  {fresh && <span className="hero-act-label">{t('profile.banner')}</span>}
                </button>
                {skins && (
                  <div className="modes-pop" role="dialog">
                    <header>
                      <h2>{t('profile.banner')}</h2>
                      {banner && (
                        <button
                          type="button"
                          className="look-open"
                          onClick={() => {
                            setSkins(false)
                            if (fresh) setFraming(heroLooks?.desktop ?? spotLook(banner))
                            else setTuning(true)
                          }}
                        >
                          {t('profile.bannerTune')}
                          <PencilIcon />
                        </button>
                      )}
                    </header>
                    <ul className="banner-shop">
                      <li>
                        <button type="button" className={`banner-face is-none ${banner ? '' : 'on'}`} onClick={() => keepBanner(null)}>
                          <i aria-hidden>
                            {MARKS.map((mark) => (
                              <em
                                key={mark.left}
                                style={
                                  {
                                    left: mark.left,
                                    top: mark.top,
                                    fontSize: Math.round(mark.size * 0.3),
                                    transform: `translate(-50%, -50%) rotate(${mark.tilt}deg)`,
                                  } as CSSProperties
                                }
                              >
                                ?!
                              </em>
                            ))}
                          </i>
                          <span>{t('profile.bannerNone')}</span>
                        </button>
                      </li>
                      {owned.map((one) => {
                        const refund = refundOf(one)
                        return (
                          <li key={one} className="banner-slot">
                            <button type="button" className={`banner-face ${banner === one ? 'on' : ''}`} onClick={() => keepBanner(one)}>
                              <img src={bannerPic(one)} alt="" />
                              <span>{t(`banner.${one}` as UiKey)}</span>
                            </button>
                            {refund && (
                              <button
                                type="button"
                                className="banner-scrap"
                                aria-label={t('profile.bannerScrap')}
                                title={t('profile.bannerScrap')}
                                onClick={() => {
                                  setSkins(false)
                                  setScrap(one)
                                }}
                              >
                                <CloseIcon />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
            </div>
            <div className={`banner-pick tone-pick ${tones ? 'is-open' : ''}`} ref={tonesRef}>
                <button
                  type="button"
                  className="hero-act"
                  aria-label={t('profile.toneTheme')}
                  title={t('profile.toneTheme')}
                  onClick={() => setTones(!tones)}
                >
                  <PaletteIcon />
                  {fresh && <span className="hero-act-label">{t('profile.toneTheme')}</span>}
                </button>
                {tones && (
                  <div className="modes-pop" role="dialog">
                    <header>
                      <h2>{t('profile.toneTheme')}</h2>
                    </header>
                    <Rail className="tone-rail" trackClass="tone-track" innerRef={dyes}>
                      <ul className="tone-shop">
                        {dyeList.map((game) => (
                          <li key={game.id}>
                            <button
                              type="button"
                              className={`tone-dot ${tone === game.id ? 'on' : ''}`}
                              style={{ '--dot': game.accent } as CSSProperties}
                              aria-label={l(game.label)}
                              title={l(game.label)}
                              onClick={() => keepTone(tone === game.id ? null : game.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </Rail>
                  </div>
                )}
            </div>
          </div>
    ) : null

  const heroId = (
    <div className="profile-hero-id">
      {own ? <AvatarPicker edit={edit} /> : <Avatar id={id} name={nickname} avatar={summary?.avatar} frame={summary?.frame} />}
      <div className="profile-hero-main">
        <div className="profile-hero-name" style={(nickHex ? { '--nick': nickHex } : {}) as CSSProperties}>
          <span className="hero-nick-line">
            <span className="hero-nick-who">
              <h1 ref={nickBox}>{nickname}</h1>
              {edit && (
                <button
                  type="button"
                  className={`nick-dye ${dye ? 'is-open' : ''}`}
                  title={t('profile.toneNick')}
                  aria-label={t('profile.toneNick')}
                  onClick={(event) => {
                    setDyeAt(event.currentTarget)
                    setDye((was) => !was)
                  }}
                >
                  <PencilIcon />
                </button>
              )}
            </span>
          </span>
          {tag && <i className="player-tag">#{tag}</i>}
          {title && <i className={`player-title is-${title} is-under`}>{t(`title.${title}` as UiKey)}</i>}
          {edit && dye && (
            <TilePop at={dyeAt} wide={286} onClose={() => setDye(false)}>
              <header>
                <h2>{t('profile.toneNick')}</h2>
              </header>
              <ul className="tone-shop is-wrap">
                <li>
                  <button
                    type="button"
                    className={`tone-dot is-plain ${nickTone ? '' : 'on'}`}
                    style={{ '--dot': '#ffffff' } as CSSProperties}
                    aria-label={t('profile.toneNickPlain')}
                    title={t('profile.toneNickPlain')}
                    onClick={() => keepNick(null)}
                  />
                </li>
                {dyeList.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      className={`tone-dot ${nickTone === game.id ? 'on' : ''}`}
                      style={{ '--dot': game.accent } as CSSProperties}
                      aria-label={l(game.label)}
                      title={l(game.label)}
                      onClick={() => keepNick(nickTone === game.id ? null : game.id)}
                    />
                  </li>
                ))}
              </ul>
  
              {mine.length > 0 && (
                <>
                  <header>
                    <h2>{t('profile.titlePick')}</h2>
                  </header>
                  <ul className="title-shop">
                    <li>
                      <button type="button" className={`title-pick ${title ? '' : 'on'}`} onClick={() => keepTitle(null)}>
                        {t('profile.titleNone')}
                      </button>
                    </li>
                    {mine.map((one) => (
                      <li key={one}>
                        <button
                          type="button"
                          className={`title-pick ${title === one ? 'on' : ''}`}
                          onClick={() => keepTitle(title === one ? null : one)}
                        >
                          {t(`title.${one}` as UiKey)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TilePop>
          )}
        </div>
  
        <Link className="level-panel is-link" href={href.levels} prefetch={false}>
          <div className="level-line">
            <span className="level-xp">
              <b>{summary?.level.into ?? 0}</b> <small>/ {summary?.level.need ?? 0} XP</small>
            </span>
            <span className="profile-hero-level">{t('nav.level', { level: summary?.level.level ?? 1 })}</span>
          </div>
          <div className="level-bar">
            <i style={{ width: `${Math.round(((summary?.level.into ?? 0) / (summary?.level.need ?? 1)) * 100)}%` }} />
          </div>
        </Link>
      </div>
    </div>
  )

  return (
    <div className={`profile ${fresh ? 'is-beta' : ''} ${narrow ? 'is-tester' : ''} ${framing ? 'is-framing' : ''}`} style={(toneHex ? { '--accent': toneHex, '--accent-text': toneText } : {}) as CSSProperties}>
      <div className="profile-top">
        <BackButton href={id ? href.board : href.home} anywhere={!!id}>
          {t(id ? 'nav.leaderboard' : 'play.back')}
        </BackButton>
        {own && (
        <div className="profile-banner-acts">
        {narrow && heroActs}
        <button
          type="button"
          className={`profile-tune is-chip ${edit ? 'on' : 'is-gear'}`}
          aria-label={t(edit ? 'profile.tuneDone' : 'profile.tune')}
          title={t(edit ? 'profile.tuneDone' : 'profile.tune')}
          onClick={tune}
        >
          {edit ? (
            t('profile.tuneDone')
          ) : (
            <>
              <span>{t('profile.tune')}</span>
              <GearIcon />
            </>
          )}
        </button>
        </div>
      )}
        {!own && id && user && (
          <div className={`profile-banner-acts profile-visit-acts ${fresh ? 'is-split' : ''}`}>
            {fresh && (
              <button
                type="button"
                className="profile-duel-main"
                disabled={calling}
                aria-label={t('duel.challenge')}
                title={t('duel.challenge')}
                onClick={() => void challenge(id)}
              >
                <SwordsIcon />
                <span>{t('duel.challenge')}</span>
              </button>
            )}
            {friend === 'in' ? (
              <>
                <button type="button" className="ghost profile-friend" aria-label={t('friends.accept')} title={t('friends.accept')} onClick={() => void answerFriend(id, true)}>
                  <UserCheckIcon />
                  <span>{t('friends.accept')}</span>
                </button>
                <button type="button" className="ghost profile-friend" aria-label={t('friends.decline')} title={t('friends.decline')} onClick={() => void answerFriend(id, false)}>
                  <CloseIcon />
                  <span>{t('friends.decline')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`ghost profile-friend ${friend === 'friends' ? 'is-on' : ''}`}
                aria-label={t(friend === 'friends' ? 'friends.remove' : friend === 'out' ? 'friends.cancel' : 'friends.add')}
                title={t(friend === 'friends' ? 'friends.remove' : friend === 'out' ? 'friends.cancel' : 'friends.add')}
                onClick={() => (friend === 'friends' ? setUnfriending(true) : void (friend === 'none' ? askFriend(id) : removeFriend(id)))}
              >
                {friend === 'friends' ? <UserCheckIcon /> : friend === 'out' ? <UserWaitIcon /> : <UserPlusIcon />}
                <span>{t(friend === 'friends' ? 'friends.remove' : friend === 'out' ? 'friends.cancel' : 'friends.add')}</span>
              </button>
            )}
            {!fresh && (
              <button
                type="button"
                className="ghost profile-duel"
                disabled={calling}
                aria-label={t('duel.challenge')}
                title={t('duel.challenge')}
                onClick={() => void challenge(id)}
              >
                <SwordsIcon />
                <span>{t('duel.challenge')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {scrap &&
        refundOf(scrap) &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setScrap(null)} role="presentation">
            <section
              className="card modal mates-ask scrap-ask"
              role="dialog"
              aria-modal="true"
              aria-label={t('profile.bannerScrapAsk', { name: t(`banner.${scrap}` as UiKey) })}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" aria-label={t('profile.cancel')} onClick={() => setScrap(null)}>
                <CloseIcon />
              </button>
              <h2>{t('profile.bannerScrapAsk', { name: t(`banner.${scrap}` as UiKey) })}</h2>
              <span className="scrap-ask-art" aria-hidden>
                <img src={bannerPic(scrap, true)} alt="" style={{ objectPosition: bannerSpot(scrap) }} />
              </span>
              <p className="muted">{t('profile.bannerScrapHint')}</p>
              <div className="scrap-ask-sum">
                <span>
                  +{refundOf(scrap)}
                  <GemIcon sparkles={false} />
                </span>
                <em>{t('profile.bannerScrapAfter', { coins: (user?.coins ?? 0) + (refundOf(scrap) ?? 0) })}</em>
              </div>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setScrap(null)}>
                  {t('profile.cancel')}
                </button>
                <button type="button" className="danger-button" onClick={() => void scrapBanner(scrap)}>
                  {t('profile.bannerScrapYes')}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}

      {unfriending &&
        id &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setUnfriending(false)} role="presentation">
            <section
              className="card modal mates-ask"
              role="dialog"
              aria-modal="true"
              aria-label={t('friends.removeSure', { name: nickname })}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" aria-label={t('profile.cancel')} onClick={() => setUnfriending(false)}>
                <CloseIcon />
              </button>
              <h2>{t('friends.removeSure', { name: nickname })}</h2>
              <p className="muted">{t('friends.removeHint')}</p>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setUnfriending(false)}>
                  {t('profile.cancel')}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    setUnfriending(false)
                    void removeFriend(id)
                  }}
                >
                  {t('friends.remove')}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}

      {tuning && banner && <BannerTuner banner={banner} looks={user?.bannerLooks?.[banner] ?? null} only={fresh ? 'board' : undefined} onClose={() => setTuning(false)} />}

      <section ref={heroBox} className={fresh ? `profile-hero is-bare ${banner ? 'has-art' : ''} ${framing ? 'is-framing' : ''}` : 'profile-hero'}>
        {fresh && !!banner && (
          <span className="profile-glow" aria-hidden style={{ '--glow-lift': `${heroLook?.lift ?? 0}px` } as CSSProperties}>
            <BannerArt id={banner} look={{ desktop: heroLook }} place="profile" first focus />
          </span>
        )}
        {fresh && !!banner && framing && (
          <BannerFrame
            look={framing}
            busy={framingBusy}
            onChange={setFraming}
            onReset={() => setFraming(spotLook(banner))}
            onBoard={() => {
              setFraming(null)
              setTuning(true)
            }}
            onCancel={() => setFraming(null)}
            onSave={() => void keepFraming()}
          />
        )}
        {!narrow && heroActs}
        <ProfileStage
          art={
            <>
              {!fresh && !!banner && (
                <span className="profile-art" aria-hidden>
                  <BannerArt id={banner} look={own ? user?.bannerLooks?.[banner] : summary?.bannerLook} place="profile" first />
                </span>
              )}
              <div className="profile-banner" aria-hidden>
                {!banner &&
                  MARKS.map((mark) => (
                  <em
                    key={mark.left}
                    style={
                      {
                        left: mark.left,
                        top: mark.top,
                        fontSize: mark.size,
                        transform: `translate(-50%, -50%) rotate(${mark.tilt}deg)`,
                      } as CSSProperties
                    }
                  >
                      ?!
                    </em>
                  ))}
              </div>
            </>
          }
        >
          {heroId}
          {!narrow && tilesBlock}
        </ProfileStage>
      </section>

      {narrow && tilesBlock && <div className="profile-hero-body is-under profile-tiles-out">{tilesBlock}</div>}

      {!!lift && (
        <span
          className="hero-tile tile-lift"
          aria-hidden
          ref={(node) => {
            liftBox.current = node
            if (node) node.style.transform = `translate3d(${liftAt.current.x}px, ${liftAt.current.y}px, 0)`
          }}
          style={{ width: lift.w, height: lift.h }}
        >
          <span>{tileFace(lift.one).label}</span>
          <b>
            {tileFace(lift.one).value}
            {(() => {
              const face = tileFace(lift.one)
              return 'tail' in face && face.tail ? <i>{face.tail}</i> : null
            })()}
          </b>
        </span>
      )}

      <ProfileBoard
        blocks={shown.filter((block) => block !== 'cards' || deck.length > 0 || sorting)}
        sides={boardSides}
        seen={boardSeen}
        sizes={boardSizes}
        content={summary ? `${summary.tests?.published ?? 0}` : ''}
        count={(block, cols) =>
          block === 'worlds'
            ? shelf.length + (sorting ? blanks : Math.min(blanks, (cols - (shelf.length % cols)) % cols))
            : block === 'awards'
              ? sorting
                ? SHOWCASE_MAX
                : Math.min(SHOWCASE_MAX, Math.ceil(pinned.length / cols) * cols)
              : block === 'cards'
                ? sorting
                  ? CARD_PINS_MAX
                  : deck.length
                : undefined
        }
        edit={edit}
        onStart={shutPops}
        onSave={saveBoard}
        render={(block, cols) => (
          <>
            {edit && (
              <div className="slot-bar">
                <span className="slot-grip" aria-hidden>
                  <GripIcon />
                </span>
                <b>{t(`profile.block.${block}` as UiKey)}</b>
                <button type="button" className="slot-off" aria-label={t('profile.blockHide')} onClick={() => hide(block)}>
                  <CloseIcon />
                </button>
              </div>
            )}
            {(() => {
              const panel = panels[block]
              return typeof panel === 'function' ? panel(cols) : panel
            })()}
          </>
        )}
      />


      {edit && (
        <div className="card profile-add">
          <b>{t('profile.blockAdd')}</b>
          <div className="profile-add-row">
            {rest.length ? (
              rest.map((block) => (
                <button type="button" key={block} className="ghost" onClick={() => show(block)}>
                  <PlusIcon />
                  {t(`profile.block.${block}` as UiKey)}
                </button>
              ))
            ) : (
              <span className="muted">{t('profile.blockAll')}</span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
