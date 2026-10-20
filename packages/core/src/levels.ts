import type { ObjectId } from 'mongodb'
import { levelCoins } from '@nanda/game'
import { users } from './db'
import { levelOf } from './quests'

export async function claimLevel(userId: ObjectId, level: unknown) {
  if (typeof level !== 'number') return null
  const coins = levelCoins(level)
  if (!coins) return null

  const people = await users()
  const doc = await people.findOne({ _id: userId }, { projection: { xp: 1 } })
  if (!doc || levelOf(doc.xp ?? 0) < level) return null

  const taken = await people.findOneAndUpdate(
    { _id: userId, levelsTaken: { $ne: level } },
    { $addToSet: { levelsTaken: level }, $inc: { coins } },
    { returnDocument: 'after', projection: { coins: 1, levelsTaken: 1 } },
  )
  if (!taken) return null

  return { coins, purse: taken.coins ?? 0, taken: taken.levelsTaken ?? [] }
}
