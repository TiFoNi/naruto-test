import { ObjectId, type Collection } from 'mongodb'
import { STAT_KEYS } from '../../src/games/specs.js'
import { users, type Stats, type UserDoc } from './db.js'
import { fail } from './http.js'
import { readSession } from './session.js'

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
  }
}

export function toProfile(doc: UserDoc) {
  return {
    user: {
      id: doc._id!.toHexString(),
      username: doc.username,
      nickname: doc.nickname ?? defaultNickname(doc.username),
    },
    stats: Object.fromEntries(STAT_KEYS.map((key) => [key, normalizeStats(doc.stats?.[key])])),
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

const orZero = (path: string) => ({ $ifNull: [`$${path}`, 0] })

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
            },
          },
        },
      ]
    : { $set: { [`${path}.streak`]: 0 } }
  const doc = await collection.findOneAndUpdate({ _id: userId }, update, { returnDocument: 'after' })
  return normalizeStats(doc?.stats?.[key])
}
