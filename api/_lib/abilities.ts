import fs from 'node:fs'
import path from 'node:path'

export type Ability = { key: string; name: { ru: string; uk: string; en: string } }

let cache: Record<string, Ability[]> | null = null

export function abilitiesOf(heroId: number): Ability[] {
  cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'dota-abilities.json'), 'utf8')) as Record<string, Ability[]>
  return cache[String(heroId)] ?? []
}

export const abilityByKey = (heroId: number, key: string | undefined) => abilitiesOf(heroId).find((a) => a.key === key)
