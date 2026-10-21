import type { ObjectId } from 'mongodb'
import { LEVEL_LAST, LEVEL_MID, levelCoins } from '@nanda/game'
import { users } from './db'
import { levelOf } from './quests'

export async function claimAll(userId: ObjectId) {
  const people = await users()
  const doc = await people.findOne({ _id: userId }, { projection: { xp: 1, levelsTaken: 1 } })
  if (!doc) return null

  const reached = levelOf(doc.xp ?? 0)
  const taken = new Set(doc.levelsTaken ?? [])
  const waiting: number[] = []
  for (let level = LEVEL_MID; level <= Math.min(reached, LEVEL_LAST); level += LEVEL_MID) {
    if (!taken.has(level) && levelCoins(level) > 0) waiting.push(level)
  }
  if (!waiting.length) return { coins: 0, purse: 0, taken: doc.levelsTaken ?? [], levels: [] }

  const coins = waiting.reduce((sum, level) => sum + levelCoins(level), 0)
  const paid = await people.findOneAndUpdate(
    { _id: userId, levelsTaken: { $nin: waiting } },
    { $addToSet: { levelsTaken: { $each: waiting } }, $inc: { coins } },
    { returnDocument: 'after', projection: { coins: 1, levelsTaken: 1 } },
  )
  if (!paid) return null

  return { coins, purse: paid.coins ?? 0, taken: paid.levelsTaken ?? [], levels: waiting }
}

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
