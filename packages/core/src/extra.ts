import type { GameId, ModeId } from '@nanda/game'
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

export async function roundExtra(game: GameId, mode: ModeId, answerId: number, roll = Math.random()) {
  if (mode === 'page') return pageExtra(game, answerId, roll)
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

export const modePool = <T extends { id: number }>(pool: T[], mode: ModeId) =>
  mode === 'phrase' ? pool.filter((entity) => phraseCount(entity.id) > 0) : pool
