import type { ObjectId } from 'mongodb'
import { dailyKey, GAME_IDS, hasMode, MODE_IDS, type GameId, type ModeId } from '@nanda/game'
import { dailyNumber, today } from './daily.js'
import { rounds, users } from './db.js'
import { fail, json } from './http.js'
import { defaultNickname } from './profile.js'

const LIMIT = 200
const SORTS = ['today', 'time', 'streak', 'maxStreak'] as const

type Sort = (typeof SORTS)[number]

type Person = { _id: ObjectId; username: string; nickname?: string; stats?: Record<string, { streak?: number; best?: number }> }

export async function dailyBoard(userId: ObjectId, params: URLSearchParams) {
  const game = params.get('game') as GameId
  const mode = params.get('mode') as ModeId
  const sort = (params.get('sort') ?? 'today') as Sort
  const reversed = params.get('dir') === 'rev'
  if (!GAME_IDS.includes(game) || !MODE_IDS.includes(mode) || !hasMode(game, mode) || !SORTS.includes(sort)) return fail(400, 'bad_request')

  const me = userId.toHexString()
  const day = today()
  const key = dailyKey(game, mode)

  const won = await (await rounds())
    .find({ daily: day, game, mode, status: 'won' }, { projection: { userId: 1, guessCount: 1, guesses: 1, startedAt: 1, createdAt: 1, finishedAt: 1 } })
    .toArray()
  const people = (await (await users())
    .find({ _id: { $in: won.map((r) => r.userId) } }, { projection: { username: 1, nickname: 1, [`stats.${key}`]: 1 } })
    .toArray()) as Person[]
  const byId = new Map(people.map((p) => [p._id.toHexString(), p]))

  const entries = won.map((round) => {
    const person = byId.get(round.userId.toHexString())
    const stats = person?.stats?.[key]
    return {
      nickname: person ? (person.nickname ?? defaultNickname(person.username)) : 'Player',
      guesses: round.guessCount ?? round.guesses?.length ?? 0,
      seconds: Math.max(0, Math.round(((round.finishedAt?.getTime() ?? 0) - (round.startedAt ?? round.createdAt).getTime()) / 1000)),
      streak: stats?.streak ?? 0,
      best: stats?.best ?? 0,
      me: round.userId.toHexString() === me,
    }
  })

  const direction = reversed ? -1 : 1
  const order: Record<Sort, (a: (typeof entries)[number], b: (typeof entries)[number]) => number> = {
    today: (a, b) => (a.guesses - b.guesses) * direction || a.seconds - b.seconds,
    time: (a, b) => (a.seconds - b.seconds) * direction || a.guesses - b.guesses,
    streak: (a, b) => (b.streak - a.streak) * direction || a.guesses - b.guesses,
    maxStreak: (a, b) => (b.best - a.best) * direction || a.guesses - b.guesses,
  }
  entries.sort(order[sort])

  const rows = entries.map((entry, i) => ({ rank: i + 1, ...entry }))
  return json({ sort, day, number: dailyNumber(day), total: rows.length, rows: rows.slice(0, LIMIT), me: rows.find((r) => r.me) ?? null })
}
