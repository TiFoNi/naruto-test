import type { L10n } from './i18n/langs'

export type FrameKind = 'award' | 'world' | 'other'

export type Frame = { id: string; kind: FrameKind; label: L10n }

export const FRAMES: Frame[] = []

export const frameUrl = (id: string) => `/frames/${id}.webp`
