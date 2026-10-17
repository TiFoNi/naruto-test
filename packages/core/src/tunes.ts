import type { ObjectId } from 'mongodb'
import { TUNE_FULL, TUNE_MISS, TUNE_POINTS, TUNE_STEPS, tuneLevel, type TuneLevel } from '@nanda/game'
import { rounds, tuneRuns, users, type TuneDoc } from './db'
import { gameData } from './games'
import { addXp } from './profile'
import { today } from './daily'
import { markSeasonPlay } from './season'

const GAME = 'tunes'
const MODE = 'tune'

const stepsOf = (grade: TuneLevel) => TUNE_STEPS[grade]

const lastStep = (grade: TuneLevel) => stepsOf(grade).length - 1

const openedFor = (grade: TuneLevel, step: number) => stepsOf(grade)[Math.min(step, lastStep(grade))]

const pointsAt = (grade: TuneLevel, step: number) => TUNE_POINTS[grade][Math.min(step, lastStep(grade))]

const clip = (key: string, seconds: number) => `/api/tune/audio?k=${key}&t=${seconds}`

async function pickTitle(seen: number[]) {
  const pool = (await gameData(GAME)).pool
  if (!pool.length) return null
  const window = Math.max(1, Math.floor(pool.length * 0.6))
  const recent = seen.slice(-window)
  const fresh = pool.filter((one) => !recent.includes(one.id))
  const other = pool.filter((one) => one.id !== seen[seen.length - 1])
  const choices = fresh.length ? fresh : other.length ? other : pool
  if (!choices.length) return null
  const title = choices[Math.floor(Math.random() * choices.length)]
  return { id: title.id, key: Math.random().toString(36).slice(2, 10) }
}

async function peaksOf(id: number) {
  const title = (await gameData(GAME)).byId.get(id)
  return Array.isArray(title?.peaks) ? (title.peaks as number[]) : []
}

async function view(doc: TuneDoc) {
  const grade = tuneLevel(doc.grade)
  const over = doc.status === 'over'
  const open = over ? TUNE_FULL : openedFor(grade, doc.step)
  const id = over ? doc.lastId : doc.answerId

  return {
    grade,
    step: doc.step,
    steps: stepsOf(grade),
    open,
    full: TUNE_FULL,
    points: pointsAt(grade, doc.step),
    status: doc.status,
    streak: doc.streak,
    best: doc.best,
    score: doc.score,
    misses: doc.misses,
    lastId: over ? doc.lastId : undefined,
    right: over ? !!doc.won : undefined,
    peaks: id === undefined ? [] : await peaksOf(id),
    clip: doc.key && id !== undefined ? clip(doc.key, open) : undefined,
  }
}

export async function tuneRun(userId: ObjectId, guest: boolean, grade: TuneLevel, fresh = false) {
  const collection = await tuneRuns()
  const found = await collection.findOne({ userId })
  const same = found && tuneLevel(found.grade) === grade
  const known = (await gameData(GAME)).byId
  const alive = (id?: number) => id !== undefined && known.has(id)

  if (!fresh && same && found.status === 'playing' && alive(found.answerId)) return view(found)
  if (!fresh && same && found.status === 'over' && alive(found.lastId)) return view(found)

  const next = await pickTitle(found?.seen ?? [])
  if (!next) return null

  const now = new Date()
  const doc: TuneDoc = {
    userId,
    ...(guest ? { guest: true } : {}),
    won: false,
    answerId: next.id,
    key: next.key,
    grade,
    step: 0,
    misses: 0,
    score: same ? (found?.score ?? 0) : 0,
    streak: same ? (found?.streak ?? 0) : 0,
    best: found?.best ?? 0,
    seen: [...(found?.seen ?? []), next.id].slice(-60),
    status: 'playing',
    createdAt: found?.createdAt ?? now,
    updatedAt: now,
  }
  await collection.updateOne({ userId }, { $set: doc }, { upsert: true })
  return view(doc)
}

const KEY = 'tunes_tune'

const PATH = `stats.${KEY}`

