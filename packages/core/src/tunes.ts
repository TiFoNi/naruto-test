import type { ObjectId } from 'mongodb'
import { DAILY_XP_FACTOR, MODE_XP, TUNE_FULL, TUNE_MISS, TUNE_POINTS, TUNE_STEPS, dailyKey, tuneLevel, type TuneLevel } from '@nanda/game'
import { rounds, tuneDays, tuneRuns, users, type TuneDayDoc, type TuneDoc } from './db'
import { gameData } from './games'
import { addXp, applyDailyResult } from './profile'
import { dailyAnswer, nextReset, today } from './daily'
import { markSeasonPlay } from './season'

const GAME = 'tunes'
const MODE = 'tune' as const

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

  if (!fresh && found && found.status === 'playing' && alive(found.answerId)) return view(found)
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
    score: found?.score ?? 0,
    streak: found?.streak ?? 0,
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

async function logRound(doc: { userId: ObjectId; guest?: boolean; updatedAt: Date }, answerId: number, status: 'won' | 'lost' | 'skipped', day?: string) {
  if (doc.guest) return
  await (await rounds()).insertOne({
    userId: doc.userId,
    game: GAME,
    mode: MODE,
    ...(day ? { daily: day } : {}),
    answerId,
    status,
    guesses: [],
    startedAt: doc.updatedAt,
    createdAt: new Date(),
    finishedAt: new Date(),
  })
  await markSeasonPlay(doc.userId, status === 'won', today())
}

const stillThere = async (id?: number) => id !== undefined && (await gameData(GAME)).byId.has(id)

