import type { ObjectId } from 'mongodb'
import { GAME_IDS, type GameId } from '@nanda/game'
import { rounds, users } from '../db'
import { gameData } from '../games'
import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'
import { LEVEL_XP, levelOf, nextRank, rankOf } from '../quests'
import { shiftDay, today } from '../daily'

const RECENT = 8

type Counted = { _id: string; played: number; won: number; guesses: number }

const ZONE = 'Europe/Kyiv'

async function history(userId: ObjectId) {
  const collection = await rounds()
  const finished = { userId, guest: { $ne: true }, status: { $ne: 'active' } }

  const [facet] = await collection
    .aggregate([
      { $match: finished },
      {
        $facet: {
          games: [
            { $match: { status: 'won' } },
            { $group: { _id: { game: '$game', answerId: '$answerId' } } },
            { $group: { _id: '$_id.game', unique: { $sum: 1 } } },
          ],
          modes: [
            {
              $group: {
                _id: '$mode',
                played: { $sum: 1 },
                won: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
                guesses: { $sum: { $ifNull: ['$guessCount', 0] } },
              },
            },
          ],
          days: [
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ZONE } } } },
            { $sort: { _id: -1 } },
          ],
          recent: [
            { $sort: { finishedAt: -1 } },
            { $limit: RECENT },
            { $project: { _id: 0, game: 1, mode: 1, answerId: 1, status: 1, guessCount: 1, daily: 1, challenge: 1, finishedAt: 1 } },
          ],
          totals: [
            {
              $group: {
                _id: null,
                played: { $sum: 1 },
                won: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
                gaveUp: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
                guesses: { $sum: { $ifNull: ['$guessCount', 0] } },
              },
            },
          ],
        },
      },
    ])
    .toArray()

  return facet as {
    games: { _id: string; unique: number }[]
    modes: Counted[]
    days: { _id: string }[]
    recent: { game: string; mode: string; answerId: number; status: string; guessCount?: number; daily?: string; challenge?: string; finishedAt?: Date }[]
    totals: { played: number; won: number; gaveUp: number; guesses: number }[]
  }
}

function streakOf(days: string[]) {
  const seen = new Set(days)
  const now = today()
  const yesterday = shiftDay(now, -1)

  let current = 0
  let cursor = seen.has(now) ? now : yesterday
  while (seen.has(cursor)) {
    current++
    cursor = shiftDay(cursor, -1)
  }

  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of [...days].sort()) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1
    previous = day
    best = Math.max(best, run)
  }

  const monday = shiftDay(now, -((new Date(`${now}T00:00:00Z`).getUTCDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(monday, index)
    return { day, played: seen.has(day) }
  })

  return { current, best, week }
}

async function place(xp: number) {
  if (!xp) return null
  const collection = await users()

  const [board] = await collection
    .aggregate([
      { $project: { xp: { $ifNull: ['$xp', 0] } } },
      { $match: { xp: { $gt: 0 } } },
      { $group: { _id: null, players: { $sum: 1 }, ahead: { $sum: { $cond: [{ $gt: ['$xp', xp] }, 1, 0] } } } },
    ])
    .toArray()

  const position = ((board?.ahead as number) ?? 0) + 1
  return { position, players: Math.max((board?.players as number) ?? 0, position) }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const doc = found.doc
  const past = await history(doc._id!)
  const totals = past.totals[0] ?? { played: 0, won: 0, gaveUp: 0, guesses: 0 }

  const unique = new Map(past.games.map((row) => [row._id, row.unique]))
  const pools = await Promise.all(
    GAME_IDS.map(async (game) => ({ game, pool: (await gameData(game as GameId)).pool.length })),
  )

  const games = pools
    .map(({ game, pool }) => ({ game, pool, solved: unique.get(game) ?? 0 }))
    .filter((row) => row.pool > 0)
    .sort((a, b) => b.solved / b.pool - a.solved / a.pool)

  const modes = past.modes
    .map((row) => ({ mode: row._id, played: row.played, won: row.won, guesses: row.guesses }))
    .sort((a, b) => b.played - a.played)

  const active = streakOf([...past.days.map((row) => row._id), ...(doc.visit?.days ?? [])])
  const streak = { ...active, best: Math.max(active.best, doc.visit?.best ?? 0) }

  const named = await Promise.all(
    past.recent.map(async (round) => {
      const entity = GAME_IDS.includes(round.game as GameId)
        ? (await gameData(round.game as GameId)).byId.get(round.answerId)
        : undefined
      const ru = typeof entity?.name === 'string' ? entity.name : ''
      const uk = typeof entity?.nameUk === 'string' && entity.nameUk ? entity.nameUk : ru
      const en = typeof entity?.nameEn === 'string' && entity.nameEn ? entity.nameEn : ru
      return { ...round, name: ru ? { ru, uk, en } : null }
    }),
  )

  const xp = doc.xp ?? 0
  const level = levelOf(xp)

  return json({
    since: doc.createdAt,
    pinned: (doc.pinned ?? []).filter((award) => doc.awards?.[award]).slice(0, 6),
    awards: Object.keys(doc.awards ?? {}).length,
    level: { xp, level, into: xp % LEVEL_XP, need: LEVEL_XP, rank: rankOf(level).id, next: nextRank(level) },
    totals: {
      solved: totals.won,
      played: totals.played,
      gaveUp: totals.gaveUp,
      guesses: totals.guesses,
      characters: games.reduce((sum, row) => sum + row.solved, 0),
    },
    duels: {
      played: doc.duelStats?.played ?? 0,
      wins: doc.duelStats?.wins ?? 0,
      losses: doc.duelStats?.losses ?? 0,
      draws: doc.duelStats?.draws ?? 0,
    },
    challenges: { solved: doc.challengeStats?.solved ?? 0 },
    favourite: games.find((row) => row.solved > 0)?.game ?? null,
    rank: await place(xp),
    streak,
    games,
    modes,
    recent: named,
  })
})
