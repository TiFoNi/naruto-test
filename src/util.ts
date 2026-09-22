import type { Entity, Game } from './games/types'

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function preload(game: Game, e: Entity) {
  new Image().src = game.fullUrl(e)
}

const recent = new Map<string, number[]>()

export function pickAnswer(game: Game): Entity {
  const seen = recent.get(game.id) ?? []
  const pool = game.entities.filter((e) => e.answer)
  const fresh = pool.filter((e) => !seen.includes(e.id))
  const list = fresh.length ? fresh : pool
  const pick = list[Math.floor(Math.random() * list.length)]
  seen.push(pick.id)
  if (seen.length > Math.min(60, Math.floor(pool.length / 2))) seen.shift()
  recent.set(game.id, seen)
  return pick
}
