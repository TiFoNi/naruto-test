import { GAMES } from './games'
import { l10n } from './games/types'
import type { L10n } from './i18n/langs'

export type FrameKind = 'award' | 'world' | 'other'

export type Frame = { id: string; kind: FrameKind; label: L10n }

const AWARDS: Frame[] = [
  { id: 'top1', kind: 'award', label: l10n('1-е место', '1-ше місце', '1st place') },
  { id: 'top2', kind: 'award', label: l10n('2-е место', '2-ге місце', '2nd place') },
  { id: 'top3', kind: 'award', label: l10n('3-е место', '3-тє місце', '3rd place') },
]

const OTHERS: Frame[] = [{ id: 'top10', kind: 'other', label: l10n('Розы', 'Троянди', 'Roses') }]

const WORLDS = ['berserk', 'ff', 'naruto', 'onepiece', 'bleach', 'kny', 'aot', 'jjk', 'csm', 'tg', 'hxh', 'jojo']

export const FRAMES: Frame[] = [
  ...AWARDS,
  ...WORLDS.map((id) => ({ id, kind: 'world' as const, label: GAMES.find((game) => game.id === id)?.label ?? l10n(id, id, id) })),
  ...OTHERS,
]

export const frameUrl = (id: string) => `/frames/${id}.webp`
