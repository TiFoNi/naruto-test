import { POLL } from '@nanda/game'
import type { ObjectId } from 'mongodb'
import { pollVotes } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'

const LIVE_MS = 15_000

let tally: { at: number; counts: Record<string, number>; voters: number } | null = null

async function counts(fresh = false) {
  if (!fresh && tally && Date.now() - tally.at < LIVE_MS) return tally
  const collection = await pollVotes()
  const live = POLL.groups.map((group) => group.id)
  const [voters, rows] = await Promise.all([
    collection.countDocuments({ poll: POLL.id, $or: live.map((group) => ({ [`picks.${group}.0`]: { $exists: true } })) }),
    collection
      .aggregate<{ _id: string; n: number }>([
        { $match: { poll: POLL.id } },
        { $project: { picks: { $objectToArray: '$picks' } } },
        { $unwind: '$picks' },
        { $match: { 'picks.k': { $in: live } } },
        { $unwind: '$picks.v' },
        { $group: { _id: '$picks.v', n: { $sum: 1 } } },
      ])
      .toArray(),
  ])
  tally = { at: Date.now(), counts: Object.fromEntries(rows.map((row) => [row._id, row.n])), voters }
  return tally
}

async function mine(userId: ObjectId) {
  const doc = await (await pollVotes()).findOne({ poll: POLL.id, userId }, { projection: { picks: 1 } })
  return doc?.picks ?? {}
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  const [{ counts: votes, voters }, picks] = await Promise.all([counts(), found ? mine(found.doc._id!) : null])
  return json({ poll: POLL.id, counts: votes, voters, mine: picks })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  const group = POLL.groups.find((one) => one.id === body.group)
  if (!group || !Array.isArray(body.picks)) return fail(400, 'bad_request')
  const known = new Set(group.options.map((one) => one.id))
  const picks = [...new Set(body.picks.filter((one: unknown): one is string => typeof one === 'string' && known.has(one)))]
  if (picks.length > group.max) return fail(400, 'bad_request')
  const userId = found.doc._id!
  const collection = await pollVotes()
  const save = () =>
    collection.updateOne(
      { poll: POLL.id, userId },
      { $set: { [`picks.${group.id}`]: picks, updatedAt: new Date() }, $setOnInsert: { poll: POLL.id, userId } },
      { upsert: true },
    )
  await save().catch((error: { code?: number }) => {
    if (error?.code !== 11000) throw error
    return save()
  })
  const [{ counts: votes, voters }, own] = await Promise.all([counts(true), mine(userId)])
  return json({ poll: POLL.id, counts: votes, voters, mine: own })
})
