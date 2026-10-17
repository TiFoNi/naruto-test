import { entities } from '../db'
import { forget } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { dropFrame, uploadFrames, uploadShotCard } from '../images'

const GAME = 'shots'
const LEVELS = 4
const LIMIT = 12 * 1024 * 1024
const MAX_FILES = 12

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

const missing = () => fail(404, 'not_found')

const countsOf = (doc: Record<string, unknown>) => {
  const kept = Array.isArray(doc.frames) ? (doc.frames as number[]) : []
  return Array.from({ length: LEVELS }, (_, level) => Number(kept[level]) || 0)
}

const coverLevel = (counts: number[]) => {
  for (let level = LEVELS - 1; level >= 0; level--) if (counts[level]) return level
  return -1
}

async function apply(id: number, counts: number[]) {
  const cover = coverLevel(counts)
  if (cover >= 0) await uploadShotCard(id, cover)

  const patch = {
    frames: counts,
    answer: counts.every((count) => count > 0),
    ver: Date.now().toString(36),
    updatedAt: new Date(),
  }
  await (await entities()).updateOne({ game: GAME, id }, { $set: patch })
  forget(GAME)

  const doc = await (await entities()).findOne({ game: GAME, id }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  return json({ title: doc })
}

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const list = await (await entities())
    .find({ game: GAME }, { projection: { _id: 0, id: 1, name: 1, nameEn: 1, year: 1, frames: 1, ver: 1, answer: 1 }, sort: { id: 1 } })
    .toArray()

  return json({ titles: list, pics: process.env.PICS_URL?.replace(/\/+$/, '') ?? '' })
})

export const UPLOAD = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'bad_request')

  const id = Number(form.get('id'))
  const level = Number(form.get('level'))
  if (!Number.isInteger(id) || !Number.isInteger(level) || level < 0 || level >= LEVELS) return fail(400, 'bad_request')

  const files = form.getAll('file').filter((entry) => typeof entry !== 'string') as unknown as Upload[]
  if (!files.length || files.some((file) => !file.size)) return fail(400, 'no_file')
  if (files.length > MAX_FILES) return fail(400, 'too_many')
  if (files.some((file) => file.size > LIMIT)) return fail(413, 'too_large')

  const found = await (await entities()).findOne({ game: GAME, id })
  if (!found) return missing()

  const counts = countsOf(found)
  const buffers = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())))
  const added = await uploadFrames(id, level, buffers, counts[level])
  counts[level] += added

  return apply(id, counts)
})

export const DROP = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = (await readJson(request)) as { id?: unknown; level?: unknown; index?: unknown }
  const id = Number(body.id)
  const level = Number(body.level)
  const index = Number(body.index)
  if (!Number.isInteger(id) || !Number.isInteger(level) || level < 0 || level >= LEVELS) return fail(400, 'bad_request')

  const found = await (await entities()).findOne({ game: GAME, id })
  if (!found) return missing()

  const counts = countsOf(found)
  if (!Number.isInteger(index) || index < 0 || index >= counts[level]) return fail(400, 'bad_request')

  await dropFrame(id, level, index, counts[level])
  counts[level] -= 1

  return apply(id, counts)
})
