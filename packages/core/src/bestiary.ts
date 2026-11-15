import type { ObjectId } from 'mongodb'
import {
  CARD_RARITIES,
  CARD_UPS_DAY,
  SHARDS_DAY,
  HUNT_MAX,
  DUST_CRAFT,
  cardPower,
  dustFor,
  cardUp,
  type CardRarity,
} from '@nanda/game'
import { cards, users, type CardDoc } from './db'
import { today } from './daily'
import { cardKey } from './dex'

export type CardGrade = {
  rank: number
  rarity: CardRarity
  shards: number
  up: number
  power: number
  spare: number
  ready: boolean
}

const LOG_KEEP = 8

const DUST_SCRAP_RATE = 0.25

export const gradeOf = (card?: { rank?: number; shards?: number; xp?: number } | null): CardGrade => {
  const rank = Math.max(0, Math.min(CARD_RARITIES.length - 1, card?.rank ?? 0))
  const shards = Math.max(0, card?.shards ?? 0)
  const up = cardUp(rank)
  const top = rank >= CARD_RARITIES.length - 1
  return {
    rank,
    rarity: CARD_RARITIES[rank]!,
    shards,
    up,
    power: cardPower(rank),
    spare: top ? shards : Math.max(0, shards - up),
    ready: !top && shards >= up,
  }
}

export async function cardOf(userId: ObjectId, game: string, id: number) {
  return (await cards()).findOne({ _id: cardKey(userId, game, id) })
}

export async function shardRoom(userId: ObjectId, game: string) {
  const doc = await (await users()).findOne({ _id: userId }, { projection: { [`shardDay.${game}`]: 1 } })
  const slot = doc?.shardDay?.[game]
  const got = slot?.day === today() ? slot.n : 0
  return { got, left: Math.max(0, SHARDS_DAY - got) }
}

async function takeShards(userId: ObjectId, game: string, want: number) {
  const day = today()
  const { got, left } = await shardRoom(userId, game)
  const n = Math.min(want, left)
  if (n > 0) await (await users()).updateOne({ _id: userId }, { $set: { [`shardDay.${game}`]: { day, n: got + n } } })
  return n
}

export async function addShards(userId: ObjectId, game: string, id: number, want: number, from: string) {
  if (want <= 0) return
  const n = await takeShards(userId, game, want)
  if (n <= 0) return
  const stamp = { at: new Date(), from, n }
  await (await cards()).updateOne(
    { _id: cardKey(userId, game, id) },
    {
      $setOnInsert: { userId, game, entityId: id, xp: 0, rank: 0, modes: {} },
      $inc: { shards: n },
      $push: { log: { $each: [stamp], $position: 0, $slice: LOG_KEEP } },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  )
}

export async function huntOf(userId: ObjectId, game: string) {
  const doc = await (await users()).findOne({ _id: userId }, { projection: { [`hunt.${game}`]: 1 } })
  return (doc?.hunt?.[game] ?? []).slice(0, HUNT_MAX)
}

export async function setHunt(userId: ObjectId, game: string, ids: number[]) {
  const list = [...new Set(ids.filter((id) => Number.isInteger(id)))].slice(0, HUNT_MAX)
  await (await users()).updateOne({ _id: userId }, { $set: { [`hunt.${game}`]: list } })
  return list
}

export async function raiseCard(userId: ObjectId, game: string, id: number) {
  const card = await cardOf(userId, game, id)
  const grade = gradeOf(card)
  if (!grade.ready) return { ok: false as const, why: 'not_ready' }

  const day = today()
  const holder = await (await users()).findOne({ _id: userId }, { projection: { ups: 1 } })
  const used = holder?.ups?.week === day ? (holder.ups?.n ?? 0) : 0
  if (used >= CARD_UPS_DAY) return { ok: false as const, why: 'day_limit' }

  await (await cards()).updateOne(
    { _id: cardKey(userId, game, id) },
    { $set: { rank: grade.rank + 1, shards: Math.max(0, grade.shards - grade.up), updatedAt: new Date() } },
  )
  await (await users()).updateOne({ _id: userId }, { $set: { ups: { week: day, n: used + 1 } } })
  return { ok: true as const, rank: grade.rank + 1, ups: { day, n: used + 1 } }
}

export async function scrapCard(userId: ObjectId, game: string, id: number, want: number) {
  const card = await cardOf(userId, game, id)
  const grade = gradeOf(card)
  const take = Math.min(grade.shards, Math.max(0, Math.floor(want)))
  const dust = dustFor(take)
  if (dust <= 0) return { ok: false as const, why: 'nothing' }

  const spent = Math.round(dust / DUST_SCRAP_RATE)
  await (await cards()).updateOne({ _id: cardKey(userId, game, id) }, { $inc: { shards: -spent }, $set: { updatedAt: new Date() } })
  const holder = await (await users()).findOneAndUpdate({ _id: userId }, { $inc: { [`dust.${game}`]: dust } }, { returnDocument: 'after', projection: { dust: 1 } })
  return { ok: true as const, dust, left: holder?.dust?.[game] ?? dust }
}

export async function craftCard(userId: ObjectId, game: string, id: number, want: number) {
  const n = Math.max(1, Math.min(SHARDS_DAY, Math.floor(want)))
  const card = await cardOf(userId, game, id)
  const grade = gradeOf(card)
  const price = DUST_CRAFT
  if (grade.rank >= CARD_RARITIES.length - 1) return { ok: false as const, why: 'top' }

  if ((await shardRoom(userId, game)).left < n) return { ok: false as const, why: 'day_cap' }

  const cost = price * n
  const holder = await (await users()).findOneAndUpdate(
    { _id: userId, [`dust.${game}`]: { $gte: cost } },
    { $inc: { [`dust.${game}`]: -cost } },
    { returnDocument: 'after', projection: { dust: 1 } },
  )
  if (!holder) return { ok: false as const, why: 'dust' }
  await takeShards(userId, game, n)
  await (await cards()).updateOne(
    { _id: cardKey(userId, game, id) },
    {
      $setOnInsert: { userId, game, entityId: id, xp: 0, rank: grade.rank, modes: {} },
      $inc: { shards: n },
      $set: { updatedAt: new Date() },
      $push: { log: { $each: [{ at: new Date(), from: 'craft', n }], $position: 0, $slice: LOG_KEEP } },
    },
    { upsert: true },
  )
  return { ok: true as const, shards: n, cost, dust: holder.dust?.[game] ?? 0 }
}

export const powerOf = (card?: Pick<CardDoc, 'rank' | 'shards'> | null) => gradeOf(card).power
