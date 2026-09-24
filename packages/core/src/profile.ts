import { ObjectId, type Collection } from 'mongodb'
import { DAILY_KEYS, STAT_KEYS } from '@nanda/game'
import { shiftDay, today } from './daily'
import { users, type Stats, type UserDoc } from './db'
import { fail } from './http'
import { guestCookie, readGuest, readSession } from './session'

export { STAT_KEYS }

const NICKNAME = /^[\p{L}\p{N} _.\-]{2,24}$/u

export function defaultNickname(username: string) {
  const base = username.split('@')[0].replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 24)
  return base.length >= 2 ? base : 'Player'
}

export function parseNickname(value: unknown): string | null {
  const nickname = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return NICKNAME.test(nickname) ? nickname : null
}

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export function normalizeStats(stats: Partial<Stats> | undefined): Stats {
  return {
    solved: number(stats?.solved),
    streak: number(stats?.streak),
    best: number(stats?.best),
    totalGuesses: number(stats?.totalGuesses),
    skipped: number(stats?.skipped),
  }
}

export function dailyStats(stats: Partial<Stats> | undefined) {
  const base = normalizeStats(stats)
  const day = today()
  const alive = stats?.lastDay === day || stats?.lastDay === shiftDay(day, -1)
  return { ...base, streak: alive ? base.streak : 0, lastDay: stats?.lastDay ?? null }
}

export async function applyDailyResult(collection: Collection<UserDoc>, userId: ObjectId, key: string, day: string, guesses: number) {
  const doc = await collection.findOne({ _id: userId }, { projection: { [`stats.${key}`]: 1 } })
  const prev = doc?.stats?.[key]
  const base = normalizeStats(prev)
  if (prev?.lastDay === day) return dailyStats(prev)
  const streak = prev?.lastDay === shiftDay(day, -1) ? base.streak + 1 : 1
  const next = { ...base, solved: base.solved + 1, streak, best: Math.max(base.best, streak), totalGuesses: base.totalGuesses + guesses, lastDay: day }
  await collection.updateOne({ _id: userId }, { $set: { [`stats.${key}`]: next } })
  return dailyStats(next)
}

export function toProfile(doc: UserDoc) {
  return {
    user: {
      id: doc._id!.toHexString(),
      username: doc.username,
      nickname: doc.nickname ?? defaultNickname(doc.username),
    },
    stats: Object.fromEntries([
      ...STAT_KEYS.map((key) => [key, normalizeStats(doc.stats?.[key])]),
      ...DAILY_KEYS.map((key) => [key, dailyStats(doc.stats?.[key])]),
    ]),
    challenges: { solved: number(doc.challengeStats?.solved) },
    duels: {
      played: number(doc.duelStats?.played),
      wins: number(doc.duelStats?.wins),
      losses: number(doc.duelStats?.losses),
      draws: number(doc.duelStats?.draws),
    },
  }
}

export async function currentUser(request: Request) {
  const session = await readSession(request)
  if (!session || !ObjectId.isValid(session.id)) return null
  const collection = await users()
  const doc = await collection.findOne({ _id: new ObjectId(session.id) })
  return doc ? { doc, collection } : null
}

export const unauthorized = () => fail(401, 'unauthorized')

export type Owner = { id: ObjectId; guest: boolean; cookie?: string }

export async function roundOwner(request: Request): Promise<Owner> {
  const session = await readSession(request)
  if (session && ObjectId.isValid(session.id)) return { id: new ObjectId(session.id), guest: false }

  const existing = await readGuest(request)
  if (existing && ObjectId.isValid(existing)) return { id: new ObjectId(existing), guest: true }

  const id = new ObjectId()
  return { id, guest: true, cookie: await guestCookie(request, id.toHexString()) }
}


const orZero = (path: string) => ({ $ifNull: [`$${path}`, 0] })

export async function applySkip(collection: Collection<UserDoc>, userId: ObjectId, key: string) {
  const doc = await collection.findOneAndUpdate(
    { _id: userId },
    { $inc: { [`stats.${key}.skipped`]: 1 } },
    { returnDocument: 'after', projection: { [`stats.${key}`]: 1 } },
  )
  return normalizeStats(doc?.stats?.[key])
}

export async function applyResult(collection: Collection<UserDoc>, userId: ObjectId, key: string, won: boolean, guesses: number) {
  const path = `stats.${key}`
  const update = won
    ? [
        {
          $set: {
            [path]: {
              solved: { $add: [orZero(`${path}.solved`), 1] },
              streak: { $add: [orZero(`${path}.streak`), 1] },
              best: { $max: [orZero(`${path}.best`), { $add: [orZero(`${path}.streak`), 1] }] },
              totalGuesses: { $add: [orZero(`${path}.totalGuesses`), guesses] },
              skipped: orZero(`${path}.skipped`),
            },
          },
        },
      ]
    : { $set: { [`${path}.streak`]: 0 } }
  const doc = await collection.findOneAndUpdate({ _id: userId }, update, { returnDocument: 'after' })
  return normalizeStats(doc?.stats?.[key])
}
