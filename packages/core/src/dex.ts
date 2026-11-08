import type { ObjectId } from 'mongodb'
import { CARD_MAX_LEVEL, cardPoints, type ModeId } from '@nanda/game'
import { cards, users } from './db'

export type CardGain = { mode: ModeId; xp: number }

export const cardXpFor = (mode: ModeId, { daily = false }: { daily?: boolean; pool?: number } = {}) => cardPoints(mode, daily)

export const cardKey = (userId: ObjectId, game: string, id: number) => `${userId.toHexString()}:${game}:${id}`

export async function openDex(userId: ObjectId, game: string | undefined, id: number | undefined, gain?: CardGain) {
  if (!game || !Number.isInteger(id)) return
  await (await users()).updateOne({ _id: userId }, { $addToSet: { [`dex.${game}`]: id } })
  if (!gain || gain.xp <= 0) return
  const mode = `modes.${gain.mode}`
  await (await cards()).updateOne(
    { _id: cardKey(userId, game, id!) },
    [
      {
        $set: {
          userId: { $ifNull: ['$userId', userId] },
          game: { $ifNull: ['$game', game] },
          entityId: { $ifNull: ['$entityId', id!] },
          gained: { $max: [0, { $min: [gain.xp, { $subtract: [CARD_MAX_LEVEL, { $ifNull: ['$xp', 0] }] }] }] },
        },
      },
      {
        $set: {
          xp: { $add: [{ $ifNull: ['$xp', 0] }, '$gained'] },
          [`${mode}.n`]: { $add: [{ $ifNull: [`$${mode}.n`, 0] }, 1] },
          [`${mode}.xp`]: { $add: [{ $ifNull: [`$${mode}.xp`, 0] }, '$gained'] },
          updatedAt: new Date(),
        },
      },
      { $unset: 'gained' },
    ],
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
