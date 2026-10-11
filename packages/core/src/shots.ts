import type { ObjectId } from 'mongodb'
import { SHOT_MISS, SHOT_POINTS } from '@nanda/game'
import { shotRuns, users, type ShotDoc } from './db'
import { gameData } from './games'
import { addXp } from './profile'

const GAME = 'shots'
const LEVELS = SHOT_POINTS.length

const pointsAt = (level: number) => SHOT_POINTS[Math.min(level, LEVELS - 1)]

const picture = (seen: number, level: number, variant: number) => `/api/shot/image?n=${seen}&l=${level}&v=${variant}`

const opened = (seen: number, level: number, variant: number[] = []) =>
  Array.from({ length: Math.min(level, LEVELS - 1) + 1 }, (_, step) => picture(seen, step, variant[step] ?? 0))

const nextVariant = (count: number, last?: number) => {
  if (count <= 1) return 0
  const pick = Math.floor(Math.random() * (last === undefined ? count : count - 1))
  return last === undefined || pick < last ? pick : pick + 1
}

async function pickTitle(seen: number[], last?: number[]) {
  const pool = (await gameData(GAME)).pool
  if (!pool.length) return null
  const fresh = pool.filter((one) => !seen.includes(one.id))
  const choices = fresh.length ? fresh : pool
  const title = choices[Math.floor(Math.random() * choices.length)]
  const counts = Array.isArray(title.frames) ? (title.frames as number[]) : []
  const same = title.id === seen[seen.length - 1] ? last : undefined
  const variant = Array.from({ length: LEVELS }, (_, level) => nextVariant(Math.max(1, counts[level] ?? 1), same?.[level]))
  return { id: title.id, variant }
}

const view = (doc: ShotDoc) => ({
  streak: doc.streak,
  best: doc.best,
  score: doc.score,
  status: doc.status,
  level: doc.level,
  misses: doc.misses,
  points: pointsAt(doc.level),
  levels: LEVELS,
  lastId: doc.status === 'over' ? doc.lastId : undefined,
  shots: doc.status === 'playing' && doc.answerId !== undefined ? opened(doc.seen.length, doc.level, doc.variant) : undefined,
})

export async function shotRun(userId: ObjectId, guest: boolean, fresh = false) {
  const collection = await shotRuns()
  const found = await collection.findOne({ userId })
  if (!fresh && found?.status === 'playing' && found.answerId !== undefined) return view(found)
  if (!fresh && found?.status === 'over') return view(found)

  const next = await pickTitle(found?.seen?.slice(-1) ?? [], found?.variant)
  if (!next) return null

  const now = new Date()
  const doc: ShotDoc = {
    userId,
    ...(guest ? { guest: true } : {}),
    answerId: next.id,
    variant: next.variant,
    level: 0,
    misses: 0,
    score: 0,
    streak: 0,
    best: found?.best ?? 0,
    seen: [next.id],
    status: 'playing',
    createdAt: found?.createdAt ?? now,
    updatedAt: now,
  }
  await collection.updateOne({ userId }, { $set: doc }, { upsert: true })
  return view(doc)
}

async function endRun(doc: ShotDoc, revealed: number) {
  const best = Math.max(doc.best, doc.score)
  await (await shotRuns()).updateOne(
    { _id: doc._id },
    { $set: { status: 'over', best, lastId: revealed, level: LEVELS - 1, updatedAt: new Date() }, $unset: { answerId: '' } },
  )
  if (doc.score > 0 && !doc.guest) await addXp(await users(), doc.userId, Math.min(doc.score, 25), 'endless')
  return { over: true as const, answerId: revealed, score: doc.score, streak: doc.streak, best, fresh: doc.score > 0 && doc.score >= best }
}

async function nextTitle(doc: ShotDoc, score: number, streak: number) {
  const next = await pickTitle(doc.seen, doc.variant)
  if (!next) return null
  const seen = [...doc.seen, next.id].slice(-60)
  await (await shotRuns()).updateOne(
    { _id: doc._id },
    { $set: { answerId: next.id, variant: next.variant, level: 0, misses: 0, score, streak, seen, updatedAt: new Date() }, $unset: { lastId: '' } },
  )
  return { score, streak, level: 0, points: pointsAt(0), shots: opened(seen.length, 0, next.variant) }
}

async function harder(doc: ShotDoc, score: number) {
  const level = doc.level + 1
  await (await shotRuns()).updateOne({ _id: doc._id }, { $set: { level, score, updatedAt: new Date() } })
  return { score, level, points: pointsAt(level), shots: opened(doc.seen.length, level, doc.variant) }
}

async function playing(userId: ObjectId) {
  const found = await (await shotRuns()).findOne({ userId })
  return found && found.status === 'playing' && found.answerId !== undefined ? found : null
}

export async function shotAnswer(userId: ObjectId, pick: number) {
  const doc = await playing(userId)
  if (!doc) return null

  if (pick === doc.answerId) {
    const gained = pointsAt(doc.level)
    const next = await nextTitle(doc, doc.score + gained, doc.streak + 1)
    return next ? { right: true as const, answerId: doc.answerId, gained, best: doc.best, ...next } : null
  }

  const score = Math.max(0, doc.score - SHOT_MISS)
  await (await shotRuns()).updateOne({ _id: doc._id }, { $inc: { misses: 1 } })
  if (doc.level + 1 >= LEVELS) return { right: false as const, ...(await endRun({ ...doc, score }, doc.answerId!)) }
  return { right: false as const, gained: -SHOT_MISS, streak: doc.streak, best: doc.best, ...(await harder(doc, score)) }
}

export async function shotSkip(userId: ObjectId) {
  const doc = await playing(userId)
  if (!doc) return null
  if (doc.level + 1 >= LEVELS) return { skipped: true as const, ...(await endRun(doc, doc.answerId!)) }
  return { skipped: true as const, streak: doc.streak, best: doc.best, ...(await harder(doc, doc.score)) }
}

export async function shotGiveUp(userId: ObjectId) {
  const doc = await playing(userId)
  return doc ? { gaveUp: true as const, ...(await endRun(doc, doc.answerId!)) } : null
}

export async function shotShown(userId: ObjectId, want?: number) {
  const doc = await playing(userId)
  if (!doc) return null
  const open = Math.min(doc.level, LEVELS - 1)
  const level = Number.isInteger(want) && want! >= 0 && want! <= open ? want! : open
  const title = (await gameData(GAME)).byId.get(doc.answerId!)
  return { answerId: doc.answerId!, level, variant: doc.variant?.[level] ?? 0, ver: typeof title?.ver === 'string' ? title.ver : '' }
}

export async function shotBoard(limit = 20) {
  return (await shotRuns()).find({ best: { $gt: 0 }, guest: { $ne: true } }, { sort: { best: -1 }, limit }).toArray()
}
