import { ObjectId } from 'mongodb'
import { GAME_IDS, STAT_KEYS, type GameId } from '@nanda/game'
import { ACHIEVEMENTS } from '../achievements'
import { rounds, seasons, users, type UserDoc } from '../db'
import { gameData } from '../games'
import { fail, handle, json } from '../http'
import { currentUser, defaultNickname, unauthorized } from '../profile'
import { LEVEL_XP, levelOf, nextRank, rankOf } from '../quests'
import { shiftDay, today } from '../daily'
import { seasonAt } from '../season'

const RECENT = 8

const TIERS = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement.tier]))
const SECRETS = new Set(ACHIEVEMENTS.filter((achievement) => achievement.secret).map((achievement) => achievement.id))

type Counted = { _id: string; played: number; won: number; guesses: number }

const ZONE = 'Europe/Kyiv'

async function history(userId: ObjectId) {
  const collection = await rounds()
  const finished = { userId, guest: { $ne: true }, status: { $ne: 'active' } }
  const counted = { $match: { challenge: { $exists: false } } }

  const [facet] = await collection
    .aggregate([
      { $match: finished },
      {
        $facet: {
          games: [
            counted,
            { $match: { status: 'won' } },
            { $group: { _id: { game: '$game', answerId: '$answerId' } } },
            { $group: { _id: '$_id.game', unique: { $sum: 1 } } },
          ],
          modes: [
            counted,
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
            counted,
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ZONE } } } },
            { $sort: { _id: -1 } },
          ],
          recent: [
            { $sort: { finishedAt: -1 } },
            { $limit: RECENT },
            { $project: { _id: 0, game: 1, mode: 1, answerId: 1, status: 1, guessCount: 1, daily: 1, challenge: 1, finishedAt: 1 } },
          ],
          totals: [
            counted,
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

async function place(userId: ObjectId) {
  const collection = await seasons()
  const season = seasonAt()
  const mine = await collection.findOne({ season: season.id, userId })
  if (!mine?.xp) return null

  const ahead = {
    $or: [{ $gt: ['$xp', mine.xp] }, { $and: [{ $eq: ['$xp', mine.xp] }, { $lt: ['$_id', mine._id] }] }],
  }
  const [row] = await collection
    .aggregate([
      { $match: { season: season.id, xp: { $gte: 1 } } },
      { $group: { _id: null, players: { $sum: 1 }, ahead: { $sum: { $cond: [ahead, 1, 0] } } } },
    ])
    .toArray()

  const position = ((row?.ahead as number) ?? 0) + 1
  return { position, players: Math.max((row?.players as number) ?? 0, position) }
}

async function gamePlaces(doc: UserDoc) {
  const mine = Object.entries(doc.stats ?? {}).filter(([key, value]) => STAT_KEYS.includes(key) && (value?.solved ?? 0) > 0)
  if (!mine.length) return []

  const counters: Record<string, unknown> = {}
  for (const [index, [key, value]] of mine.entries()) {
    const best = value.best ?? 0
    const solved = value.solved ?? 0
    const theirBest = { $ifNull: [`$stats.${key}.best`, 0] }
    const theirSolved = { $ifNull: [`$stats.${key}.solved`, 0] }
    counters[`k${index}`] = {
      $sum: {
        $cond: [
          {
            $and: [
              { $gte: [theirSolved, 1] },
              {
                $or: [
                  { $gt: [theirBest, best] },
                  { $and: [{ $eq: [theirBest, best] }, { $gt: [theirSolved, solved] }] },
                  { $and: [{ $eq: [theirBest, best] }, { $eq: [theirSolved, solved] }, { $lt: ['$_id', doc._id] }] },
                ],
              },
            ],
          },
          1,
          0,
        ],
      },
    }
  }

  const [row] = await (await users()).aggregate([{ $group: { _id: null, ...counters } }]).toArray()
  if (!row) return []

  return mine
    .map(([key], index) => {
      const [game, mode] = key.split('_')
      const position = ((row[`k${index}`] as number) ?? 0) + 1
      return { game, mode, position }
    })
    .sort((a, b) => a.position - b.position)
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const wanted = new URL(request.url).searchParams.get('id')
  const other = wanted && ObjectId.isValid(wanted) && wanted !== found.doc._id!.toHexString()
  const doc = other ? await (await users()).findOne({ _id: new ObjectId(wanted) }) : found.doc
  if (!doc) return fail(404, 'not_found')
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
    id: doc._id!.toHexString(),
    nickname: doc.nickname ?? defaultNickname(doc.username),
    tag: doc.tag ?? null,
    since: doc.createdAt,
    pinned: (doc.pinned ?? [])
      .filter((award) => doc.claimed?.[award] && TIERS.has(award))
      .slice(0, 6)
      .map((id) => {
        const veiled = other && SECRETS.has(id) && !found.doc.awards?.[id]
        return { id: veiled ? null : id, tier: TIERS.get(id)!, at: veiled ? null : doc.awards![id], hidden: veiled }
      }),
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
    rank: await place(doc._id!),
    gamePlaces: await gamePlaces(doc),
    streak,
    games,
    modes,
    recent: named,
  })
})
