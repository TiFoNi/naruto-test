import { GAME_SPECS, type GameId } from '@nanda/game'
import { gameData } from './games'

export type PairJoin = 'single' | 'and' | 'or'
export type PairSide = 'left' | 'right' | 'both' | 'none'

type Shape = 'one' | 'both' | 'none'
export type PairPart = { key: string; value: string }
export type PairAsk = { parts: PairPart[]; join: PairJoin }
export type PairRound = { left: number; right: number; ask: PairAsk; answer: PairSide }

const BLANK = /^(нет|нету|неизвестн|без |сам[иа] |одиноч|нейтрал|отсутств|друг|не указан|прочее|разное)/i
const LEAST = 4
const COMMON = 0.25
const TRIES = 40

type Trait = { key: string; value: string; who: Set<number> }

const shelf = new Map<string, Trait[]>()

async function traitsOf(game: GameId) {
  const known = shelf.get(game)
  if (known) return known

  const { pool } = await gameData(game)
  const columns = GAME_SPECS[game].columns.filter((one) => one.key !== 'gender' && one.kind !== 'order' && one.kind !== 'optionalOrder')
  const found: Trait[] = []

  for (const column of columns) {
    const seen = new Map<string, Set<number>>()
    for (const entity of pool) {
      const raw = (entity as unknown as Record<string, unknown>)[column.key]
      const list = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : []
      for (const value of new Set(list)) {
        if (BLANK.test(value)) continue
        if (!seen.has(value)) seen.set(value, new Set())
        seen.get(value)!.add(entity.id)
      }
    }
    for (const [value, who] of seen) if (who.size >= LEAST && who.size <= pool.length * 0.7) found.push({ key: column.key, value, who })
  }

  shelf.set(game, found)
  return found
}

const nested = (one: Set<number>, two: Set<number>) => [...one].every((id) => two.has(id))

const pick = <T>(list: T[], roll: () => number) => list[Math.floor(roll() * list.length)]

function spread(traits: Trait[], roll: () => number) {
  const byKey = new Map<string, Trait[]>()
  for (const trait of traits) {
    if (!byKey.has(trait.key)) byKey.set(trait.key, [])
    byKey.get(trait.key)!.push(trait)
  }
  const key = pick([...byKey.keys()], roll)
  return key ? pick(byKey.get(key)!, roll) : undefined
}

function blend(traits: Trait[], roll: () => number): { ask: PairAsk; who: Set<number> } | null {
  for (let tries = 0; tries < TRIES; tries++) {
    const one = pick(traits, roll)
    const two = pick(traits, roll)
    if (!one || !two || one === two || nested(one.who, two.who) || nested(two.who, one.who)) continue

    if (one.key === two.key) {
      const either = new Set([...one.who, ...two.who])
      if (one.who.size > 0 && two.who.size > 0 && either.size >= LEAST * 2)
        return { ask: { parts: [one, two].map(({ key, value }) => ({ key, value })), join: 'or' as const }, who: either }
      continue
    }

    const both = new Set([...one.who].filter((id) => two.who.has(id)))
    if (both.size >= LEAST) return { ask: { parts: [one, two].map(({ key, value }) => ({ key, value })), join: 'and' as const }, who: both }
  }
  return null
}

const alike = (traits: Trait[], one: number, two: number) => traits.some((trait) => trait.who.has(one) && trait.who.has(two))

export async function pairRound(game: GameId, level: number, roll: () => number): Promise<PairRound | null> {
  const traits = await traitsOf(game)
  if (traits.length < 3) return null
  const { pool } = await gameData(game)
  if (pool.length < 8) return null

  const easy = level < 2
  const plain = easy || level < 8 || roll() < 0.45
  const kinds: Shape[] = easy ? ['one'] : level < 8 ? ['one', 'one', 'none'] : ['one', 'one', 'both', 'none']
  const want = pick(kinds, roll)

  const shaped = plain
    ? (() => {
        const fit = traits.filter((trait) => (easy ? trait.who.size / pool.length >= COMMON : true))
        const trait = spread(fit.length ? fit : traits, roll)
        return trait && { ask: { parts: [{ key: trait.key, value: trait.value }], join: 'single' as const }, who: trait.who }
      })()
    : blend(traits, roll)

  if (!shaped) return null
  const { ask, who } = shaped

  const holders = pool.filter((entity) => who.has(entity.id))
  const others = pool.filter((entity) => !who.has(entity.id))
  if (!holders.length || others.length < 2) return null

  const pair = (): [number, number] | null => {
    if (want === 'both') {
      if (holders.length < 2) return null
      const one = pick(holders, roll)
      const two = pick(holders.filter((entity) => entity.id !== one.id), roll)
      return two ? [one.id, two.id] : null
    }

    if (want === 'none') {
      for (let tries = 0; tries < TRIES; tries++) {
        const one = pick(others, roll)
        const two = pick(others, roll)
        if (!one || !two || one.id === two.id) continue
        const near = holders.some((holder) => alike(traits, holder.id, one.id)) && holders.some((holder) => alike(traits, holder.id, two.id))
        if (near) return [one.id, two.id]
      }
      return null
    }

    for (let tries = 0; tries < TRIES; tries++) {
      const holder = pick(holders, roll)
      const other = pick(others, roll)
      if (!holder || !other) continue
      if (alike(traits, holder.id, other.id)) return [holder.id, other.id]
    }
    const holder = pick(holders, roll)
    const other = pick(others, roll)
    return holder && other ? [holder.id, other.id] : null
  }

  const spot = pair()
  if (!spot) return null

  const flip = roll() < 0.5
  const left = flip ? spot[1] : spot[0]
  const right = flip ? spot[0] : spot[1]
  const answer: PairSide = want === 'both' ? 'both' : want === 'none' ? 'none' : who.has(left) ? 'left' : 'right'

  return { left, right, ask, answer }
}