export async function tuneAnswer(userId: ObjectId, pick: number, guest = false) {
  const collection = await tuneRuns()
  const doc = await collection.findOne({ userId })
  if (!doc || doc.status !== 'playing' || doc.answerId === undefined) return null
  if (!(await stillThere(doc.answerId))) return tuneRun(userId, guest, tuneLevel(doc.grade), true)

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
      await addXp(await users(), userId, MODE_XP.tune, 'endless', MODE)
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

export async function tuneSkip(userId: ObjectId, guest = false) {
  const collection = await tuneRuns()
  const doc = await collection.findOne({ userId })
  if (!doc || doc.status !== 'playing' || doc.answerId === undefined) return null
  if (!(await stillThere(doc.answerId))) return tuneRun(userId, guest, tuneLevel(doc.grade), true)

  const grade = tuneLevel(doc.grade)
  const step = doc.step + 1
  if (step > lastStep(grade)) return tuneGiveUp(userId, guest)

  const next: Partial<TuneDoc> = { step, misses: doc.misses + 1, updatedAt: new Date() }
  await collection.updateOne({ userId }, { $set: next })
  return view({ ...doc, ...next } as TuneDoc)
}

export async function tuneGiveUp(userId: ObjectId, guest = false) {
  const collection = await tuneRuns()
  const doc = await collection.findOne({ userId })
  if (!doc || doc.status !== 'playing' || doc.answerId === undefined) return null
  if (!(await stillThere(doc.answerId))) return tuneRun(userId, guest, tuneLevel(doc.grade), true)

  const next: Partial<TuneDoc> = { status: 'over', lastId: doc.answerId, won: false, streak: 0, updatedAt: new Date() }
  await collection.updateOne({ userId }, { $set: next })
  await logRound(doc, doc.answerId, 'skipped')
  return { ...(await view({ ...doc, ...next } as TuneDoc)), answerId: doc.answerId }
}

export async function tuneClip(userId: ObjectId, key: string, seconds: number) {
  const day = await (await tuneDays()).findOne({ userId, key })
  if (day) {
    const open = day.status === 'over' ? TUNE_FULL : openedFor(DAILY_GRADE, day.step)
    return seconds > open ? null : { id: day.answerId, seconds }
  }

  const doc = await (await tuneRuns()).findOne({ userId })
  if (!doc || doc.key !== key) return null

  const grade = tuneLevel(doc.grade)
  const open = doc.status === 'over' ? TUNE_FULL : openedFor(grade, doc.step)
  if (seconds > open) return null

  const id = doc.status === 'over' ? doc.lastId : doc.answerId
  return id === undefined ? null : { id, seconds }
}

const DAILY_GRADE: TuneLevel = 'normal'

const DAILY_POINTS = MODE_XP.tune * DAILY_XP_FACTOR

async function dailyView(doc: TuneDayDoc) {
  const over = doc.status === 'over'
  const open = over ? TUNE_FULL : openedFor(DAILY_GRADE, doc.step)
  return {
    grade: DAILY_GRADE,
    step: doc.step,
    steps: stepsOf(DAILY_GRADE),
    open,
    full: TUNE_FULL,
    points: DAILY_POINTS,
    status: doc.status,
    streak: 0,
    best: 0,
    score: 0,
    misses: doc.step,
    daily: doc.day,
    nextAt: nextReset(),
    lastId: over ? doc.answerId : undefined,
    right: over ? !!doc.won : undefined,
    gained: over ? (doc.gained ?? 0) : undefined,
    guesses: over ? (doc.won ? doc.step + 1 : stepsOf(DAILY_GRADE).length) : undefined,
    peaks: await peaksOf(doc.answerId),
    clip: clip(doc.key, open),
  }
}

export async function dailyTune(userId: ObjectId, guest: boolean) {
  const collection = await tuneDays()
  const day = today()
  const found = await collection.findOne({ userId, day })
  if (found && (await stillThere(found.answerId))) return dailyView(found)

  const { answerId } = await dailyAnswer(GAME, MODE, day)
  if (!(await stillThere(answerId))) return null
  const now = new Date()
  const doc: TuneDayDoc = {
    userId,
    day,
    ...(guest ? { guest: true } : {}),
    answerId,
    key: `d${day.replace(/-/g, '')}`,
    step: 0,
    status: 'playing',
    createdAt: now,
    updatedAt: now,
  }
  await collection.updateOne({ userId, day }, { $setOnInsert: doc }, { upsert: true })
  return dailyView((await collection.findOne({ userId, day })) ?? doc)
}

async function dailyPlaying(userId: ObjectId) {
  const doc = await (await tuneDays()).findOne({ userId, day: today() })
  return doc && doc.status === 'playing' ? doc : null
}

async function endDaily(doc: TuneDayDoc, won: boolean) {
  const gained = won && !doc.guest ? DAILY_POINTS : 0
  const over: TuneDayDoc = { ...doc, status: 'over', won, gained }
  await (await tuneDays()).updateOne({ _id: doc._id }, { $set: { status: 'over', won, gained, updatedAt: new Date() } })
  await logRound(doc, doc.answerId, won ? 'won' : 'lost', doc.day)
  if (doc.guest) return { ...(await dailyView(over)), xp: null }
  const collection = await users()
  const xp = won ? await addXp(collection, doc.userId, gained, 'daily', MODE, MODE_XP.tune) : null
  const key = dailyKey(GAME, MODE)
  const stats = await applyDailyResult(collection, doc.userId, key, doc.day, won ? doc.step + 1 : stepsOf(DAILY_GRADE).length)
  return { ...(await dailyView(over)), ...(xp ? { xp } : {}), stats: { key, value: stats } }
}

export async function dailyTuneAnswer(userId: ObjectId, pick: number) {
  const doc = await dailyPlaying(userId)
  if (!doc) return null
  if (pick === doc.answerId) return endDaily(doc, true)
  if (doc.step >= lastStep(DAILY_GRADE)) return endDaily(doc, false)
  const step = doc.step + 1
  await (await tuneDays()).updateOne({ _id: doc._id }, { $set: { step, updatedAt: new Date() } })
  return dailyView({ ...doc, step })
}

export async function dailyTuneSkip(userId: ObjectId) {
  const doc = await dailyPlaying(userId)
  if (!doc) return null
  if (doc.step >= lastStep(DAILY_GRADE)) return endDaily(doc, false)
  const step = doc.step + 1
  await (await tuneDays()).updateOne({ _id: doc._id }, { $set: { step, updatedAt: new Date() } })
  return dailyView({ ...doc, step })
}

export async function dailyTuneGiveUp(userId: ObjectId) {
  const doc = await dailyPlaying(userId)
  return doc ? endDaily(doc, false) : null
}
