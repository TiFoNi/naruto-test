import { GAME_SPECS, type GameId, type ModeId } from '@nanda/game'
import { abilitiesOf } from './abilities'
import { phrasesOf } from './phrases'
import { gameData } from './games'

const OPTIONS = 3

function seeded(roll: number) {
  let state = Math.floor(roll * 0xffffffff) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

async function pageExtra(game: GameId, answerId: number, roll: number) {
  const { pool, byId } = await gameData(game)
  const answer = byId.get(answerId) as { pages?: number } | undefined
  const count = answer?.pages ?? 0
  if (!count) return undefined

  const random = seeded(roll)
  const page = 1 + Math.floor(random() * count)
  const others = pool.filter((e) => e.id !== answerId)
  const decoys: number[] = []
  while (decoys.length < OPTIONS - 1 && decoys.length < others.length) {
    const candidate = others[Math.floor(random() * others.length)].id
    if (!decoys.includes(candidate)) decoys.push(candidate)
  }
  const options = [answerId, ...decoys]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return `${page}|${options.join(',')}`
}

const PLAIN = new Set(['gender'])
const BLANK = /^(нет|нету|неизвестн|без |сам[иа] |одиноч|нейтрал|отсутств|друг|не указан|прочее|разное)/i
const ODD_TRIES = 24

const traitsOf = (game: GameId, entity: Record<string, unknown>) => {
  const keys = GAME_SPECS[game].columns.filter((column) => column.kind !== 'order' && column.kind !== 'optionalOrder' && !PLAIN.has(column.key))
  return new Set(
    keys.flatMap((column) => {
      const value = entity[column.key]
      const list = Array.isArray(value) ? value : value == null ? [] : [value]
      return list.map(String).filter((one) => !BLANK.test(one)).map((one) => `${column.key}:${one}`)
    }),
  )
}

const onlyOdd = (marks: Map<number, Set<string>>, four: { id: number }[], answerId: number) => {
  const counts = new Map<string, number>()
  for (const one of four) for (const trait of marks.get(one.id) ?? []) counts.set(trait, (counts.get(trait) ?? 0) + 1)
  for (const [trait, seen] of counts) {
    if (seen !== 3) continue
    const missing = four.find((one) => !marks.get(one.id)?.has(trait))
    if (missing && missing.id !== answerId) return false
  }
  return true
}

async function oddExtra(game: GameId, answerId: number, roll: number) {
  const { pool } = await gameData(game)
  if (pool.length < 8) return undefined

  const marks = new Map(pool.map((entity) => [entity.id, traitsOf(game, entity as Record<string, unknown>)]))
  const mine = marks.get(answerId) ?? new Set<string>()

  const shared = new Map<string, { id: number }[]>()
  for (const entity of pool) {
    if (entity.id === answerId) continue
    for (const trait of marks.get(entity.id) ?? []) {
      if (mine.has(trait)) continue
      if (!shared.has(trait)) shared.set(trait, [])
      shared.get(trait)!.push(entity)
    }
  }

  const traits = [...shared].filter(([, members]) => members.length >= 3)
  if (!traits.length) return undefined

  const random = seeded(roll)
  const draw = <T>(list: T[], count: number) => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, count)
  }

  let fallback: string | undefined
  for (let tries = 0; tries < ODD_TRIES; tries++) {
    const [trait, members] = traits[Math.floor(random() * traits.length)]
    const four = draw([...draw(members, 3), { id: answerId }], 4)
    const extra = `${four.map((one) => one.id).join(',')}|${trait}`
    fallback ??= extra
    if (onlyOdd(marks, four, answerId)) return extra
  }
  return fallback
}

export const oddOptions = (extra: string | undefined) => {
  const raw = extra?.split('|')[0]
  return raw ? raw.split(',').map(Number).filter((id) => Number.isFinite(id)) : []
}

export const oddTrait = (extra: string | undefined) => {
  const raw = extra?.split('|')[1]
  if (!raw) return undefined
  const at = raw.indexOf(':')
  return at < 0 ? undefined : { key: raw.slice(0, at), value: raw.slice(at + 1) }
}

export async function roundExtra(game: GameId, mode: ModeId, answerId: number, roll = Math.random()) {
  if (mode === 'page') return pageExtra(game, answerId, roll)
  if (mode === 'odd') return oddExtra(game, answerId, roll)
  if (mode === 'phrase') {
    const list = phrasesOf(answerId)
    return list.length ? String(Math.floor(roll * list.length)) : undefined
  }
  if (mode !== 'ability') return undefined
  const list = abilitiesOf(answerId)
  return list.length ? list[Math.floor(roll * list.length)].key : undefined
}

export function pageOf(extra: string | undefined) {
  return extra?.split('|')[0] ?? '1'
}

export function optionsOf(extra: string | undefined) {
  const raw = extra?.split('|')[1]
  return raw ? raw.split(',').map(Number) : []
}

export function phraseOrder(answerId: number, extra: string | undefined) {
  const list = phrasesOf(answerId)
  const spoken = list.filter((line) => !line.laugh)
  const laughs = list.filter((line) => line.laugh)
  if (!spoken.length) return list
  const start = Number(extra ?? 0) || 0
  return [...spoken.map((_, i) => spoken[(start + i) % spoken.length]), ...laughs]
}

export function phraseAt(answerId: number, extra: string | undefined, step: number) {
  const order = phraseOrder(answerId, extra)
  return order[step]
}

export const phraseCount = (answerId: number) => phrasesOf(answerId).length

const CONTENT: Partial<Record<ModeId, (id: number) => boolean>> = {
  phrase: (id) => phrasesOf(id).length > 0,
  ability: (id) => abilitiesOf(id).length > 0,
}

export const modeFits = (mode: ModeId, id: number) => CONTENT[mode]?.(id) ?? true

export const modePool = <T extends { id: number }>(pool: T[], mode: ModeId) =>
  CONTENT[mode] ? pool.filter((entity) => modeFits(mode, entity.id)) : pool
