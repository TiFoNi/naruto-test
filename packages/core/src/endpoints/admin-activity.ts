import type { Filter, ObjectId } from 'mongodb'
import { adminSession } from '../admin'
import { rounds, users, type RoundDoc } from '../db'
import { fail, handle, json } from '../http'

const HOUR_MS = 3_600_000
const RANGES: Record<string, number> = { hour: 1, day: 24, week: 24 * 7 }
const TOP = 50
const FAST_GAP_MS = 1500

type Summary = { _id: unknown; total: number; won: number; first: number; peak: number; busy: number; lastAt: Date }

export async function activityRows(hours: number, now = Date.now()) {
  const since = new Date(now - hours * HOUR_MS)
  const collection = await rounds()
  const played: Filter<RoundDoc> = { guest: { $ne: true }, status: { $ne: 'active' }, createdAt: { $gte: since } }

  const summaries = await collection
    .aggregate<Summary>([
      { $match: played },
      {
        $group: {
          _id: { user: '$userId', hour: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } } },
          total: { $sum: 1 },
          won: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          first: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'won'] }, { $eq: ['$guessCount', 1] }] }, 1, 0] } },
          lastAt: { $max: '$createdAt' },
        },
      },
      {
        $group: {
          _id: '$_id.user',
          total: { $sum: '$total' },
          won: { $sum: '$won' },
          first: { $sum: '$first' },
          peak: { $max: '$total' },
          busy: { $sum: { $cond: [{ $gte: ['$total', 60] }, 1, 0] } },
          lastAt: { $max: '$lastAt' },
        },
      },
      { $sort: { peak: -1, total: -1 } },
      { $limit: TOP },
    ])
    .toArray()

  const ids = summaries.map((row) => row._id as ObjectId)
  const people = await (await users()).find({ _id: { $in: ids } }, { projection: { nickname: 1, username: 1, xp: 1, humanAt: 1 } }).toArray()
  const personOf = new Map(people.map((person) => [String(person._id), person]))

  const favorites = await collection
    .aggregate<{ _id: { user: unknown; game: string; mode: string }; n: number }>([
      { $match: { ...played, userId: { $in: ids } } },
      { $group: { _id: { user: '$userId', game: '$game', mode: '$mode' }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray()
  const favoriteOf = new Map<string, { game: string; mode: string; n: number }>()
  for (const row of favorites) {
    const key = String(row._id.user)
    if (!favoriteOf.has(key)) favoriteOf.set(key, { game: row._id.game, mode: row._id.mode, n: row.n })
  }

  const starts = await collection.find({ ...played, userId: { $in: ids } }, { projection: { userId: 1, createdAt: 1 }, sort: { userId: 1, createdAt: 1 } }).toArray()
  const fast = new Map<string, number>()
  starts.forEach((row, at) => {
    const before = starts[at - 1]
    if (before && String(before.userId) === String(row.userId) && row.createdAt.getTime() - before.createdAt.getTime() < FAST_GAP_MS) {
      fast.set(String(row.userId), (fast.get(String(row.userId)) ?? 0) + 1)
    }
  })

  return summaries.map((row) => {
    const id = String(row._id)
    const person = personOf.get(id)
    return {
      id,
      nickname: person?.nickname ?? person?.username ?? id.slice(-6),
      xp: person?.xp ?? 0,
      total: row.total,
      peak: row.peak,
      busy: row.busy,
      won: row.won,
      first: row.first,
      fast: fast.get(id) ?? 0,
      favorite: favoriteOf.get(id) ?? null,
      lastAt: row.lastAt,
      humanAt: person?.humanAt ?? null,
    }
  })
}

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const range = new URL(request.url).searchParams.get('range') ?? 'day'
  const hours = RANGES[range]
  if (!hours) return fail(400, 'bad_request')
  return json({ range, rows: await activityRows(hours) })
})
