import { GAME_SPECS, MODE_IDS, type GameId, type ModeId } from '@nanda/game'
import { entities, settings } from './db'

export type Entity = Record<string, unknown> & { id: number; answer: boolean }

type GameData = { byId: Map<number, Entity>; pool: Entity[]; list: Entity[]; updated?: string }

const TTL = 60_000

const cache = new Map<GameId, { at: number; data: GameData }>()
const loading = new Map<GameId, Promise<GameData>>()

export const isGame = (value: unknown): value is GameId => typeof value === 'string' && value in GAME_SPECS

export const isMode = (value: unknown): value is ModeId => typeof value === 'string' && (MODE_IDS as string[]).includes(value)

async function load(game: GameId): Promise<GameData> {
  const collection = await entities()
  const list = (await collection
    .find({ game, hidden: { $ne: true } }, { projection: { _id: 0, game: 0, hidden: 0, updatedAt: 0 }, sort: { id: 1 } })
    .toArray()) as unknown as Entity[]

  const config = await (await settings()).findOne({ game }, { projection: { _id: 0, updated: 1 } })

  const data = {
    byId: new Map(list.map((e) => [e.id, e])),
    pool: list.filter((e) => e.answer),
    list,
    updated: config?.updated,
  }
  cache.set(game, { at: Date.now(), data })
  return data
}

export async function gameData(game: GameId): Promise<GameData> {
  const hit = cache.get(game)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  let pending = loading.get(game)
  if (!pending) {
    pending = load(game).finally(() => loading.delete(game))
    loading.set(game, pending)
  }
  return pending
}

export const knows = async (game: GameId, id: number) => (await gameData(game)).byId.has(id)

export const forget = (game?: GameId) => (game ? cache.delete(game) : cache.clear())
