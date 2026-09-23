import { STAT_KEYS, statsKey } from '@nanda/game'
import { dailyBoard } from './_lib/daily-board.js'
import { users } from './_lib/db.js'
import { fail, handle, json } from './_lib/http.js'
import { currentUser, defaultNickname, unauthorized } from './_lib/profile.js'

const LIMIT = 200
const SORTS = {
  best: { field: 'best', natural: -1, tie: { solved: -1 } },
  solved: { field: 'solved', natural: -1, tie: { best: -1 } },
  avg: { field: 'avg', natural: 1, tie: { solved: -1 } },
} as const

type Sort = keyof typeof SORTS
type Row = { _id: unknown; username: string; nickname?: string; solved: number; best: number; avg: number }

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const params = new URL(request.url).searchParams
  if (params.get('daily') === '1') return dailyBoard(found.doc._id!, params)
  const key = statsKey(params.get('game') ?? '', params.get('mode') ?? '')
  const sort = (params.get('sort') ?? 'best') as Sort
  if (!STAT_KEYS.includes(key) || !(sort in SORTS)) return fail(400, 'bad_request')
  const reversed = params.get('dir') === 'rev'
  const spec = SORTS[sort]
  const order = { [spec.field]: reversed ? -spec.natural : spec.natural, ...spec.tie, _id: 1 }

  const path = `$stats.${key}`
  const rows = (await (await users())
    .aggregate([
      { $match: { [`stats.${key}.solved`]: { $gte: 1 } } },
      {
        $project: {
          username: 1,
          nickname: 1,
          solved: `${path}.solved`,
          best: { $ifNull: [`${path}.best`, 0] },
          avg: { $divide: [{ $ifNull: [`${path}.totalGuesses`, 0] }, `${path}.solved`] },
        },
      },
      { $sort: order },
    ])
    .toArray()) as Row[]

  const me = found.doc._id!.toHexString()
  const view = (row: Row, index: number) => ({
    rank: index + 1,
    nickname: row.nickname ?? defaultNickname(row.username),
    solved: row.solved,
    best: row.best,
    avg: Math.round(row.avg * 10) / 10,
    me: String(row._id) === me,
  })
  const all = rows.map(view)
  return json({ sort, reversed, total: all.length, rows: all.slice(0, LIMIT), me: all.find((r) => r.me) ?? null })
})
