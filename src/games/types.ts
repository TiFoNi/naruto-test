import type { L10n, Lang } from '../i18n/ui'
import type { GameId, ModeId } from './specs'

export type { GameId, Judgement, Verdict } from './specs'

export type Icon = { label: string; symbol: string; color: string; dark?: boolean }

export type Entity = { id: number; name: string; nameEn?: string; aliases?: string; thumb: number; answer: boolean }

export type Translate = (value: string) => string

export type RenderContext = { tv: Translate; lang: Lang }

export type Column<T> = {
  title: L10n
  key: string
  text: (guess: T, ctx: RenderContext) => string
  icons?: (guess: T, ctx: RenderContext) => Icon[]
}

export type Category = 'anime' | 'games'

export type Game<T extends Entity = Entity> = {
  id: GameId
  label: L10n
  category: Category
  description: L10n
  accent: string
  modes: ModeId[]
  featured: string[]
  unit: 'character' | 'hero'
  entities: T[]
  columns: Column<T>[]
  atlas: { cols: number; rows: number }
  atlasUrl: string
  fullUrl: (e: T) => string
  wideImages: boolean
  legend: 'debut' | 'order'
}

export const EMPTY = 'Нет'

type KeysOf<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T] & string

export function cells<T>() {
  return {
    list: (key: KeysOf<T, string[]>) => ({
      key,
      text: (g: T, { tv }: RenderContext) => (g[key] as string[]).map(tv).join(', ') || tv(EMPTY),
    }),
    exact: (key: KeysOf<T, string>) => ({
      key,
      text: (g: T, { tv }: RenderContext) => tv(g[key] as string),
    }),
  }
}

export const l10n = (ru: string, uk: string, en: string): L10n => ({ ru, uk, en })
