import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
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
import { ArrowIcon, CloseIcon, GearIcon, GripIcon, PaletteIcon, PencilIcon, PictureIcon, PlusIcon, TrophyIcon } from './icons'
import AwardIcon from './awardIcons'
import { useHref } from './router'
import { SHOWCASE_MAX } from './showcase'
import { keepPerUser } from './session-cache'
import { showTone } from './tone'
import { bannerClips, bannerPic, bannerSpot, isLive } from './banners'
import {
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
  type Banner,
  type HeroTile,
  type ProfileBlock,
} from '@nanda/game'

type Held = { block: ProfileBlock; x: number; y: number; dx: number; dy: number; w: number; h: number }

type Sized = { block: ProfileBlock; y: number; from: number; roof: number; floor: number; stops: number[] | null; mates: number[]; bare: number }

const BLOCK_MIN = 180
const BLOCK_ROOF = 520
const BLOCK_MAGNET = 10

type Named = { ru: string; uk: string; en: string }

type Summary = {
  since: string
  pinned: { id: string | null; family: string | null; tier: string; at: string | null; hidden?: boolean }[]
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
  duels: { played: number; wins: number; losses: number; draws: number }
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
  tiles?: (string | null)[] | null
  banner?: string | null
  banners?: string[]
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

export default function Profile({ onBack, id }: { onBack: () => void; id?: string }) {
  const { user, refresh } = useAuth()
  const own = !id
  const { t, l, lang } = useI18n()
  const href = useHref()

  const [summary, setSummary] = useState<Summary | null>(own ? knownSummary : null)
  const [places, setPlaces] = useState(false)
  const [edit, setEdit] = useState(false)
  const [layout, setLayout] = useState<ProfileBlock[] | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [sized, setSized] = useState<Sized | null>(null)
  const [sizes, setSizes] = useState<Record<string, number> | null>(null)
  const [spots, setSpots] = useState<Record<string, number> | null>(null)
  const list = useRef<ProfileBlock[]>(PROFILE_BLOCKS_DEFAULT)
  const tall = useRef<Record<string, number>>({})
  const side = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!sized) return
    const move = (event: PointerEvent) => {
      const asked = sized.from + event.clientY - sized.y
      const stop = sized.stops?.reduce((best, one) => (Math.abs(one - asked) < Math.abs(best - asked) ? one : best))
      const mate = sized.mates.find((one) => Math.abs(one - asked) <= BLOCK_MAGNET)
      const next = Math.round(
        stop ?? Math.min(Math.max(sized.roof, sized.floor), Math.max(sized.floor, mate ?? asked)),
      )
      const whole = sized.stops ? next === sized.roof : sized.bare > 0 && Math.abs(next - sized.bare) <= BLOCK_MAGNET
      const copy = { ...tall.current }
      delete eyed.current[sized.block]
      if (whole) delete copy[sized.block]
      else copy[sized.block] = next
      tall.current = copy
      setSizes(copy)
    }
    const drop = () => {
      setSized(null)
      void api('profile', { action: 'blocks', blocks: list.current, sizes: tall.current, sides: side.current, seen: eyed.current })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
  }, [sized])

  useEffect(() => {
    if (!held) return
    const move = (event: PointerEvent) => {
      setHeld((was) => (was ? { ...was, x: event.clientX, y: event.clientY } : was))
      const grid = document.querySelector('.profile-grid') as HTMLElement | null
      if (!grid) return
      const wide = getComputedStyle(grid).gridTemplateColumns.split(' ').length > 1
      const box = grid.getBoundingClientRect()
      const column = wide ? (event.clientX < box.left + box.width / 2 ? 0 : 1) : (side.current[held.block] ?? 0)
      const rest = list.current.filter((one) => one !== held.block)
      const mates = rest.filter((one) => (side.current[one] ?? 0) === column)
      const spot = mates.findIndex((one) => {
        const seat = document.querySelector(`.profile-slot[data-block="${one}"]`)?.getBoundingClientRect()
        return seat ? event.clientY < seat.top + seat.height / 2 : false
      })
      const anchor = spot < 0 ? null : mates[spot]
      const at = anchor
        ? rest.indexOf(anchor)
        : mates.length
          ? rest.indexOf(mates[mates.length - 1]) + 1
          : rest.length
      const next = [...rest.slice(0, at), held.block, ...rest.slice(at)]
      if (next.join() === list.current.join() && (side.current[held.block] ?? 0) === column) return
      const seats = { ...side.current, [held.block]: column }
      list.current = next
      side.current = seats
      setLayout(next)
      setSpots(seats)
    }
    const drop = () => {
      setHeld(null)
      void api('profile', { action: 'blocks', blocks: list.current, sizes: tall.current, sides: side.current, seen: eyed.current })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
  }, [held?.block])
  useLayoutEffect(() => {
    const even = () => {
      const pair = (['worlds', 'awards'] as ProfileBlock[])
        .map((block) => document.querySelector(`.profile-slot[data-block="${block}"]`) as HTMLElement | null)
        .filter((slot): slot is HTMLElement => Boolean(slot))
      for (const slot of pair) slot.style.removeProperty('--mate-h')
      if (pair.length < 2 || pair.some((slot) => slot.style.getPropertyValue('--slot-h'))) return
      const cards = pair.map((slot) => slot.querySelector('.card') as HTMLElement | null)
      if (cards.some((card) => !card)) return
      const highs = cards.map((card) => Math.round(card!.getBoundingClientRect().height))
      const peak = Math.max(...highs)
      highs.forEach((high, index) => high < peak && pair[index].style.setProperty('--mate-h', `${peak}px`))
    }
    even()
    window.addEventListener('resize', even)
    return () => window.removeEventListener('resize', even)
  })

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
  const [tones, setTones] = useState(false)
  const tonesRef = useRef<HTMLDivElement>(null)
  const skinsRef = useRef<HTMLDivElement>(null)
  const dyes = useRef<HTMLDivElement>(null)
  const [grabbed, setGrabbed] = useState<number | null>(null)
  const [lift, setLift] = useState<{ one: HeroTile; w: number; h: number } | null>(null)
  const liftAt = useRef({ x: 0, y: 0 })
  const liftBox = useRef<HTMLSpanElement | null>(null)
  const snapper = useRef<() => void>(() => undefined)
  const pads = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<'row' | 'column' | 'under'>('row')
  const [deck, setDeck] = useState(false)
  const [tight, setTight] = useState(false)
  const eyed = useRef<Record<string, number>>({})

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

  const gameLabel = (id: string) => GAMES.find((g) => g.id === id)?.label
  const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label ?? 'mode.classic'

  const saidTone = summary?.tone
  const tone = paint === undefined ? (isTone(saidTone) ? saidTone : null) : paint
  const toneHex = GAMES.find((game) => game.id === tone)?.accent ?? (tone && TONE_HEX.test(tone) ? tone : undefined)
  const saidNick = summary?.nickTone
  const nickTone = ink === undefined ? (isTone(saidNick) ? saidNick : null) : ink
  const nickHex = GAMES.find((game) => game.id === nickTone)?.accent ?? (nickTone && TONE_HEX.test(nickTone) ? nickTone : undefined)
  const dyeList = [
    ...TONES.map((id) => GAMES.find((game) => game.id === id)).filter((game) => !!game),
    { id: '#f2f4f8', accent: '#f2f4f8', label: l10n('Белый', 'Білий', 'White') },
    { id: '#2b3038', accent: '#2b3038', label: l10n('Чёрный', 'Чорний', 'Black') },
  ]

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
      const screen = typeof window === 'undefined' ? wide : window.innerWidth
      const narrow = screen <= 750
      const hero = grid.closest('.profile-hero') as HTMLElement | null
      if (hero) {
        if (narrow) hero.style.setProperty('--deck-tiles', `${Math.round(grid.offsetHeight)}px`)
        else hero.style.removeProperty('--deck-tiles')
      }
      setDeck(narrow)
      setSpot(narrow ? 'under' : slot >= 144 ? 'row' : 'column')
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
    const snap = () => snapper.current()
    snap()
    window.addEventListener('resize', snap)
    return () => window.removeEventListener('resize', snap)
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

  if (!summary && !failed) return <ProfileGhost />

  const shown = layout ?? ((summary?.blocks as ProfileBlock[] | null | undefined) ?? PROFILE_BLOCKS_DEFAULT)
  const rest = PROFILE_BLOCKS.filter((block) => !shown.includes(block))

  const keep = (next: ProfileBlock[]) => {
    setLayout(next)
    void api('profile', { action: 'blocks', blocks: next, sizes: tall.current, sides: side.current, seen: eyed.current })
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
  const owned = BANNERS.filter((one) => (summary?.banners ?? []).includes(one))

  const keepBanner = (next: Banner | null) => {
    setSkin(next)
    void api('profile', { action: 'banner', banner: next }).then(() => refresh())
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
      liftAt.current = { x: step.clientX - grip.x, y: step.clientY - grip.y }
      const node = liftBox.current
      if (node) node.style.transform = `translate3d(${liftAt.current.x}px, ${liftAt.current.y}px, 0)`
    }

    const move = (step: PointerEvent) => {
      if (!moved && Math.abs(step.clientX - start.x) < 5 && Math.abs(step.clientY - start.y) < 5) return
      if (!moved) {
        moved = true
        setGrabbed(spot)
        setLift({ one, w: box.width, h: box.height })
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

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
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

  const grown = sizes ?? summary?.blockSizes ?? {}
  const seated = spots ?? summary?.blockSides ?? {}
  const sideOf = (block: ProfileBlock, index: number) => seated[block] ?? index % 2
  const columns = [0, 1].map((column) => shown.map((block, index) => ({ block, index })).filter(({ block, index }) => sideOf(block, index) === column))
  tall.current = grown
  side.current = Object.fromEntries(shown.map((block, index) => [block, sideOf(block, index)]))
  list.current = shown

  const cardOf = (block: ProfileBlock) =>
    document.querySelector(`.profile-slot[data-block="${block}"] > .card`) as HTMLElement | null

  const roofOf = () => {
    const free = (['worlds', 'awards'] as ProfileBlock[])
      .filter((one) => !grown[one])
      .map((one) => cardOf(one)?.getBoundingClientRect().height ?? 0)
    const tallest = Math.max(0, ...free)
    return tallest > BLOCK_MIN ? Math.round(tallest) : BLOCK_ROOF
  }

  const ladderOf = (block: ProfileBlock) => {
    const card = cardOf(block)
    const slot = card?.parentElement as HTMLElement | null
    if (!card || !slot) return null
    const kept = slot.style.getPropertyValue('--slot-h')
    const mate = slot.style.getPropertyValue('--mate-h')
    if (kept) slot.style.removeProperty('--slot-h')
    if (mate) slot.style.removeProperty('--mate-h')
    const own = Math.round(card.getBoundingClientRect().height)
    const list = card.querySelector('.world-shelf, .soon-badges') as HTMLElement | null
    const items = list ? ([...list.children] as HTMLElement[]) : []
    const box = list?.getBoundingClientRect()
    const pad = list ? Math.round(parseFloat(getComputedStyle(list).paddingTop)) || 0 : 0
    const chrome = box ? own - box.height : 0
    const steps: number[] = []
    if (list && box && items.length > 1) {
      const top = items[0].getBoundingClientRect().top
      const line = items.filter((one) => Math.abs(one.getBoundingClientRect().top - top) < 2)
      if (line.length < items.length) steps.push(Math.round(chrome + pad + Math.max(...line.map((one) => one.getBoundingClientRect().height))))
    }
    if (kept) slot.style.setProperty('--slot-h', kept)
    if (mate) slot.style.setProperty('--mate-h', mate)
    return { own, steps: steps.filter((one) => one > 80 && one < own - 2) }
  }

  const naturalOf = (block: ProfileBlock) => {
    const card = cardOf(block)
    const slot = card?.parentElement as HTMLElement | null
    if (!card || !slot) return 0
    const held = slot.style.getPropertyValue('--slot-h')
    const mate = slot.style.getPropertyValue('--mate-h')
    if (held) slot.style.removeProperty('--slot-h')
    if (mate) slot.style.removeProperty('--mate-h')
    const own = Math.round(card.getBoundingClientRect().height)
    if (held) slot.style.setProperty('--slot-h', held)
    if (mate) slot.style.setProperty('--mate-h', mate)
    return own
  }



  snapper.current = () => {
    for (const [block, kept] of Object.entries(grown)) {
      const card = cardOf(block as ProfileBlock)
      const slot = card?.parentElement as HTMLElement | null
      const shelf = card?.querySelector('.world-shelf, .soon-badges') as HTMLElement | null
      if (!card || !slot || !shelf) continue
      const held = slot.style.getPropertyValue('--slot-h')
      const mate = slot.style.getPropertyValue('--mate-h')
      if (held) slot.style.removeProperty('--slot-h')
      if (mate) slot.style.removeProperty('--mate-h')
      const full = Math.round(card.getBoundingClientRect().height)
      const box = shelf.getBoundingClientRect()
      const items = [...shelf.children] as HTMLElement[]
      const top = items[0]?.getBoundingClientRect()
      const cols = top ? items.filter((one) => Math.abs(one.getBoundingClientRect().top - top.top) < 2).length : 0
      const row = top ? Math.round(top.height) : 0
      const gap = Math.round(parseFloat(getComputedStyle(shelf).rowGap)) || 0
      const pad = Math.round(parseFloat(getComputedStyle(shelf).paddingTop)) || 0
      const chrome = Math.round(full - box.height)
      if (mate) slot.style.setProperty('--mate-h', mate)
      if (!cols || !row) {
        if (held) slot.style.setProperty('--slot-h', held)
        continue
      }
      const seen = eyed.current[block] ?? summary?.blockSeen?.[block] ?? Math.max(1, Math.round((kept - chrome + gap) / (row + gap))) * cols
      eyed.current[block] = seen
      const rows = Math.max(1, Math.ceil(seen / cols))
      const want = Math.min(full, Math.round(chrome + pad + rows * row + (rows - 1) * gap))
      slot.style.setProperty('--slot-h', `${want}px`)
    }
  }

  const stretch = (block: ProfileBlock) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    const card = cardOf(block)
    if (!card) return
    shutPops()
    event.preventDefault()
    event.stopPropagation()
    const from = Math.round(card.getBoundingClientRect().height)
    const ladder = ladderOf(block)
    if (!ladder) return
    const base = block !== 'facts' && shown.includes('facts') ? naturalOf('facts') : 0

    if (ladder.steps.length) {
      const fit = ladder.steps.filter((one) => one >= base)
      const stops = [...(fit.length ? fit : ladder.steps.slice(-1)), ladder.own]
      setSized({ block, y: event.clientY, from, stops, floor: stops[0], roof: ladder.own, mates: [], bare: ladder.own })
      return
    }

    const floor = base > 80 ? base : ladder.own > 80 ? ladder.own : BLOCK_MIN
    const mates = [
      ...shown
        .filter((one) => one !== block)
        .map((one) => Math.round(cardOf(one)?.getBoundingClientRect().height ?? 0)),
      ladder.own,
    ].filter((one) => one > 0)
    setSized({ block, y: event.clientY, from, stops: null, floor, roof: roofOf(), mates, bare: ladder.own })
  }

  const shutPops = () => {
    setPlaces(false)
    setTip(false)
    setWeek(false)
    setShop(null)
  }

  const grab = (block: ProfileBlock) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    const node = (event.currentTarget.closest('.profile-slot') as HTMLElement | null) ?? null
    if (!node) return
    shutPops()
    const card = (node.querySelector(':scope > .card') as HTMLElement | null) ?? node
    const box = card.getBoundingClientRect()
    event.preventDefault()
    setHeld({ block, x: event.clientX, y: event.clientY, dx: event.clientX - box.left, dy: event.clientY - box.top, w: box.width, h: box.height })
  }

  const show = (block: ProfileBlock) => keep([...shown, block])

  const tune = () => setEdit((was) => !was)

  const panels: Record<ProfileBlock, ReactNode> = {
    facts: (
      <section className="card profile-card">
        <div className="profile-facts">
          {best ? (
            <button
              type="button"
              className={`fact fact-rank ${medal(best.position)} ${places ? 'open' : ''}`}
              aria-expanded={places}
              onClick={() => setPlaces((was) => !was)}
            >
              <span>{t('profile.bestGame')}</span>
              <p className="fact-place">
                <b>#{best.position}</b>
              </p>
            </button>
          ) : (
            <div className="fact fact-rank">
              <span>{t('profile.bestGame')}</span>
              <b className="empty">—</b>
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
            <span>{t('profile.favourite')}</span>
            {summary?.favourite ? (
              <b className="small" title={l(gameLabel(summary.favourite)!)}>
                {l(gameLabel(summary.favourite)!)}
              </b>
            ) : (
              <b className="empty">—</b>
            )}
          </div>
        </div>

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
                      name: round.name ? round.name[lang] : round.hidden ? t('profile.secret') : `#${round.answerId}`,
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
    worlds: (
      <section className="card worlds-card">
        <header>
          <h2>{t('profile.worlds')}</h2>
          {!!user && (
            <Link className="worlds-all" href={own || !id ? href.worlds : href.playerWorlds(id)}>
              {t('profile.worldsAll', { count: summary?.games.length ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        {shelf.length || own ? (
          <ul className="world-shelf">
            {shelf.map((row) => {
              const game = GAMES.find((g) => g.id === row.game)
              const share = percent(row.solved, row.pool)
              return (
                <li key={row.game} style={{ '--world-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}>
                  <Link href={href.world(row.game as GameId)} prefetch={false}>
                    <span className="world-pic" style={{ '--fill': `${share}%` } as CSSProperties}>
                      <img
                        className="world-art"
                        src={`/worlds/big/${row.game}.webp`}
                        alt=""
                        width={448}
                        height={448}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className="world-lit" style={{ backgroundImage: `url(/worlds/big/${row.game}.webp)` }} />
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
            {Array.from({ length: blanks }, (_, index) => (
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
                  </Link>
                ) : (
                  <span className="world-blank" aria-hidden>
                    <span className="world-pic is-empty" />
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
    awards: (
      <section className="card soon-card">
        <header>
          <h2>
            {t('profile.awardsTitle')}
            <small>
              {summary?.awards ?? 0} / {summary?.awardsTotal ?? 0}
            </small>
          </h2>
          {!!user && (
            <Link className="worlds-all" href={own || !id ? href.achievements : href.playerAwards(id)}>
              {t('profile.worldsAll', { count: summary?.awardsTotal ?? 0 })}
              <ArrowIcon />
            </Link>
          )}
        </header>
        <ul className="soon-badges">
          {Array.from({ length: SHOWCASE_MAX }, (_, index) => {
            const award = pinned[index]
            if (!award)
              return (
                <li key={index} className="free">
                  {own && user ? (
                    <Link href={href.achievements} aria-label={t('profile.awardsFreeHint')} prefetch={false}>
                      <span className="soon-mark" aria-hidden>
                        <PlusIcon />
                      </span>
                    </Link>
                  ) : (
                    <span className="soon-mark" aria-hidden />
                  )}
                </li>
              )
            const secret = award.hidden || !award.id
            return (
              <li key={award.id ?? `secret-${index}`} className={`on tier-${award.tier}`}>
                {user ? (
                  <Link href={own || !id ? `${href.achievements}?filter=done` : href.playerAwards(id)} prefetch={false}>
                    <span className="soon-mark" aria-hidden>
                      {award.family ? <AwardIcon family={award.family} award={award.id} /> : <TrophyIcon />}
                    </span>
                    <b>{secret ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                  </Link>
                ) : (
                  <>
                    <span className="soon-mark" aria-hidden>
                      {award.family ? <AwardIcon family={award.family} award={award.id} /> : <TrophyIcon />}
                    </span>
                    <b>{secret ? t('ach.secret') : t(`ach.${award.id}` as UiKey)}</b>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    ),
  }

  return (
    <div className="profile" style={(toneHex ? { '--accent': toneHex } : {}) as CSSProperties}>
      <div className="profile-top">
        <BackButton href="/" onClick={onBack}>
          {t('profile.back')}
        </BackButton>
        {own && (
        <div className="profile-banner-acts">
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
      </div>

      <section className="profile-hero">
        {own && edit && (
          <div className="hero-acts">
            <div className={`banner-pick ${skins ? 'is-open' : ''}`} ref={skinsRef}>
                <button
                  type="button"
                  className="hero-act"
                  aria-label={t('profile.banner')}
                  title={t('profile.banner')}
                  onClick={() => setSkins(!skins)}
                >
                  <PictureIcon />
                </button>
                {skins && (
                  <div className="modes-pop" role="dialog">
                    <header>
                      <h2>{t('profile.banner')}</h2>
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
                      {owned.map((one) => (
                        <li key={one}>
                          <button type="button" className={`banner-face ${banner === one ? 'on' : ''}`} onClick={() => keepBanner(one)}>
                            <img src={bannerPic(one)} alt="" />
                            <span>{t(`banner.${one}` as UiKey)}</span>
                          </button>
                        </li>
                      ))}
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
        )}
        {!!banner && (
          <span className="profile-art" aria-hidden>
            {isLive(banner) ? (
              <video autoPlay loop muted playsInline preload="auto" poster={bannerPic(banner)} style={{ objectPosition: bannerSpot(banner) }}>
                {bannerClips(banner).map((clip) => (
                  <source key={clip.type} src={clip.src} type={clip.type} />
                ))}
              </video>
            ) : (
              <img src={bannerPic(banner)} alt="" style={{ objectPosition: bannerSpot(banner) }} />
            )}
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


        <div className={`profile-hero-body ${spot === 'under' ? 'is-under' : ''} ${spot === 'column' ? 'is-stack' : ''} ${deck ? 'is-deck' : ''}`}>
        <div className="profile-hero-id">
          {own ? <AvatarPicker edit={edit} /> : <Avatar id={id} name={nickname} avatar={summary?.avatar} frame={summary?.frame} />}
          <div className="profile-hero-main">
            <div className="profile-hero-name" style={(nickHex ? { '--nick': nickHex } : {}) as CSSProperties}>
              <span className="hero-nick-line">
                <span className="hero-nick-who">
                  <h1>{nickname}</h1>
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

        {cells.length > 0 && (
        <div className={`profile-hero-tiles ${edit ? 'is-edit' : ''} ${spot === 'column' ? 'is-stack' : ''} ${spot === 'under' ? 'is-under' : ''} ${deck ? 'is-deck' : ''}`} ref={pads}>
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
                        {MODES.map((mode) => {
                          const row = summary?.modes.find((item) => item.mode === mode.id)
                          const played = row?.played ?? 0
                          const share = percent(row?.won ?? 0, played)
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
        )}
        </div>
      </section>

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

      <div className={`profile-grid ${edit ? 'is-edit' : ''}`}>
        {columns.map((seats, column) => (
          <div className="profile-stack" key={column}>
            {seats.map(({ block, index }) => (
                <div
                  className={`profile-slot slot-${block} ${held?.block === block ? 'is-held' : ''} ${sized?.block === block ? 'is-sized' : ''} ${grown[block] ? 'is-tall' : ''}`}
                  key={block}
                  data-block={block}
                  style={{ order: index, ...(grown[block] ? { '--slot-h': `${grown[block]}px` } : {}) } as CSSProperties}
                >
                  {edit && (
                    <div className="slot-bar" onPointerDown={grab(block)}>
                      <span className="slot-grip" aria-hidden>
                        <GripIcon />
                      </span>
                      <b>{t(`profile.block.${block}` as UiKey)}</b>
                      <button
                        type="button"
                        className="slot-off"
                        aria-label={t('profile.blockHide')}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => hide(block)}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  )}
                  {panels[block]}
                  {edit && <i className="slot-grow" onPointerDown={stretch(block)} aria-hidden />}
                </div>
              ))}
          </div>
        ))}
      </div>

      {held && (
        <div
          className={`profile-ghost ${grown[held.block] ? 'is-tall' : ''}`}
          style={{ left: held.x - held.dx, top: held.y - held.dy, width: held.w, height: held.h }}
          aria-hidden
        >
          {panels[held.block]}
        </div>
      )}

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
