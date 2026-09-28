import { STAT_KEYS } from '@nanda/game'
import { LIFE, SEASON, collectFacts, seasonFacts, syncAwards, syncSeasonAwards } from '../achievements'
import { seasons, users, type UserDoc } from '../db'
import { seasonAt } from '../season'
import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'
import { placeOf } from './achievements'
import { duelInvites } from '../duels'

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
    const facts = await collectFacts(id, 1, doc.resetAt)
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

  const [awards, invites] = await Promise.all([ready(found.doc), duelInvites(found.doc._id!)])
  return json({ awards, invites })
})
