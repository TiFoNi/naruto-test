import { STAT_KEYS } from '@nanda/game'
import { ACHIEVEMENTS, collectFacts, progressOf, rarity, syncAwards } from '../achievements'
import { users } from '../db'
import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'

async function placeOf(userId: string) {
  const collection = await users()
  const rows = await collection
    .aggregate<{ _id: unknown; solved: number }>([
      { $project: { solved: { $sum: STAT_KEYS.map((key) => ({ $ifNull: [`$stats.${key}.solved`, 0] })) } } },
      { $match: { solved: { $gte: 1 } } },
      { $sort: { solved: -1, _id: 1 } },
    ])
    .toArray()

  const index = rows.findIndex((row) => String(row._id) === userId)
  return { rank: index < 0 ? null : index + 1, players: rows.length }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const id = found.doc._id!
  const facts = await collectFacts(id)
  const place = await placeOf(id.toHexString())
  facts.rank = place.rank
  facts.players = place.players

  const { awards, gained, xp } = await syncAwards(id, facts, found.doc.awards ?? {})
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
      at: awards[achievement.id] ?? null,
      progress: Math.min(progressOf(achievement.id, facts), achievement.target),
      rarity: share[achievement.id] ?? 0,
    }
  })

  const total = list.reduce((sum, a) => sum + (a.done ? a.xp : 0), 0)
  const left = list.reduce((sum, a) => sum + (a.done ? 0 : a.xp), 0)
  const rarest = list.filter((a) => a.done).sort((a, b) => a.rarity - b.rarity)[0] ?? null

  return json({
    achievements: list,
    earned: list.filter((a) => a.done).length,
    xp: total,
    xpLeft: left,
    rarest: rarest ? { id: rarest.id, rarity: rarest.rarity } : null,
    players: place.players,
    rank: place.rank,
    gained,
    gainedXp: xp,
  })
})
