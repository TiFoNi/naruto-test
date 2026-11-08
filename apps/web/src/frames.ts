import { ART_FRAMES, AWARD_FRAMES, EFFECT_FRAMES, NATURE_FRAMES, OTHER_FRAMES, WORLD_FRAMES } from '@nanda/core/frame-list'
import tune from './frames-tune.json'
import { api } from './api'
import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'
import { uiUrl } from './pics'

export type FrameKind = 'award' | 'world' | 'nature' | 'other' | 'effect' | 'art'

export type Frame = { id: string; kind: FrameKind; label: L10n }

const AWARD_LABELS: Record<string, L10n> = {
  top1: l10n('1-е место', '1-ше місце', '1st place'),
  cosmos: l10n('Космос', 'Космос', 'Cosmos'),
  blades: l10n('Клинки', 'Клинки', 'Blades'),
}

const NATURE_LABELS: Record<string, L10n> = {
  pond: l10n('Пруд', 'Ставок', 'Pond'),
  maple: l10n('Клён', 'Клен', 'Maple'),
  crows: l10n('Вороны', 'Ворони', 'Crows'),
  blossom: l10n('Сливовый цвет', 'Сливовий цвіт', 'Plum blossom'),
  fireflies: l10n('Светлячки', 'Світляки', 'Fireflies'),
}

const EFFECT_LABELS: Record<string, L10n> = {
  chrome: l10n('Хром', 'Хром', 'Chrome'),
  orb: l10n('Сфера', 'Сфера', 'Orb'),
  liquid: l10n('Жидкое кольцо', 'Рідке кільце', 'Liquid ring'),
  comets: l10n('Кометы', 'Комети', 'Comets'),
  fire: l10n('Огонь', 'Вогонь', 'Fire'),
  lightning: l10n('Молнии', 'Блискавки', 'Lightning'),
  particles: l10n('Частицы', 'Частинки', 'Particles'),
  vortex: l10n('Вихрь', 'Вихор', 'Vortex'),
  ferrofluid: l10n('Феррожидкость', 'Ферорідина', 'Ferrofluid'),
  atom: l10n('Атом', 'Атом', 'Atom'),
  wings: l10n('Хромовые крылья', 'Хромові крила', 'Chrome wings'),
}

const ART_LABELS: Record<string, L10n> = {
  nekohood: l10n('Кошачий капюшон', 'Котячий каптур', 'Cat hood'),
  bearhood: l10n('Мишкин капюшон', 'Ведмежий каптур', 'Bear hood'),
  bunnyhood: l10n('Зайкин капюшон', 'Заячий каптур', 'Bunny hood'),
  bones: l10n('Кости', 'Кістки', 'Bones'),
  magma: l10n('Магма', 'Магма', 'Magma'),
  dragon: l10n('Дракон', 'Дракон', 'Dragon'),
  holo: l10n('Голограмма', 'Голограма', 'Hologram'),
  glitch: l10n('Глитч', 'Глітч', 'Glitch'),
  thorns: l10n('Шипы', 'Шипи', 'Thorns'),
  barbed: l10n('Колючая проволока', 'Колючий дріт', 'Barbed wire'),
  spikes: l10n('Фиолетовые шипы', 'Фіолетові шипи', 'Violet spikes'),
  blockring: l10n('Блочное кольцо', 'Блокове кільце', 'Block ring'),
  moonbloom: l10n('Лунный цветок', 'Місячна квітка', 'Moon bloom'),
  demonring: l10n('Демоническое кольцо', 'Демонічне кільце', 'Demon ring'),
}

const DRAWN = new Set<string>([...NATURE_FRAMES, ...EFFECT_FRAMES, ...ART_FRAMES, 'aot', 'kny', 'tg', 'dn', 'top1', 'cosmos', 'blades'])

const ALL: Frame[] = [
  ...AWARD_FRAMES.map((id) => ({ id, kind: 'award' as const, label: AWARD_LABELS[id] })),
  ...WORLD_FRAMES.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
  ...NATURE_FRAMES.map((id) => ({ id, kind: 'nature' as const, label: NATURE_LABELS[id] })),
  ...OTHER_FRAMES.map((id) => ({ id, kind: 'other' as const, label: l10n('Топ-10', 'Топ-10', 'Top 10') })),
  ...EFFECT_FRAMES.map((id) => ({ id, kind: 'effect' as const, label: EFFECT_LABELS[id] })),
  ...ART_FRAMES.map((id) => ({ id, kind: 'art' as const, label: ART_LABELS[id] })),
]

export const FRAMES: Frame[] = ALL.filter((one) => DRAWN.has(one.id))

const ART = '36'

const MOVING = new Set<string>(EFFECT_FRAMES)

const suffixOf = (id: string, size?: 'xs' | 'sm' | 'md' | boolean) =>
  size === 'xs' ? (MOVING.has(id) ? '-xs' : '-sm') : size === true || size === 'sm' ? '-sm' : size === 'md' ? '-md' : ''

export const frameUrl = (id: string, size?: 'xs' | 'sm' | 'md' | boolean) => uiUrl(`frames/${id}${suffixOf(id, size)}.webp?v=${ART}`)

export type FrameTune = { scale: number; x: number; y: number; cut: number; cx: number; cy: number }

export const TUNE_DEFAULT: FrameTune = { scale: 1.22, x: 0, y: 0, cut: 100, cx: 0, cy: 0 }

const LEGACY_KEY = 'nanda.frame-tune'

export const dropLegacy = () => {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* приватний режим */
  }
}

let live: Record<string, Partial<FrameTune>> = {}

let stamp = 0

export const tuneStamp = () => stamp

const watchers = new Set<() => void>()

export const watchTune = (fn: () => void) => {
  watchers.add(fn)
  return () => {
    watchers.delete(fn)
  }
}

export const setTune = (next: Record<string, Partial<FrameTune>>) => {
  live = next
  stamp += 1
  for (const fn of watchers) fn()
}

let asked: Promise<boolean> | null = null

export const loadTune = () => {
  asked ??= api<{ tune?: Record<string, Partial<FrameTune>> }>('frames/tune').then(({ ok, data }) => {
    if (!ok || !data.tune) {
      asked = null
      return false
    }
    setTune(data.tune)
    return true
  })
  return asked
}

export const keepTune = async (next: Record<string, FrameTune>) => {
  setTune(next)
  return api('admin/frames/tune', { tune: next })
}

export const tuneOf = (id: string): FrameTune => ({
  ...TUNE_DEFAULT,
  ...((tune as Record<string, Partial<FrameTune>>)[id] ?? {}),
  ...(live[id] ?? {}),
})

export const frameStyle = (id: string) => {
  const one = tuneOf(id)
  return { '--frame-scale': one.scale, '--frame-x': `${one.x}%`, '--frame-y': `${one.y}%` }
}

export const faceStyle = (id: string) => {
  const one = tuneOf(id)
  return { '--cut': `${one.cut}%`, '--cut-x': `${one.cx}%`, '--cut-y': `${one.cy}%` }
}

export const frameOf = (id: string | null | undefined) => (id ? (FRAMES.find((one) => one.id === id) ?? null) : null)
