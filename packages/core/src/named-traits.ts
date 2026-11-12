import { GAME_SPECS, type GameId } from '@nanda/game'

const SHARE = 0.4
const SHORTEST = 3

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const namesOf = (entity: Record<string, unknown>) =>
  ['name', 'nameUk', 'nameEn']
    .map((key) => entity[key])
    .filter((one): one is string => typeof one === 'string' && !!one)
    .map(plain)
    .join(' | ')

const shelf = new WeakMap<object, Set<string>>()

export function namedTraits(game: GameId, pool: Record<string, unknown>[]) {
  const known = shelf.get(pool)
  if (known) return known

  const holders = new Map<string, { names: string; value: string }[]>()
  for (const entity of pool) {
    const names = namesOf(entity)
    for (const column of GAME_SPECS[game].columns) {
      const raw = entity[column.key]
      const list = Array.isArray(raw) ? raw.map(String) : raw == null || raw === '' ? [] : [String(raw)]
      for (const value of new Set(list)) {
        const trait = `${column.key}:${value}`
        if (!holders.has(trait)) holders.set(trait, [])
        holders.get(trait)!.push({ names, value: plain(value) })
      }
    }
  }

  const found = new Set<string>()
  for (const [trait, list] of holders) {
    const value = list[0].value
    if (value.length < SHORTEST) continue
    const named = list.filter((one) => one.names.includes(value)).length
    if (named / list.length >= SHARE) found.add(trait)
  }

  shelf.set(pool, found)
  return found
}
