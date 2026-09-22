import type { ObjectId } from 'mongodb'
import { dailyKey, GAME_IDS, hasMode, MODE_IDS, type GameId, type ModeId } from '../../src/games/specs.js'
import { dailyNumber, shiftDay, today } from './daily.js'
import { rounds, users } from './db.js'
import { fail, json } from './http.js'
import { defaultNickname } from './profile.js'

const LIMIT = 50

type Person = { _id: ObjectId; username: string; nickname?: string }

export async function dailyBoard(userId: ObjectId, params: URLSearchParams) {
  const game = params.get('game') as GameId
  const mode = params.get('mode') as ModeId
  const sort = params.get('sort') ?? 'today'
  if (!GAME_IDS.includes(game) || !MODE_IDS.includes(mode) || !hasMode(game, mode) || !['today', 'streak'].includes(sort)) return fail(400, 'bad_request')

  const me = userId.toHexString()
  const day = today()
  const name = (p: Person) => p.nickname ?? defaultNickname(p.username)

  if (sort === 'today') {
    const won = await (await rounds())
      .find({ daily: day, game, mode, status: 'won' }, { projection: { userId: 1, guessCount: 1, createdAt: 1, finishedAt: 1 } })
      .sort({ guessCount: 1, finishedAt: 1 })
      .toArray()
    const people = await (await users())
      .find({ _id: { $in: won.map((r) => r.userId) } }, { projection: { username: 1, nickname: 1 } })
      .toArray()
    const byId = new Map(people.map((p) => [p._id!.toHexString(), p as Person]))
    const rows = won.map((r, i) => ({
      rank: i + 1,
      nickname: name(byId.get(r.userId.toHexString()) ?? { _id: r.userId, username: 'Player' }),
      guesses: r.guessCount ?? 0,
      seconds: Math.max(0, Math.round(((r.finishedAt?.getTime() ?? 0) - r.createdAt.getTime()) / 1000)),
      me: r.userId.toHexString() === me,
    }))
    return json({ sort, day, number: dailyNumber(day), total: rows.length, rows: rows.slice(0, LIMIT), me: rows.find((r) => r.me) ?? null })
  }

  const key = dailyKey(game, mode)
  const people = (await (await users())
    .find(
      { [`stats.${key}.lastDay`]: { $in: [day, shiftDay(day, -1)] }, [`stats.${key}.streak`]: { $gte: 1 } },
      { projection: { username: 1, nickname: 1, [`stats.${key}`]: 1 } },
    )
    .sort({ [`stats.${key}.streak`]: -1, [`stats.${key}.best`]: -1, _id: 1 })
    .toArray()) as (Person & { stats: Record<string, { streak: number; best: number; solved: number }> })[]
  const rows = people.map((p, i) => ({
    rank: i + 1,
    nickname: name(p),
    streak: p.stats[key].streak,
    best: p.stats[key].best,
    solved: p.stats[key].solved,
    me: p._id.toHexString() === me,
  }))
  return json({ sort, day, number: dailyNumber(day), total: rows.length, rows: rows.slice(0, LIMIT), me: rows.find((r) => r.me) ?? null })
}
