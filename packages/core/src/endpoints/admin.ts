import { entities, settings } from '../db'
import { forget, isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'

const missing = () => fail(404, 'not_found')

const INTERNAL = new Set(['_id', 'game', 'updatedAt'])

const SKIP_FIELDS = new Set(['id', 'thumb', 'answer', 'hidden', 'name', 'nameEn', 'nameUk', 'aliases', 'slug'])

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const game = new URL(request.url).searchParams.get('game')
  if (!isGame(game)) return fail(400, 'bad_request')

  const list = await (await entities())
    .find({ game }, { projection: { _id: 0, game: 0, updatedAt: 0 }, sort: { id: 1 } })
    .toArray()

  const options: Record<string, string[]> = {}
  for (const row of list) {
    for (const [key, value] of Object.entries(row)) {
      if (INTERNAL.has(key) || SKIP_FIELDS.has(key)) continue
      const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
      if (!values.length) continue
      const seen = (options[key] ??= [])
      for (const v of values) if (!seen.includes(v)) seen.push(v)
    }
  }
  for (const key of Object.keys(options)) options[key].sort((a, b) => a.localeCompare(b, 'ru'))

  const config = await (await settings()).findOne({ game }, { projection: { _id: 0, game: 0 } })
  return json({ entities: list, options, updated: config?.updated ?? '' })
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

export const SETTINGS = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = await readJson(request)
  const { game, updated } = body as { game?: unknown; updated?: unknown }
  if (!isGame(game) || typeof updated !== 'string') return fail(400, 'bad_request')
  if (updated && !/^\d{4}-\d{2}-\d{2}$/.test(updated)) return fail(400, 'bad_request')

  await (await settings()).updateOne({ game }, { $set: { updated } }, { upsert: true })
  forget(game)
  return json({ updated })
})
