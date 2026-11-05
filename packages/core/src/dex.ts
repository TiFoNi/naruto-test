import type { ObjectId } from 'mongodb'
import { users } from './db'

export async function openDex(userId: ObjectId, game: string | undefined, id: number | undefined) {
  if (!game || !Number.isInteger(id)) return
  await (await users()).updateOne({ _id: userId }, { $addToSet: { [`dex.${game}`]: id } })
}

export async function dexOf(userId: ObjectId, game: string) {
  const doc = await (await users()).findOne({ _id: userId }, { projection: { [`dex.${game}`]: 1 } })
  return doc?.dex?.[game] ?? []
}
