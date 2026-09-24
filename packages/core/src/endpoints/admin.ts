import { entities, terms } from '../db'
import { forget, isGame } from '../games'
import { forgetTerms } from '../terms'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'

const missing = () => fail(404, 'not_found')

const INTERNAL = new Set(['_id', 'game', 'updatedAt'])

const NOT_A_TERM = new Set(['id', 'thumb', 'answer', 'hidden', 'name', 'nameEn', 'nameUk', 'aliases', 'slug'])

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
      if (INTERNAL.has(key) || NOT_A_TERM.has(key)) continue
      const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
      if (!values.length) continue
      const seen = (options[key] ??= [])
      for (const v of values) if (!seen.includes(v)) seen.push(v)
    }
  }
  for (const key of Object.keys(options)) options[key].sort((a, b) => a.localeCompare(b, 'ru'))

  const known = await (await terms()).find({}, { projection: { _id: 0 } }).toArray()
  return json({ entities: list, options, terms: known })
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

export const CREATE = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = await readJson(request)
  const { game, name } = body as { game?: unknown; name?: unknown }
  if (!isGame(game) || typeof name !== 'string' || !name.trim()) return fail(400, 'bad_request')

  const collection = await entities()
  const last = await collection.find({ game }, { projection: { id: 1 }, sort: { id: -1 }, limit: 1 }).toArray()
  const id = (last[0]?.id ?? 0) + 1

  const sample = await collection.findOne({ game }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  const blanks: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(sample ?? {})) {
    if (INTERNAL.has(key) || key === 'id' || key === 'thumb') continue
    blanks[key] = Array.isArray(value) ? [] : typeof value === 'number' ? 0 : ''
  }

  const doc = { ...blanks, game, id, thumb: 0, name: name.trim(), answer: false, hidden: true, updatedAt: new Date() }
  await collection.insertOne(doc)

  forget(game)
  const created = await collection.findOne({ game, id }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  return json({ entity: created }, 201)
})

export const PUT = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = await readJson(request)
  const { value, uk, en } = body as { value?: unknown; uk?: unknown; en?: unknown }
  if (typeof value !== 'string' || !value.trim() || typeof uk !== 'string' || typeof en !== 'string') return fail(400, 'bad_request')

  await (await terms()).updateOne({ value }, { $set: { uk: uk.trim(), en: en.trim() } }, { upsert: true })
  forgetTerms()
  return json({ ok: true })
})
