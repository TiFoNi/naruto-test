import { STAT_KEYS, statsKey } from '@nanda/game'
import { users } from '../db'
import { fail, handle, json } from '../http'
import { currentUser, defaultNickname, unauthorized } from '../profile'
import { levelOf } from '../quests'

const LIMIT = 200
const SORTS = {
  best: { field: 'best', natural: -1, tie: { solved: -1 } },
  solved: { field: 'solved', natural: -1, tie: { best: -1 } },
} as const

type Sort = keyof typeof SORTS
type Row = { _id: unknown; username: string; nickname?: string; xp?: number; solved: number; best: number; avg: number }

type Page = { top: Row[]; size: { value: number }[]; ahead?: { value: number }[] }

type Order = Record<string, number>

const before = (order: Order, mine: Row) => ({
  $or: Object.entries(order).map(([field], index) => {
    const clause: Record<string, unknown> = {}
    for (const [earlier] of Object.entries(order).slice(0, index)) clause[earlier] = mine[earlier as keyof Row]
    const [, direction] = Object.entries(order)[index]
    clause[field] = direction < 0 ? { $gt: mine[field as keyof Row] } : { $lt: mine[field as keyof Row] }
    return clause
  }),
})

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const params = new URL(request.url).searchParams
  const key = statsKey(params.get('game') ?? '', params.get('mode') ?? '')
  const sort = (params.get('sort') ?? 'best') as Sort
  if (!STAT_KEYS.includes(key) || !(sort in SORTS)) return fail(400, 'bad_request')
  const reversed = params.get('dir') === 'rev'
  const spec = SORTS[sort]
  const order = { [spec.field]: reversed ? -spec.natural : spec.natural, ...spec.tie, _id: 1 }

  const stats = found.doc.stats?.[key]
  const mine: Row | null = stats?.solved
    ? {
        _id: found.doc._id!,
        username: found.doc.username,
        nickname: found.doc.nickname,
        xp: found.doc.xp,
        solved: stats.solved,
        best: stats.best ?? 0,
        avg: (stats.totalGuesses ?? 0) / stats.solved,
      }
    : null

  const path = `$stats.${key}`
  const [page] = (await (await users())
    .aggregate([
      { $match: { [`stats.${key}.solved`]: { $gte: 1 } } },
      {
        $project: {
          username: 1,
          nickname: 1,
          xp: 1,
          solved: `${path}.solved`,
          best: { $ifNull: [`${path}.best`, 0] },
          avg: { $divide: [{ $ifNull: [`${path}.totalGuesses`, 0] }, `${path}.solved`] },
        },
      },
      {
        $facet: {
          top: [{ $sort: order }, { $limit: LIMIT }],
          size: [{ $count: 'value' }],
          ...(mine ? { ahead: [{ $match: before(order, mine) }, { $count: 'value' }] } : {}),
        },
      },
    ])
    .toArray()) as Page[]

  const me = found.doc._id!.toHexString()
  const view = (row: Row, index: number) => ({
    rank: index + 1,
    nickname: row.nickname ?? defaultNickname(row.username),
    level: levelOf(row.xp ?? 0),
    solved: row.solved,
    best: row.best,
    avg: Math.round(row.avg * 10) / 10,
    me: String(row._id) === me,
  })

  const rows = page.top.map(view)
  const rank = (page.ahead?.[0]?.value ?? 0) + 1

  return json({
    sort,
    reversed,
    total: page.size[0]?.value ?? 0,
    rows,
    me: mine ? (rows.find((row) => row.me) ?? view(mine, rank - 1)) : null,
  })
})
