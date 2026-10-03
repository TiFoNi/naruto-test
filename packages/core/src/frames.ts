import type { Collection, ObjectId } from 'mongodb'
import { GAME_SPECS, type GameId } from '@nanda/game'
import { rounds, type UserDoc } from './db'
import { gameData } from './games'
import { WORLD_FRAMES } from './frame-list'

export * from './frame-list'

const isWorldFrame = (game: string): game is GameId => (WORLD_FRAMES as readonly string[]).includes(game)

export async function grantWorldFrame(users: Collection<UserDoc>, userId: ObjectId, game: string) {
  if (!isWorldFrame(game) || !(game in GAME_SPECS)) return

  const owner = await users.findOne({ _id: userId }, { projection: { frames: 1 } })
  if (owner?.frames?.includes(game)) return

  const pool = (await gameData(game)).pool.length
  if (!pool) return

  const solved = await (await rounds()).distinct('answerId', { userId, game, status: 'won' })
  if (solved.length < pool) return

  await users.updateOne({ _id: userId }, { $addToSet: { frames: game } })
}
