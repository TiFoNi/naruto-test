import { GAME_SPECS } from '@nanda/game'
import { entities } from '../db'
import { forget, isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { forgetCrops } from '../crop'

const missing = () => fail(404, 'not_found')

const spot = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(Math.max(value, 0), 1) * 1e4) / 1e4 : null)

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const game = new URL(request.url).searchParams.get('game')
  if (!isGame(game)) return fail(400, 'bad_request')
  const spec = GAME_SPECS[game]
  if (!spec?.modes?.includes('image')) return fail(400, 'bad_request')

  const list = await (await entities())
    .find({ game, hidden: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, nameEn: 1, image: 1, focus: 1 }, sort: { id: 1 } })
    .toArray()

  return json({
    list,
    folder: spec.images ?? game,
    pics: process.env.PICS_URL?.replace(/\/+$/, '') ?? '',
  })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const { game, id, focus } = (await readJson(request)) as { game?: unknown; id?: unknown; focus?: unknown }
  if (!isGame(game) || typeof id !== 'number' || !Number.isInteger(id)) return fail(400, 'bad_request')

  const point = focus && typeof focus === 'object' ? { x: spot((focus as Record<string, unknown>).x), y: spot((focus as Record<string, unknown>).y) } : null
  if (point && (point.x === null || point.y === null)) return fail(400, 'bad_request')

  const collection = await entities()
  const saved = await collection.updateOne(
    { game, id },
    point ? { $set: { focus: point, updatedAt: new Date() } } : { $unset: { focus: '' }, $set: { updatedAt: new Date() } },
  )
  if (!saved.matchedCount) return missing()

  forget(game)
  forgetCrops()
  return json({ id, focus: point })
})
