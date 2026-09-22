import fs from 'node:fs'
import path from 'node:path'
import { GAME_SPECS, MODE_IDS, type GameId, type ModeId } from '../../src/games/specs.js'

export type Entity = Record<string, unknown> & { id: number; answer: boolean }

type GameData = { byId: Map<number, Entity>; pool: Entity[] }

const cache = new Map<GameId, GameData>()

export const isGame = (value: unknown): value is GameId => typeof value === 'string' && value in GAME_SPECS
export const isMode = (value: unknown): value is ModeId => typeof value === 'string' && (MODE_IDS as string[]).includes(value)

export function gameData(game: GameId): GameData {
  let data = cache.get(game)
  if (!data) {
    const file = path.join(process.cwd(), 'src', 'data', `${GAME_SPECS[game].data}.json`)
    const list = JSON.parse(fs.readFileSync(file, 'utf8')) as Entity[]
    data = { byId: new Map(list.map((e) => [e.id, e])), pool: list.filter((e) => e.answer) }
    cache.set(game, data)
  }
  return data
}
