import { STAT_KEYS } from '@nanda/game'
import { ACHIEVEMENTS, claimAward, collectFacts, progressOf, rarity, syncAwards } from '../achievements'
import { users, type UserDoc } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'

export const PINNED_MAX = 6

async function placeOf(solved: number) {
  const collection = await users()
  const [players, ahead] = await Promise.all([
    collection.countDocuments({ solvedTotal: { $gte: 1 } }),
    solved >= 1 ? collection.countDocuments({ solvedTotal: { $gt: solved } }) : Promise.resolve(0),
  ])

  return { rank: solved >= 1 ? ahead + 1 : null, players }
}

async function board(doc: UserDoc) {
  const id = doc._id!
  const facts = await collectFacts(id, 1, doc.resetAt)
  const place = await placeOf(doc.solvedTotal ?? STAT_KEYS.reduce((sum, key) => sum + (doc.stats?.[key]?.solved ?? 0), 0))
  facts.rank = place.rank
  facts.players = place.players

  const { awards, claimed, gained } = await syncAwards(id, facts, doc.awards ?? {}, doc.claimed)
  const { share } = await rarity()

  const list = ACHIEVEMENTS.map((achievement) => {
    const done = !!awards[achievement.id]
    return {
      id: achievement.id,
      category: achievement.category,
      tier: achievement.tier,
      target: achievement.target,
      xp: achievement.xp,
      secret: achievement.secret ?? false,
      done,
      claimed: !!claimed[achievement.id],
      at: awards[achievement.id] ?? null,
      progress: Math.min(progressOf(achievement.id, facts), achievement.target),
      rarity: share[achievement.id] ?? 0,
    }
  })

  const total = list.reduce((sum, a) => sum + (a.claimed ? a.xp : 0), 0)
  const left = list.reduce((sum, a) => sum + (a.claimed ? 0 : a.xp), 0)
  const ready = list.filter((a) => a.done && !a.claimed)
  const rarest = list.filter((a) => a.done).sort((a, b) => a.rarity - b.rarity)[0] ?? null

  return {
    achievements: list,
    earned: list.filter((a) => a.done).length,
    xp: total,
    xpLeft: left,
    ready: ready.length,
    xpReady: ready.reduce((sum, a) => sum + a.xp, 0),
    rarest: rarest ? { id: rarest.id, rarity: rarest.rarity } : null,
    players: place.players,
    rank: place.rank,
    gained,
    pinned: (doc.pinned ?? []).filter((award) => claimed[award]).slice(0, PINNED_MAX),
  }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  return json(await board(found.doc))
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const body = (await readJson(request)) as { pinned?: unknown; claim?: unknown }

  if (typeof body.claim === 'string') {
    const award = await claimAward(found.doc._id!, body.claim)
    if (award === null) return fail(409, 'not_ready')
    const fresh = await (await users()).findOne({ _id: found.doc._id! })
    return json({ ...(await board(fresh ?? found.doc)), award })
  }

  if (!Array.isArray(body.pinned)) return fail(400, 'bad_request')

  const owned = found.doc.claimed ?? {}
  const known = new Set(ACHIEVEMENTS.map((a) => a.id))
  const pinned = [...new Set(body.pinned.filter((id): id is string => typeof id === 'string'))]
    .filter((id) => known.has(id) && owned[id])
    .slice(0, PINNED_MAX)

  await (await users()).updateOne({ _id: found.doc._id! }, { $set: { pinned } })
  return json({ pinned })
})
