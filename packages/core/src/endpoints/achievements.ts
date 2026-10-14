import { STAT_KEYS } from '@nanda/game'
import {
  ACHIEVEMENTS,
  LIFE,
  SEASON,
  claimAward,
  familyOf,
  closeFinishedSeason,
  lifeFacts,
  progressOf,
  rarity,
  seasonFacts,
  syncAwards,
  syncSeasonAwards,
} from '../achievements'
import { seasonAt } from '../season'
import { users, type UserDoc } from '../db'
import type { Facts } from '../achievements'
import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'

export const PINNED_MAX = 8

export async function placeOf(solved: number) {
  const collection = await users()
  const [players, ahead] = await Promise.all([
    collection.countDocuments({ solvedTotal: { $gte: 1 } }),
    solved >= 1 ? collection.countDocuments({ solvedTotal: { $gt: solved } }) : Promise.resolve(0),
  ])

  return { rank: solved >= 1 ? ahead + 1 : null, players }
}

async function board(doc: UserDoc) {
  const id = doc._id!
  await closeFinishedSeason().catch(() => null)

  const facts = await lifeFacts(doc)
  const place = await placeOf(doc.solvedTotal ?? STAT_KEYS.reduce((sum, key) => sum + (doc.stats?.[key]?.solved ?? 0), 0))
  facts.rank = place.rank
  facts.players = place.players

  const { awards, claimed, gained } = await syncAwards(id, facts, doc.awards ?? {}, doc.claimed)
  const running = await seasonFacts(id)
  const season = await syncSeasonAwards(id, running, { awards })
  const { share } = await rarity()

  const shape = (achievement: (typeof ACHIEVEMENTS)[number], holder: Record<string, Date>, taken: Record<string, Date>, source: Facts) => {
    const done = !!holder[achievement.id]
    return {
      id: achievement.id,
      family: familyOf(achievement.id),
      category: achievement.category,
      tier: achievement.tier,
      kind: achievement.kind,
      target: achievement.target,
      xp: achievement.xp,
      secret: achievement.secret ?? false,
      awarded: achievement.awarded ?? false,
      unit: achievement.unit ?? null,
      done,
      claimed: !!taken[achievement.id],
      at: holder[achievement.id] ?? null,
      progress: done ? achievement.target : achievement.awarded ? 0 : Math.min(progressOf(achievement.id, source), achievement.target),
      rarity: share[achievement.id] ?? 0,
    }
  }

  const list = [
    ...LIFE.map((achievement) => shape(achievement, awards, claimed, facts)),
    ...SEASON.map((achievement) => shape(achievement, season.awards, season.claimed, running)),
  ]

  const lifetime = list.filter((a) => a.kind !== 'season')
  const total = lifetime.reduce((sum, a) => sum + (a.claimed ? a.xp : 0), 0)
  const left = lifetime.reduce((sum, a) => sum + (a.claimed ? 0 : a.xp), 0)
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
    season: { id: seasonAt().id, number: seasonAt().number, endsAt: seasonAt().to.getTime() },
    gained: [...gained, ...season.gained],
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
  const known = new Set(LIFE.map((a) => a.id))
  const topOfFamily = (id: string) =>
    LIFE.filter((a) => familyOf(a.id) === familyOf(id) && owned[a.id])
      .sort((one, two) => one.xp - two.xp || one.target - two.target)
      .pop()?.id
  const pinned = [...new Set(body.pinned.filter((id): id is string => typeof id === 'string'))]
    .filter((id) => known.has(id) && owned[id] && topOfFamily(id) === id)
    .slice(0, PINNED_MAX)

  await (await users()).updateOne({ _id: found.doc._id! }, { $set: { pinned } })
  return json({ pinned })
})
