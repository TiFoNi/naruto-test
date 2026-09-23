import fs from 'node:fs'
import path from 'node:path'
import { GAME_SPECS, MODE_IDS, type GameId, type ModeId } from '@nanda/game'
import { DATA_DIR } from './data-dir.js'

export type Entity = Record<string, unknown> & { id: number; answer: boolean }

type GameData = { byId: Map<number, Entity>; pool: Entity[]; stamp: number }

const cache = new Map<GameId, GameData>()

export const isGame = (value: unknown): value is GameId => typeof value === 'string' && value in GAME_SPECS
export const knows = (game: GameId, id: number) => gameData(game).byId.has(id)

export const isMode = (value: unknown): value is ModeId => typeof value === 'string' && (MODE_IDS as string[]).includes(value)

export function gameData(game: GameId): GameData {
  const file = path.join(DATA_DIR, `${GAME_SPECS[game].data}.json`)
  const stamp = fs.statSync(file).mtimeMs
  const cached = cache.get(game)
  if (cached?.stamp === stamp) return cached

  const list = JSON.parse(fs.readFileSync(file, 'utf8')) as Entity[]
  const data = { byId: new Map(list.map((e) => [e.id, e])), pool: list.filter((e) => e.answer), stamp }
  cache.set(game, data)
  return data
}
