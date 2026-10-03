import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameKind = 'tier' | 'world'

export type Frame = { id: string; kind: FrameKind; label: L10n }

const TIERS: Frame[] = [
  { id: 'bronze', kind: 'tier', label: l10n('Бронза', 'Бронза', 'Bronze') },
  { id: 'silver', kind: 'tier', label: l10n('Серебро', 'Срібло', 'Silver') },
  { id: 'gold', kind: 'tier', label: l10n('Золото', 'Золото', 'Gold') },
  { id: 'diamond', kind: 'tier', label: l10n('Алмаз', 'Алмаз', 'Diamond') },
]

const WORLDS = ['berserk', 'ff']

export const FRAMES: Frame[] = [
  ...TIERS,
  ...WORLDS.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
]

export const frameUrl = (id: string) => `/frames/${id}.webp`
