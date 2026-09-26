import { seasons } from '../db'
import { handle, json } from '../http'
import { currentUser, defaultNickname, unauthorized } from '../profile'
import { levelOf } from '../quests'
import { seasonAt } from '../season'

const LIMIT = 200
const TOP = 100

type Entry = { userId: unknown; xp: number; solved: number; days: number; nickname?: string; username: string; total: number }

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const season = seasonAt()
  const entries = (await (await seasons())
    .aggregate([
      { $match: { season: season.id, xp: { $gte: 1 } } },
      { $sort: { xp: -1, _id: 1 } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'player' } },
      { $unwind: '$player' },
      {
        $project: {
          userId: 1,
          xp: 1,
          solved: { $ifNull: ['$solved', 0] },
          days: { $size: { $ifNull: ['$days', []] } },
          nickname: '$player.nickname',
          username: '$player.username',
          total: { $ifNull: ['$player.xp', 0] },
        },
      },
    ])
    .toArray()) as Entry[]

  const mine = found.doc._id!.toHexString()
  const view = (entry: Entry, index: number) => ({
    rank: index + 1,
    nickname: entry.nickname ?? defaultNickname(entry.username),
    level: levelOf(entry.total),
    xp: entry.xp,
    solved: entry.solved,
    days: entry.days,
    me: String(entry.userId) === mine,
  })

  const all = entries.map(view)
  const me = all.find((row) => row.me) ?? null
  const cutoff = all[TOP - 1]?.xp ?? 0

  return json({
    season: { number: season.number, from: season.from, to: season.to },
    total: all.length,
    rows: all.slice(0, LIMIT),
    me,
    toTop: me && me.rank > TOP ? Math.max(1, cutoff - me.xp) : 0,
  })
})
