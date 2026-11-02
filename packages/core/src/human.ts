import type { ObjectId } from 'mongodb'
import { rounds, users } from './db'
import { fail } from './http'

const HOUR_MS = 3_600_000
const HOURLY_ROUNDS = 200
const MARATHON_WINDOW_HOURS = 8
const MARATHON_BUSY_HOURS = 6
const MARATHON_HOUR_ROUNDS = 60
const CLEAR_FOR_MS = 60_000
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const clearUntil = new Map<string, number>()

const secret = () => process.env.TURNSTILE_SECRET_KEY ?? ''

async function looksAutomated(userId: ObjectId, now: number) {
  const person = await (await users()).findOne({ _id: userId }, { projection: { humanAt: 1 } })
  const since = new Date(Math.max(now - MARATHON_WINDOW_HOURS * HOUR_MS, person?.humanAt?.getTime() ?? 0))
  const lastHour = new Date(now - HOUR_MS)
  const hours = await (await rounds())
    .aggregate<{ total: number; recent: number }>([
      { $match: { userId, guest: { $ne: true }, status: { $ne: 'active' }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
          total: { $sum: 1 },
          recent: { $sum: { $cond: [{ $gte: ['$createdAt', lastHour] }, 1, 0] } },
        },
      },
    ])
    .toArray()
  const recent = hours.reduce((sum, hour) => sum + hour.recent, 0)
  const busy = hours.filter((hour) => hour.total >= MARATHON_HOUR_ROUNDS).length
  return recent >= HOURLY_ROUNDS || busy >= MARATHON_BUSY_HOURS
}

export async function humanCheck(owner: { id: ObjectId; guest: boolean }) {
  if (owner.guest || !secret()) return null
  const key = owner.id.toHexString()
  const now = Date.now()
  if ((clearUntil.get(key) ?? 0) > now) return null
  if (await looksAutomated(owner.id, now)) return fail(428, 'human_check')
  clearUntil.set(key, now + CLEAR_FOR_MS)
  return null
}

export async function verifyHuman(userId: ObjectId, token: string) {
  if (!secret()) return true
  const response = await fetch(VERIFY_URL, { method: 'POST', body: new URLSearchParams({ secret: secret(), response: token }) })
  const { success } = (await response.json()) as { success?: boolean }
  if (!success) return false
  await (await users()).updateOne({ _id: userId }, { $set: { humanAt: new Date() } })
  clearUntil.set(userId.toHexString(), Date.now() + CLEAR_FOR_MS)
  return true
}
