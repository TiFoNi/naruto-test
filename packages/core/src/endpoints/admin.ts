import { entities } from '../db'
import { forget, isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'

const missing = () => fail(404, 'not_found')

const INTERNAL = new Set(['_id', 'game', 'updatedAt'])

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const game = new URL(request.url).searchParams.get('game')
  if (!isGame(game)) return fail(400, 'bad_request')

  const list = await (await entities())
    .find({ game }, { projection: { _id: 0, game: 0, updatedAt: 0 }, sort: { id: 1 } })
    .toArray()
  return json({ entities: list })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = await readJson(request)
  const { game, id, fields } = body as { game?: unknown; id?: unknown; fields?: Record<string, unknown> }
  if (!isGame(game) || typeof id !== 'number' || !fields || typeof fields !== 'object') return fail(400, 'bad_request')

  const patch = Object.fromEntries(Object.entries(fields).filter(([key]) => !INTERNAL.has(key) && key !== 'id'))
  if (!Object.keys(patch).length) return fail(400, 'bad_request')

  const collection = await entities()
  const result = await collection.updateOne({ game, id }, { $set: { ...patch, updatedAt: new Date() } })
  if (!result.matchedCount) return missing()

  forget(game)
  const doc = await collection.findOne({ game, id }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  return json({ entity: doc })
})
