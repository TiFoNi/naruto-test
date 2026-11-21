import type { ObjectId } from 'mongodb'
import { rounds, users } from './db'
import { fail } from './http'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
const HOURLY_ROUNDS = 200
const HOURLY_GUESS_ROUNDS = 80
const GUESS_MODES = ['classic', 'blind']
const MARATHON_WINDOW_HOURS = 8
const MARATHON_BUSY_HOURS = 6
const MARATHON_HOUR_ROUNDS = 90
const NONSTOP_HOURS = 2
const BREAK_MS = 15 * MINUTE_MS
const CLEAR_FOR_MS = 60_000
const TRUST_MS = HOUR_MS
const ASK_EVERY_MS = 10 * MINUTE_MS
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const clearUntil = new Map<string, number>()

const secret = () => process.env.TURNSTILE_SECRET_KEY ?? ''

const nonstop = (times: Date[]) => {
  let start = times[0]?.getTime() ?? 0
  for (let i = 1; i < times.length; i++) {
    if (times[i - 1]!.getTime() - times[i]!.getTime() > BREAK_MS) break
    start = times[i]!.getTime()
  }
  return times.length ? (times[0]!.getTime() - start) / HOUR_MS : 0
}

async function looksAutomated(userId: ObjectId, now: number) {
  const person = await (await users()).findOne({ _id: userId }, { projection: { humanAt: 1 } })
  if (person?.humanAt && now - person.humanAt.getTime() < TRUST_MS) return false
  const since = new Date(Math.max(now - MARATHON_WINDOW_HOURS * HOUR_MS, person?.humanAt?.getTime() ?? 0))
  const lastHour = new Date(now - HOUR_MS)
  const played = await (await rounds())
    .find({ userId, guest: { $ne: true }, status: { $ne: 'active' }, createdAt: { $gte: since } }, { projection: { createdAt: 1, mode: 1 } })
    .sort({ createdAt: -1 })
    .toArray()
  const recent = played.filter((one) => one.createdAt >= lastHour)
  if (recent.length >= HOURLY_ROUNDS) return true
  if (recent.filter((one) => GUESS_MODES.includes(one.mode)).length >= HOURLY_GUESS_ROUNDS) return true
  const fresh = now - (played[0]?.createdAt.getTime() ?? 0) <= BREAK_MS
  if (fresh && nonstop(played.map((one) => one.createdAt)) >= NONSTOP_HOURS) return true
  const hours = new Map<string, number>()
  for (const one of played) {
    const key = one.createdAt.toISOString().slice(0, 13)
    hours.set(key, (hours.get(key) ?? 0) + 1)
  }
  return [...hours.values()].filter((n) => n >= MARATHON_HOUR_ROUNDS).length >= MARATHON_BUSY_HOURS
}

export async function humanCheck(owner: { id: ObjectId; guest: boolean }) {
  if (owner.guest || !secret()) return null
  const key = owner.id.toHexString()
  const now = Date.now()
  if ((clearUntil.get(key) ?? 0) > now) return null
  const person = await (await users()).findOne({ _id: owner.id }, { projection: { suspect: 1, suspectAskedAt: 1 } })
  if (person?.suspect) {
    clearUntil.set(key, now + CLEAR_FOR_MS)
    if (now - (person.suspectAskedAt?.getTime() ?? 0) < ASK_EVERY_MS) return null
    await (await users()).updateOne({ _id: owner.id }, { $set: { suspectAskedAt: new Date(now) } })
    return fail(428, 'human_check')
  }
  if (await looksAutomated(owner.id, now)) {
    await (await users()).updateOne({ _id: owner.id }, { $set: { suspect: true, suspectAskedAt: new Date(now) } })
    clearUntil.set(key, now + CLEAR_FOR_MS)
    return fail(428, 'human_check')
  }
  clearUntil.set(key, now + CLEAR_FOR_MS)
  return null
}

export const isSuspect = async (userId: ObjectId) => !!(await (await users()).findOne({ _id: userId, suspect: true }, { projection: { _id: 1 } }))

export async function verifyHuman(userId: ObjectId, token: string) {
  if (!secret()) return true
  const response = await fetch(VERIFY_URL, { method: 'POST', body: new URLSearchParams({ secret: secret(), response: token }) })
  const { success } = (await response.json()) as { success?: boolean }
  if (!success) return false
  await (await users()).updateOne({ _id: userId }, { $set: { humanAt: new Date() }, $unset: { suspect: '', suspectAskedAt: '' } })
  clearUntil.set(userId.toHexString(), Date.now() + CLEAR_FOR_MS)
  return true
}
