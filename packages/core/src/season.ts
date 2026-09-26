import type { ObjectId } from 'mongodb'
import { seasons } from './db'

const ZONE = 'Europe/Kyiv'
const FIRST = { year: 2026, month: 9 }

export type Season = { id: string; number: number; from: Date; to: Date }

const clock = (at: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>

const shift = (at: Date) => {
  const p = clock(at)
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - at.getTime()
}

const monthStart = (year: number, month: number) => {
  const naive = new Date(Date.UTC(year, month - 1, 1))
  return new Date(naive.getTime() - shift(naive))
}

export function seasonAt(now = new Date()): Season {
  const p = clock(now)
  const year = Number(p.year)
  const month = Number(p.month)
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  return {
    id: `${p.year}-${p.month}`,
    number: (year - FIRST.year) * 12 + (month - FIRST.month) + 1,
    from: monthStart(year, month),
    to: monthStart(next.year, next.month),
  }
}

const key = (season: string, userId: ObjectId) => `${season}:${userId.toHexString()}`

export async function addSeasonXp(userId: ObjectId, xp: number, now = new Date()) {
  if (xp <= 0) return
  const season = seasonAt(now)
  await (await seasons()).updateOne(
    { _id: key(season.id, userId) },
    { $inc: { xp }, $setOnInsert: { season: season.id, userId, solved: 0, days: [] } },
    { upsert: true },
  )
}

export async function touchSeasonDay(userId: ObjectId, day: string, now = new Date()) {
  const season = seasonAt(now)
  await (await seasons()).updateOne(
    { _id: key(season.id, userId) },
    { $addToSet: { days: day }, $setOnInsert: { season: season.id, userId, xp: 0, solved: 0 } },
    { upsert: true },
  )
}

export async function markSeasonPlay(userId: ObjectId, won: boolean, day: string, now = new Date()) {
  const season = seasonAt(now)
  await (await seasons()).updateOne(
    { _id: key(season.id, userId) },
    { $inc: { solved: won ? 1 : 0 }, $addToSet: { days: day }, $setOnInsert: { season: season.id, userId, xp: 0 } },
    { upsert: true },
  )
}
