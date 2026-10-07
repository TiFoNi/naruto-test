import { STAT_KEYS } from '@nanda/game'
import { LIFE, SEASON, lifeFacts, seasonFacts, syncAwards, syncSeasonAwards } from '../achievements'
import { seasons, users, type UserDoc } from '../db'
import { seasonAt } from '../season'
import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'
import { placeOf } from './achievements'
import { duelInvites } from '../duels'
import { friendRequests } from '../friends'

const FRESH_MS = 600_000

async function ready(doc: UserDoc) {
  const id = doc._id!
  const solved =
    (doc.solvedTotal ?? STAT_KEYS.reduce((sum, key) => sum + (doc.stats?.[key]?.solved ?? 0), 0)) + (doc.duelStats?.played ?? 0)
  let awards = doc.awards ?? {}
  let claimed = doc.claimed ?? {}

  const stale = doc.awardsSolved !== solved || !doc.awardsAt || Date.now() - doc.awardsAt.getTime() > FRESH_MS
  const key = `${seasonAt().id}:${id.toHexString()}`
  const running = await (await seasons()).findOne({ _id: key })
  let seasonAwards = running?.awards ?? {}
  let seasonClaimed = running?.claimed ?? {}

  if (stale) {
    const facts = await lifeFacts(doc)
    const place = await placeOf(solved)
    facts.rank = place.rank
    facts.players = place.players

    const synced = await syncAwards(id, facts, awards, doc.claimed)
    awards = synced.awards
    claimed = synced.claimed
    const fresh = await syncSeasonAwards(id, await seasonFacts(id), { awards })
    seasonAwards = fresh.awards
    seasonClaimed = fresh.claimed
    await (await users()).updateOne({ _id: id }, { $set: { awardsSolved: solved, awardsAt: new Date() } })
  }

  const own = LIFE.filter((achievement) => awards[achievement.id] && !claimed[achievement.id])
  const run = SEASON.filter((achievement) => seasonAwards[achievement.id] && !seasonClaimed[achievement.id])
  return [...run, ...own].map(({ id: award, tier }) => ({ id: award, tier }))
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const [awards, invites, requests] = await Promise.all([
    ready(found.doc),
    duelInvites(found.doc._id!),
    friendRequests(found.doc._id!),
  ])
  const owned = found.doc.frames ?? []
  if (!found.doc.framesSeen) {
    await (await users()).updateOne({ _id: found.doc._id }, { $set: { framesSeen: owned } })
    return json({ awards, invites, requests, frames: [] })
  }
  const frames = owned.filter((frame) => !found.doc.framesSeen!.includes(frame))
  return json({ awards, invites, requests, frames })
})
