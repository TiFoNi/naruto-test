import type { UpdateFilter } from 'mongodb'
import { entities, type EntityDoc } from '../db'
import { forget } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { deleteFrame, uploadFrames, uploadShotCard } from '../images'
import { frameNames } from '../shots'

const GAME = 'shots'
const LEVELS = 4
const LIMIT = 12 * 1024 * 1024
const MAX_FILES = 12

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

const missing = () => fail(404, 'not_found')

const coverOf = (names: string[][]) => {
  for (let level = LEVELS - 1; level >= 0; level--) if (names[level]?.length) return { level, name: names[level]![0]! }
  return null
}

async function withNames(id: number) {
  const collection = await entities()
  const found = await collection.findOne({ game: GAME, id })
  if (!found) return null
  if (!Array.isArray(found.frameNames)) {
    await collection.updateOne({ game: GAME, id, frameNames: { $exists: false } }, { $set: { frameNames: frameNames(found) } })
  }
  return found
}

const recount = () => [
  { $set: { frames: { $map: { input: '$frameNames', as: 'names', in: { $size: '$$names' } } } } },
  {
    $set: {
      answer: { $allElementsTrue: [{ $map: { input: '$frames', as: 'count', in: { $gt: ['$$count', 0] } } }] },
      ver: { $literal: Date.now().toString(36) },
      updatedAt: '$$NOW',
    },
  },
]

async function settle(id: number) {
  const collection = await entities()
  await collection.updateOne({ game: GAME, id }, recount())
  const doc = await collection.findOne({ game: GAME, id }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  const cover = doc ? coverOf(frameNames(doc)) : null
  if (cover) await uploadShotCard(id, cover.level, cover.name)
  forget(GAME)
  return json({ title: doc })
}

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const list = await (await entities())
    .find({ game: GAME }, { projection: { _id: 0, id: 1, name: 1, nameEn: 1, year: 1, frames: 1, frameNames: 1, ver: 1, answer: 1 }, sort: { id: 1 } })
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

  if (!(await withNames(id))) return missing()

  const buffers = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())))
  const names = await uploadFrames(id, level, buffers)
  await (await entities()).updateOne({ game: GAME, id }, { $push: { [`frameNames.${level}`]: { $each: names } } } as UpdateFilter<EntityDoc>)

  return settle(id)
})

export const DROP = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = (await readJson(request)) as { id?: unknown; level?: unknown; name?: unknown }
  const id = Number(body.id)
  const level = Number(body.level)
  const name = typeof body.name === 'string' ? body.name : ''
  if (!Number.isInteger(id) || !Number.isInteger(level) || level < 0 || level >= LEVELS || !/^[\w-]{1,32}$/.test(name)) return fail(400, 'bad_request')

  if (!(await withNames(id))) return missing()

  const pulled = await (await entities()).updateOne({ game: GAME, id }, { $pull: { [`frameNames.${level}`]: name } } as UpdateFilter<EntityDoc>)
  if (pulled.modifiedCount) await deleteFrame(id, level, name)

  return settle(id)
})
