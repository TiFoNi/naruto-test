import type { GameId, ModeId } from '@nanda/game'
import { abilitiesOf } from './abilities'
import { gameData } from './games'

const OPTIONS = 3

function seeded(roll: number) {
  let state = Math.floor(roll * 0xffffffff) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function pageExtra(game: GameId, answerId: number, roll: number) {
  const { pool, byId } = gameData(game)
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

export function roundExtra(game: GameId, mode: ModeId, answerId: number, roll = Math.random()) {
  if (mode === 'page') return pageExtra(game, answerId, roll)
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
