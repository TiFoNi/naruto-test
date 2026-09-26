import type { GameId, ModeId } from '@nanda/game'
import type { L10n } from '../i18n/ui'
import type { Category } from './types'

export type GameMeta = {
  id: GameId
  label: L10n
  description: L10n
  category: Category
  accent: string
  modes: ModeId[]
  unit: 'character' | 'hero' | 'manga' | 'player'
  count: number
  featured: { id: number; image?: string }[]
}

export const metaById = (list: GameMeta[], id: GameId) => list.find((g) => g.id === id) ?? list[0]
