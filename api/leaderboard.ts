import { STAT_KEYS, statsKey } from '../src/games/specs.js'
import { users } from './_lib/db.js'
import { fail, handle, json } from './_lib/http.js'
import { currentUser, defaultNickname, unauthorized } from './_lib/profile.js'

const LIMIT = 50
const MIN_FOR_AVG = 5
const SORTS = {
  best: { best: -1, solved: -1 },
  solved: { solved: -1, best: -1 },
  avg: { avg: 1, solved: -1 },
} as const

type Sort = keyof typeof SORTS
type Row = { _id: unknown; username: string; nickname?: string; solved: number; best: number; avg: number }

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const params = new URL(request.url).searchParams
  const key = statsKey(params.get('game') ?? '', params.get('mode') ?? '')
  const sort = (params.get('sort') ?? 'best') as Sort
  if (!STAT_KEYS.includes(key) || !(sort in SORTS)) return fail(400, 'bad_request')

  const path = `$stats.${key}`
  const minSolved = sort === 'avg' ? MIN_FOR_AVG : 1
  const rows = (await (await users())
    .aggregate([
      { $match: { [`stats.${key}.solved`]: { $gte: minSolved } } },
      {
        $project: {
          username: 1,
          nickname: 1,
          solved: `${path}.solved`,
          best: { $ifNull: [`${path}.best`, 0] },
          avg: { $divide: [{ $ifNull: [`${path}.totalGuesses`, 0] }, `${path}.solved`] },
        },
      },
      { $sort: { ...SORTS[sort], _id: 1 } },
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
  return json({ sort, minForAvg: MIN_FOR_AVG, total: all.length, rows: all.slice(0, LIMIT), me: all.find((r) => r.me) ?? null })
})
