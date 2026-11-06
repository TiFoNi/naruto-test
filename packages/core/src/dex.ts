import type { ObjectId } from 'mongodb'
import { cardPoints, type ModeId } from '@nanda/game'
import { cards, users } from './db'

export type CardGain = { mode: ModeId; xp: number }

export const cardXpFor = (mode: ModeId, { daily = false }: { daily?: boolean; pool?: number } = {}) => cardPoints(mode, daily)

export const cardKey = (userId: ObjectId, game: string, id: number) => `${userId.toHexString()}:${game}:${id}`

export async function openDex(userId: ObjectId, game: string | undefined, id: number | undefined, gain?: CardGain) {
  if (!game || !Number.isInteger(id)) return
  await (await users()).updateOne({ _id: userId }, { $addToSet: { [`dex.${game}`]: id } })
  if (!gain || gain.xp <= 0) return
  await (await cards()).updateOne(
    { _id: cardKey(userId, game, id!) },
    {
      $inc: { xp: gain.xp, [`modes.${gain.mode}.n`]: 1, [`modes.${gain.mode}.xp`]: gain.xp },
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId, game, entityId: id! },
    },
    { upsert: true },
  )
}

export async function dexOf(userId: ObjectId, game: string) {
  const doc = await (await users()).findOne({ _id: userId }, { projection: { [`dex.${game}`]: 1 } })
  return doc?.dex?.[game] ?? []
}

export async function cardsOf(userId: ObjectId, game: string) {
  const list = await (await cards()).find({ userId, game }, { projection: { entityId: 1, xp: 1, modes: 1 } }).toArray()
  return Object.fromEntries(list.map((one) => [one.entityId, { xp: one.xp, modes: one.modes ?? {} }]))
}

export async function showcaseOf(user: { _id?: ObjectId; cardPins?: string[]; dex?: Record<string, number[]> }, limit: number) {
  const opened = (game: string, id: number) => (user.dex?.[game] ?? []).includes(id)
  const pins = (user.cardPins ?? [])
    .map((key) => {
      const [game, raw] = key.split(':')
      return { game: game!, id: Number(raw) }
    })
    .filter((one) => Number.isInteger(one.id) && opened(one.game, one.id))
    .slice(0, limit)
  if (!pins.length) return []
  const found = await (await cards()).find({ _id: { $in: pins.map((one) => cardKey(user._id!, one.game, one.id)) } }, { projection: { xp: 1 } }).toArray()
  const xp = new Map(found.map((one) => [one._id, one.xp]))
  return pins.map((one) => ({ ...one, xp: xp.get(cardKey(user._id!, one.game, one.id)) ?? 0 }))
}
