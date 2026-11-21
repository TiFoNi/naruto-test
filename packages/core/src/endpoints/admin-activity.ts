import { ObjectId, type Filter } from 'mongodb'
import { adminSession } from '../admin'
import { rounds, users, type RoundDoc, type UserDoc } from '../db'
import { fail, handle, json, readJson } from '../http'
import { defaultNickname, parseTag } from '../profile'

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
  const people = await (await users())
    .find({ _id: { $in: ids } }, { projection: { nickname: 1, username: 1, xp: 1, humanAt: 1, cheats: 1, ptrScore: 1, ptrN: 1, suspect: 1 } })
    .toArray()
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
      cheats: person?.cheats ?? {},
      pointer: pointerOf(person),
      suspect: !!person?.suspect,
    }
  })
}

const FLAGGED = 50
const SHOWN_LOG = 6

const pointerOf = (person?: { ptrScore?: number; ptrN?: number } | null) => (person?.ptrN ? { score: Math.round((person.ptrScore ?? 0) * 100), n: person.ptrN } : null)

export async function flaggedRows() {
  const found = await (await users())
    .find(
      { cheatAt: { $exists: true } },
      { projection: { nickname: 1, username: 1, cheats: 1, cheatLog: 1, cheatAt: 1, ptrScore: 1, ptrN: 1, suspect: 1, humanAt: 1, rankBan: 1 }, sort: { cheatAt: -1 }, limit: FLAGGED },
    )
    .toArray()
  return found.map((person) => ({
    id: String(person._id),
    nickname: person.nickname ?? person.username ?? String(person._id).slice(-6),
    cheats: person.cheats ?? {},
    log: (person.cheatLog ?? []).slice(-SHOWN_LOG).reverse(),
    lastAt: person.cheatAt ?? null,
    pointer: pointerOf(person),
    suspect: !!person.suspect,
    humanAt: person.humanAt ?? null,
    rankBan: person.rankBan ?? null,
  }))
}

const FOUND = 12

type Person = { _id?: ObjectId; nickname?: string; username: string; tag?: string; rankBan?: Date; cheats?: Record<string, number> }

const personRow = (person: Person) => ({
  id: String(person._id),
  nickname: person.nickname ?? defaultNickname(person.username),
  tag: person.tag ?? null,
  rankBan: person.rankBan ?? null,
  cheats: person.cheats ?? {},
})

const PERSON = { nickname: 1, username: 1, tag: 1, rankBan: 1, cheats: 1 }

export async function bannedRows() {
  const found = await (await users()).find({ rankBan: { $exists: true } }, { projection: PERSON, sort: { rankBan: -1 } }).toArray()
  return found.map(personRow)
}

export async function findPeople(raw: string) {
  const [namePart, tagPart] = raw.trim().slice(0, 40).split('#')
  const name = namePart!.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!name && !ObjectId.isValid(raw)) return []
  const tag = tagPart === undefined ? null : parseTag(tagPart)
  const filter: Filter<UserDoc> = ObjectId.isValid(raw) ? { _id: new ObjectId(raw) } : { nicknameLower: { $regex: `^${name}` }, ...(tag ? { tag } : {}) }
  const found = await (await users()).find(filter, { projection: PERSON, sort: { nicknameLower: 1 }, limit: FOUND }).toArray()
  return found.map(personRow)
}

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const ask = new URL(request.url).searchParams.get('q')
  if (ask !== null) return json({ people: await findPeople(ask) })
  const range = new URL(request.url).searchParams.get('range') ?? 'day'
  const hours = RANGES[range]
  if (!hours) return fail(400, 'bad_request')
  const [rows, flagged, banned] = await Promise.all([activityRows(hours), flaggedRows(), bannedRows()])
  return json({ range, rows, flagged, banned })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const { id, ban } = (await readJson(request)) as { id?: unknown; ban?: unknown }
  if (typeof id !== 'string' || !ObjectId.isValid(id) || typeof ban !== 'boolean') return fail(400, 'bad_request')
  const done = await (await users()).findOneAndUpdate(
    { _id: new ObjectId(id) },
    ban ? { $set: { rankBan: new Date() } } : { $unset: { rankBan: '' } },
    { projection: PERSON, returnDocument: 'after' },
  )
  if (!done) return fail(404, 'not_found')
  return json({ person: personRow(done), banned: await bannedRows() })
})
