import { AWARD_FRAMES, NATURE_FRAMES, OTHER_FRAMES, WORLD_FRAMES } from '@nanda/core/frame-list'
import tune from './frames-tune.json'
import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameKind = 'award' | 'world' | 'nature' | 'other'

export type Frame = { id: string; kind: FrameKind; label: L10n }

const AWARD_LABELS: Record<string, L10n> = {
  top1: l10n('1-е место', '1-ше місце', '1st place'),
  top2: l10n('2-е место', '2-ге місце', '2nd place'),
  top3: l10n('3-е место', '3-тє місце', '3rd place'),
}

const NATURE_LABELS: Record<string, L10n> = {
  pond: l10n('Пруд', 'Ставок', 'Pond'),
  maple: l10n('Клён', 'Клен', 'Maple'),
  crows: l10n('Вороны', 'Ворони', 'Crows'),
  blossom: l10n('Сливовый цвет', 'Сливовий цвіт', 'Plum blossom'),
  fireflies: l10n('Светлячки', 'Світляки', 'Fireflies'),
}

const DRAWN = new Set<string>([...NATURE_FRAMES, 'aot', 'kny', 'tg', 'dn', 'top1'])

const ALL: Frame[] = [
  ...AWARD_FRAMES.map((id) => ({ id, kind: 'award' as const, label: AWARD_LABELS[id] })),
  ...WORLD_FRAMES.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
  ...NATURE_FRAMES.map((id) => ({ id, kind: 'nature' as const, label: NATURE_LABELS[id] })),
  ...OTHER_FRAMES.map((id) => ({ id, kind: 'other' as const, label: l10n('Топ-10', 'Топ-10', 'Top 10') })),
]

export const FRAMES: Frame[] = ALL.filter((one) => DRAWN.has(one.id))

const ART = '25'

export const frameUrl = (id: string, small?: boolean) => `/frames/${id}${small ? '-sm' : ''}.webp?v=${ART}`

export type FrameTune = { scale: number; x: number; y: number; cut: number; cx: number; cy: number }

export const TUNE_DEFAULT: FrameTune = { scale: 1.22, x: 0, y: 0, cut: 100, cx: 0, cy: 0 }

const TUNE_KEY = 'nanda.frame-tune'

const saved = (): Record<string, FrameTune> => {
  try {
    return JSON.parse(localStorage.getItem(TUNE_KEY) ?? '{}') as Record<string, FrameTune>
  } catch {
    return {}
  }
}

export const keepTune = (next: Record<string, FrameTune>) => {
  try {
    localStorage.setItem(TUNE_KEY, JSON.stringify(next))
  } catch {
    /* приватний режим */
  }
}

export const tuneOf = (id: string): FrameTune => ({
  ...TUNE_DEFAULT,
  ...((tune as Record<string, Partial<FrameTune>>)[id] ?? {}),
  ...(typeof window === 'undefined' ? {} : (saved()[id] ?? {})),
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