const pointsOf = (doc: { stats?: Record<string, { points?: number }> } | null) => doc?.stats?.[KEY]?.points ?? 0

export async function tunePoints(userId: ObjectId) {
  return pointsOf(await (await users()).findOne({ _id: userId }, { projection: { [`${PATH}.points`]: 1 } }))
}

async function logRound(doc: TuneDoc, answerId: number, status: 'won' | 'lost' | 'skipped') {
  if (doc.guest) return
  await (await rounds()).insertOne({
    userId: doc.userId,
    game: GAME,
    mode: MODE,
    answerId,
    status,
    guesses: [],
    startedAt: doc.updatedAt,
    createdAt: new Date(),
    finishedAt: new Date(),
  })
  await markSeasonPlay(doc.userId, status === 'won', today())
}

export async function tuneAnswer(userId: ObjectId, pick: number) {
  const collection = await tuneRuns()
  const doc = await collection.findOne({ userId })
  if (!doc || doc.status !== 'playing' || doc.answerId === undefined) return null

  const grade = tuneLevel(doc.grade)
  const right = pick === doc.answerId

  if (right) {
    const gained = pointsAt(grade, doc.step)
    const streak = doc.streak + 1
    const score = doc.score + gained
    const best = Math.max(doc.best, score)
    const next: Partial<TuneDoc> = { status: 'over', lastId: doc.answerId, won: true, streak, score, best, updatedAt: new Date() }
    await collection.updateOne({ userId }, { $set: next })
    await logRound(doc, doc.answerId, 'won')
    if (!doc.guest) {
      await (await users()).updateOne(
        { _id: userId },
        {
          $inc: { [`${PATH}.solved`]: 1, [`${PATH}.points`]: gained, [`${PATH}.totalGuesses`]: doc.step + 1 },
          $set: { [`${PATH}.streak`]: streak, [`${PATH}.best`]: best },
          $max: { [`${PATH}.bestStreak`]: streak },
        },
      )
      await addXp(await users(), userId, Math.min(gained, 25), 'endless')
    }
    return { ...(await view({ ...doc, ...next } as TuneDoc)), right: true, answerId: doc.answerId, gained }
  }

  const step = doc.step + 1
  const done = step > lastStep(grade)
  const next: Partial<TuneDoc> = done
    ? { status: 'over', lastId: doc.answerId, won: false, streak: 0, misses: doc.misses + 1, updatedAt: new Date() }
    : { step, misses: doc.misses + 1, updatedAt: new Date() }

  await collection.updateOne({ userId }, { $set: next })
  if (done) {
    await logRound(doc, doc.answerId, 'lost')
    if (!doc.guest) {
      await (await users()).updateOne({ _id: userId }, [
        { $set: { [`${PATH}.points`]: { $max: [0, { $subtract: [{ $ifNull: [`$${PATH}.points`, 0] }, TUNE_MISS] }] }, [`${PATH}.streak`]: 0 } },
      ])
    }
  }

  return { ...(await view({ ...doc, ...next } as TuneDoc)), right: false, answerId: done ? doc.answerId : undefined }
}

export async function tuneGiveUp(userId: ObjectId) {
  const collection = await tuneRuns()
  const doc = await collection.findOne({ userId })
  if (!doc || doc.status !== 'playing' || doc.answerId === undefined) return null

  const next: Partial<TuneDoc> = { status: 'over', lastId: doc.answerId, won: false, streak: 0, updatedAt: new Date() }
  await collection.updateOne({ userId }, { $set: next })
  await logRound(doc, doc.answerId, 'skipped')
  return { ...(await view({ ...doc, ...next } as TuneDoc)), answerId: doc.answerId }
}

export async function tuneClip(userId: ObjectId, key: string, seconds: number) {
  const doc = await (await tuneRuns()).findOne({ userId })
  if (!doc || doc.key !== key) return null

  const grade = tuneLevel(doc.grade)
  const open = doc.status === 'over' ? TUNE_FULL : openedFor(grade, doc.step)
  if (seconds > open) return null

  const id = doc.status === 'over' ? doc.lastId : doc.answerId
  return id === undefined ? null : { id, seconds }
}
