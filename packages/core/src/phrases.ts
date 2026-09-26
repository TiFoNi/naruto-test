import phrases from '@nanda/game/data/dota-phrases.json'

export type Phrase = { text: string; ru?: string; clip: number }

let cache: Record<string, Phrase[]> | null = null

export function phrasesOf(heroId: number): Phrase[] {
  cache ??= phrases as Record<string, Phrase[]>
  return cache[String(heroId)] ?? []
}
