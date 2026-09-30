import { GAME_SPECS, type GameId } from '@nanda/game'
import { gameData, type Entity } from './games'

export type Facet = { key: string; value: string }
export type GridPlan = { rows: Facet[]; cols: Facet[] }

const SKIP = new Set(['', 'Нет', 'Нема', 'None', '—', '-'])
const SIDE = 3

type Candidate = Facet & { ids: Set<number> }

const values = (entity: Entity, key: string, kind: string) => {
  const raw = entity[key]
  if (kind === 'list') return Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : []
  if (kind === 'exact') return typeof raw === 'string' ? [raw] : []
  return []
}

function candidates(pool: Entity[], game: GameId, floor: number) {
  const found = new Map<string, Candidate>()

  for (const { key, kind } of GAME_SPECS[game].columns) {
    for (const entity of pool) {
      for (const value of values(entity, key, kind)) {
        if (SKIP.has(value.trim())) continue
        const id = `${key}:${value}`
        const held = found.get(id) ?? { key, value, ids: new Set<number>() }
        held.ids.add(entity.id)
        found.set(id, held)
      }
    }
  }

  return [...found.values()].filter((one) => one.ids.size >= floor)
}

const overlap = (a: Set<number>, b: Set<number>) => {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  let count = 0
  for (const id of small) if (big.has(id)) count++
  return count
}

function shuffled<T>(list: T[]) {
  const copy = [...list]
  for (let at = copy.length - 1; at > 0; at--) {
    const to = Math.floor(Math.random() * (at + 1))
    ;[copy[at], copy[to]] = [copy[to], copy[at]]
  }
  return copy
}

const same = (a: Candidate, b: Candidate) => a.key === b.key && a.value === b.value

function search(pool: Candidate[], min: number, tries: number) {
  const wide = [...pool].sort((a, b) => b.ids.size - a.ids.size)

  for (let attempt = 0; attempt < tries; attempt++) {
    const rows = shuffled(wide.slice(0, Math.max(SIDE * 4, Math.ceil(wide.length * 0.7)))).slice(0, SIDE)
    if (rows.length < SIDE) continue

    const able = pool.filter(
      (one) => !rows.some((row) => same(row, one)) && rows.every((row) => overlap(row.ids, one.ids) >= min),
    )
    if (able.length < SIDE) continue

    const cols: Candidate[] = []
    for (const one of shuffled(able)) {
      if (cols.length === SIDE) break
      if (cols.some((held) => same(held, one))) continue
      if (cols.some((held) => held.key === one.key) && able.length > SIDE * 3) continue
      cols.push(one)
    }
    if (cols.length < SIDE) {
      for (const one of shuffled(able)) {
        if (cols.length === SIDE) break
        if (!cols.some((held) => same(held, one))) cols.push(one)
      }
    }

    if (cols.length === SIDE) return { rows, cols }
  }
  return null
}

export async function planGrid(game: GameId, min = 5): Promise<GridPlan | null> {
  const { pool } = await gameData(game)
  const deck = candidates(pool, game, Math.max(min * 2, 10))
  if (deck.length < SIDE * 2) return null

  for (const want of [min, min - 1, min - 2].filter((one) => one >= 2)) {
    const found = search(deck, want, want === min ? 400 : 120)
    if (found) {
      return {
        rows: found.rows.map(({ key, value }) => ({ key, value })),
        cols: found.cols.map(({ key, value }) => ({ key, value })),
      }
    }
  }
  return null
}

export function matchesFacet(entity: Entity, facet: Facet, game: GameId) {
  const spec = GAME_SPECS[game].columns.find((one) => one.key === facet.key)
  if (!spec) return false
  return values(entity, facet.key, spec.kind).includes(facet.value)
}

export async function gridAnswers(game: GameId, rows: Facet[], cols: Facet[]) {
  const { pool } = await gameData(game)
  return rows.map((row) =>
    cols.map((col) => pool.filter((one) => matchesFacet(one, row, game) && matchesFacet(one, col, game)).map((one) => one.id)),
  )
}
