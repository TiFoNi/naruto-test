import { ObjectId } from 'mongodb'
import { users, type Stats, type UserDoc } from './db.js'
import { fail } from './http.js'
import { readSession } from './session.js'

const GAMES = ['naruto', 'dota', 'aot', 'bleach', 'tg', 'berserk']
const MODES = ['classic', 'image']
export const STAT_KEYS = GAMES.flatMap((g) => MODES.map((m) => `${g}_${m}`))

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
