import { STAT_KEYS } from '@nanda/game'
import { ACHIEVEMENTS, collectFacts, syncAwards } from '../achievements'
import { users, type UserDoc } from '../db'
import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'
import { placeOf } from './achievements'

async function ready(doc: UserDoc) {
  const id = doc._id!
  const solved = doc.solvedTotal ?? STAT_KEYS.reduce((sum, key) => sum + (doc.stats?.[key]?.solved ?? 0), 0)
  let awards = doc.awards ?? {}
  let claimed = doc.claimed ?? {}

  if (doc.awardsSolved !== solved) {
    const facts = await collectFacts(id, 1, doc.resetAt)
    const place = await placeOf(solved)
    facts.rank = place.rank
    facts.players = place.players

    const synced = await syncAwards(id, facts, awards, doc.claimed)
    awards = synced.awards
    claimed = synced.claimed
    await (await users()).updateOne({ _id: id }, { $set: { awardsSolved: solved } })
  }

  return ACHIEVEMENTS.filter((achievement) => awards[achievement.id] && !claimed[achievement.id]).map(({ id: award, tier }) => ({ id: award, tier }))
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  return json({ awards: await ready(found.doc) })
})
