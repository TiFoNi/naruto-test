import { AWARD_FRAMES, NATURE_FRAMES, OTHER_FRAMES, WORLD_FRAMES } from '@nanda/core/frame-list'
import fits from './frames-fit.json'
import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameKind = 'award' | 'world' | 'nature' | 'other'

export type Frame = { id: string; kind: FrameKind; label: L10n; fit: number }

const AWARD_LABELS: Record<string, L10n> = {
  top1: l10n('1-е место', '1-ше місце', '1st place'),
  top2: l10n('2-е место', '2-ге місце', '2nd place'),
  top3: l10n('3-е место', '3-тє місце', '3rd place'),
}

const NATURE_LABELS: Record<string, L10n> = {
  sakura: l10n('Сакура', 'Сакура', 'Sakura'),
  frost: l10n('Иней', 'Паморозь', 'Frost'),
  leaf: l10n('Листва', 'Листя', 'Leaf'),
  dusk: l10n('Сумерки', 'Сутінки', 'Dusk'),
  abyss: l10n('Бездна', 'Безодня', 'Abyss'),
}

const DRAWN = new Set(NATURE_FRAMES)

const ALL: Omit<Frame, 'fit'>[] = [
  ...AWARD_FRAMES.map((id) => ({ id, kind: 'award' as const, label: AWARD_LABELS[id] })),
  ...WORLD_FRAMES.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
  ...NATURE_FRAMES.map((id) => ({ id, kind: 'nature' as const, label: NATURE_LABELS[id] })),
  ...OTHER_FRAMES.map((id) => ({ id, kind: 'other' as const, label: l10n('Топ-10', 'Топ-10', 'Top 10') })),
]

const TIGHT = 1.06

export const FRAMES: Frame[] = ALL.filter((one) => DRAWN.has(one.id as (typeof NATURE_FRAMES)[number])).map((one) => ({
  ...one,
  fit: Math.min(0.95, ((fits as Record<string, number>)[one.id] ?? 0.6) * TIGHT),
}))

const ART = '6'

export const frameUrl = (id: string) => `/frames/${id}.webp?v=${ART}`

export const frameOf = (id: string | null | undefined) => (id ? (FRAMES.find((one) => one.id === id) ?? null) : null)
