import abilities from '@nanda/game/data/dota-abilities.json'

export type Ability = { key: string; name: { ru: string; uk: string; en: string } }

let cache: Record<string, Ability[]> | null = null

export function abilitiesOf(heroId: number): Ability[] {
  cache ??= abilities as Record<string, Ability[]>
  return cache[String(heroId)] ?? []
}

export const abilityByKey = (heroId: number, key: string | undefined) => abilitiesOf(heroId).find((a) => a.key === key)
