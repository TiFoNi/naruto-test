import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameId = 'bronze' | 'silver' | 'gold' | 'diamond'

export const FRAMES: { id: FrameId; label: L10n }[] = [
  { id: 'bronze', label: l10n('Бронза', 'Бронза', 'Bronze') },
  { id: 'silver', label: l10n('Серебро', 'Срібло', 'Silver') },
  { id: 'gold', label: l10n('Золото', 'Золото', 'Gold') },
  { id: 'diamond', label: l10n('Алмаз', 'Алмаз', 'Diamond') },
]

export const frameUrl = (id: string) => `/frames/${id}.webp`
