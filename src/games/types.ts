import type { L10n, Lang } from '../i18n/ui'
import type { ModeId } from '../modes'

export type Verdict = 'correct' | 'partial' | 'wrong'

export type Icon = { label: string; symbol: string; color: string; dark?: boolean }

export type Cell = { verdict: Verdict; text: string; arrow?: 'up' | 'down'; icons?: Icon[] }

export type Entity = { id: number; name: string; nameEn?: string; aliases?: string; thumb: number; answer: boolean }

export type Translate = (value: string) => string

export type RenderContext = { tv: Translate; lang: Lang }

export type Column<T> = { title: L10n; render: (guess: T, answer: T, ctx: RenderContext) => Cell }

export type GameId = 'naruto' | 'dota' | 'aot' | 'bleach' | 'tg' | 'berserk'

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

export function compareLists(guess: string[], answer: string[]): Verdict {
  const a = new Set(answer)
  if (guess.length === answer.length && guess.every((g) => a.has(g))) return 'correct'
  return guess.some((g) => a.has(g)) ? 'partial' : 'wrong'
}

export function compareOrdered(guess: number, answer: number): Pick<Cell, 'verdict' | 'arrow'> {
  if (guess === answer) return { verdict: 'correct' }
  return { verdict: 'wrong', arrow: answer > guess ? 'up' : 'down' }
}

export const exact = (guess: string, answer: string): Verdict => (guess === answer ? 'correct' : 'wrong')

export const EMPTY = 'Нет'

type KeysOf<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T]

export function cells<T>() {
  return {
    list:
      (key: KeysOf<T, string[]>) =>
      (g: T, a: T, { tv }: RenderContext): Cell => {
        const guess = g[key] as string[]
        return { verdict: compareLists(guess, a[key] as string[]), text: guess.map(tv).join(', ') || tv(EMPTY) }
      },
    exact:
      (key: KeysOf<T, string>) =>
      (g: T, a: T, { tv }: RenderContext): Cell => ({
        verdict: exact(g[key] as string, a[key] as string),
        text: tv(g[key] as string),
      }),
  }
}

export const l10n = (ru: string, uk: string, en: string): L10n => ({ ru, uk, en })
