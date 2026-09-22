export type Verdict = 'correct' | 'partial' | 'wrong'

export type Icon = { label: string; symbol: string; color: string; dark?: boolean }

export type Cell = { verdict: Verdict; text: string; arrow?: 'up' | 'down'; icons?: Icon[] }

export type Entity = { id: number; name: string; thumb: number; answer: boolean }

export type Column<T> = { title: string; render: (guess: T, answer: T) => Cell }

export type GameId = 'naruto' | 'dota' | 'aot' | 'bleach'

export type Game<T extends Entity = Entity> = {
  id: GameId
  label: string
  logo: [string, string]
  entities: T[]
  columns: Column<T>[]
  searchTerms: (e: T) => string[]
  subtitle: (e: T) => string | undefined
  atlas: { cols: number; rows: number }
  atlasUrl: string
  fullUrl: (e: T) => string
  placeholder: string
  classic: { title: string; prompt: string }
  image: { label: string; title: string; prompt: string; wide: boolean }
  legend: { up: string; down: string }
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
