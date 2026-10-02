import type { ObjectId } from 'mongodb'
import { seasonCloses, seasons } from './db'

const ZONE = 'Europe/Kyiv'
const FIRST = { year: 2026, month: 9, day: 28 }
const WEEK = 7

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

type Day = { year: number; month: number; day: number }

const pad = (value: number) => String(value).padStart(2, '0')

const noon = (day: Day) => Date.UTC(day.year, day.month - 1, day.day, 12)

const dayOf = (at: number): Day => {
  const stamp = new Date(at)
  return { year: stamp.getUTCFullYear(), month: stamp.getUTCMonth() + 1, day: stamp.getUTCDate() }
}

const plusDays = (day: Day, count: number) => dayOf(noon(day) + count * 86_400_000)

const dayStart = (day: Day) => {
  const naive = new Date(Date.UTC(day.year, day.month - 1, day.day))
  return new Date(naive.getTime() - shift(naive))
}

const mondayOf = (day: Day) => plusDays(day, -((new Date(noon(day)).getUTCDay() + 6) % 7))

export function seasonAt(now = new Date()): Season {
  const p = clock(now)
  const monday = mondayOf({ year: Number(p.year), month: Number(p.month), day: Number(p.day) })
  const first = mondayOf(FIRST)
  const weeks = Math.round((noon(monday) - noon(first)) / (WEEK * 86_400_000))

  return {
    id: `${monday.year}-${pad(monday.month)}-${pad(monday.day)}`,
    number: weeks + 1,
    from: dayStart(monday),
    to: dayStart(plusDays(monday, WEEK)),
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

export async function markSeasonDuel(userId: ObjectId, won: boolean, now = new Date()) {
  if (!won) return
  const season = seasonAt(now)
  await (await seasons()).updateOne(
    { _id: key(season.id, userId) },
    { $inc: { duelWins: 1 }, $setOnInsert: { season: season.id, userId, xp: 0, solved: 0, days: [] } },
    { upsert: true },
  )
}

export const previousSeason = (now = new Date()): Season => seasonAt(new Date(seasonAt(now).from.getTime() - 86_400_000))

export async function seasonStanding(seasonId: string, limit = 100) {
  return (await seasons())
    .find({ season: seasonId, xp: { $gt: 0 } }, { projection: { userId: 1, xp: 1 }, sort: { xp: -1 }, limit })
    .toArray()
}

export async function takeSeasonClose(season: Season) {
  const collection = await seasonCloses()
  const already = await collection.findOne({ _id: season.id })
  if (already) return null
  const started = await collection
    .updateOne({ _id: season.id }, { $setOnInsert: { season: season.id, closedAt: new Date(), players: 0 } }, { upsert: true })
    .catch(() => null)
  return started?.upsertedCount ? season : null
}

export async function markSeasonPlay(userId: ObjectId, won: boolean, day: string, now = new Date()) {
  const season = seasonAt(now)
  await (await seasons()).updateOne(
    { _id: key(season.id, userId) },
    { $inc: { solved: won ? 1 : 0 }, $addToSet: { days: day }, $setOnInsert: { season: season.id, userId, xp: 0 } },
    { upsert: true },
  )
}
