import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameKind = 'award' | 'world'

export type Frame = { id: string; kind: FrameKind; label: L10n }

const AWARDS: Frame[] = [{ id: 'top10', kind: 'award', label: l10n('Топ-10', 'Топ-10', 'Top 10') }]

const WORLDS = ['berserk', 'ff', 'naruto', 'onepiece', 'bleach', 'kny']

export const FRAMES: Frame[] = [
  ...AWARDS,
  ...WORLDS.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
]

export const frameUrl = (id: string) => `/frames/${id}.webp`
