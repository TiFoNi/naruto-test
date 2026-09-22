import type { UiKey } from './i18n/ui'
import type { Category } from './games/types'

export type ModeId = 'classic' | 'image'

export const MODES: { id: ModeId; label: UiKey; description: UiKey; icon: string }[] = [
  { id: 'classic', label: 'mode.classic', description: 'mode.classic.desc', icon: '▦' },
  { id: 'image', label: 'mode.image', description: 'mode.image.desc', icon: '◎' },
]

export const UPCOMING_MODES: { label: UiKey; categories: Category[] }[] = [
  { label: 'mode.cover', categories: ['anime'] },
  { label: 'mode.page', categories: ['anime'] },
  { label: 'mode.quote', categories: ['anime', 'games'] },
]
