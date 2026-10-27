import type { ObjectId } from 'mongodb'
import { MODE_XP, statsKey, type GameId } from '@nanda/game'
import { rounds, streaks, users, type StreakDoc } from './db'
import { addXp } from './profile'
import { pairRound, type PairSide } from './pairs'
import { markSeasonPlay } from './season'
import { today } from './daily'

const SIDES: PairSide[] = ['left', 'right', 'both', 'none']

export const isSide = (value: unknown): value is PairSide => typeof value === 'string' && SIDES.includes(value as PairSide)

const view = (doc: StreakDoc) => ({
  streak: doc.streak,
  best: doc.best,
  status: doc.status,
  question:
    doc.status === 'playing' && doc.ask?.parts?.length && doc.left !== undefined && doc.right !== undefined
      ? { left: doc.left, right: doc.right, ask: doc.ask }
      : undefined,
})

const tag = (ask?: { parts: { key: string; value: string }[] }) => (ask?.parts ?? []).map((part) => `${part.key}:${part.value}`).join('|')

const same = (one: StreakDoc, next: { left: number; right: number; ask: { parts: { key: string; value: string }[] } }) =>
  tag(one.ask) === tag(next.ask) ||
  (one.left !== undefined && one.right !== undefined && [one.left, one.right].includes(next.left) && [one.left, one.right].includes(next.right))

async function ask(game: GameId, level: number, last?: StreakDoc) {
  let spare = null
  for (let tries = 0; tries < 8; tries++) {
    const round = await pairRound(game, level, Math.random)
    if (!round) continue
    if (!last || !same(last, round)) return round
    spare ??= round
  }
  return spare
}

export async function pairRun(userId: ObjectId, game: GameId, guest: boolean, fresh = false) {
  const collection = await streaks()
  const found = await collection.findOne({ userId, game })
  if (!fresh && found?.status === 'playing' && found.ask?.parts?.length && found.answer) return view(found)

  const next = await ask(game, 0, found ?? undefined)
  if (!next) return null

  const now = new Date()
  const doc: StreakDoc = {
    userId,
    game,
    streak: 0,
    best: found?.best ?? 0,
    ...(guest ? { guest: true } : {}),
    left: next.left,
    right: next.right,
    ask: next.ask,
    answer: next.answer,
    status: 'playing',
    createdAt: found?.createdAt ?? now,
    updatedAt: now,
  }
  await collection.updateOne({ userId, game }, { $set: doc }, { upsert: true })
  return view(doc)
}

async function logPair(doc: StreakDoc, won: boolean) {
  if (doc.guest || doc.left === undefined || doc.right === undefined) return
  const now = new Date()
  await (await rounds()).insertOne({
    userId: doc.userId,
    game: doc.game,
    mode: 'pair',
    answerId: doc.answer === 'right' ? doc.right : doc.left,
    guesses: [],
    status: won ? 'won' : 'lost',
    createdAt: now,
    finishedAt: now,
  })
  await markSeasonPlay(doc.userId, won, today())
}

export async function pairAnswer(userId: ObjectId, game: GameId, pick: PairSide) {
  const collection = await streaks()
  const found = await collection.findOne({ userId, game })
  if (!found || found.status !== 'playing' || !found.answer) return null

  const right = pick === found.answer
  const streak = right ? found.streak + 1 : found.streak
  const best = Math.max(found.best, streak)
  const now = new Date()

  await logPair(found, right)
  if (!found.guest) await countPair(userId, game, right, streak)

  if (!right) {
    await collection.updateOne(
      { _id: found._id },
      { $set: { status: 'over', best, updatedAt: now }, $unset: { ask: '', left: '', right: '', answer: '' } },
    )
    return { right: false, answer: found.answer as PairSide, streak: found.streak, best, over: true }
  }

  if (!found.guest) await addXp(await users(), userId, MODE_XP.pair, 'endless', 'pair')

  const next = await ask(game, streak, found)
  if (!next) return null

  await collection.updateOne(
    { _id: found._id },
    { $set: { streak, best, left: next.left, right: next.right, ask: next.ask, answer: next.answer, updatedAt: now } },
  )
  return { right: true, answer: found.answer as PairSide, streak, best, question: { left: next.left, right: next.right, ask: next.ask } }
}

async function countPair(userId: ObjectId, game: GameId, right: boolean, streak: number) {
  const path = `stats.${statsKey(game, 'pair')}`
  await (await users()).updateOne(
    { _id: userId },
    right
      ? { $inc: { [`${path}.solved`]: 1, [`${path}.totalGuesses`]: 1 }, $set: { [`${path}.streak`]: streak }, $max: { [`${path}.best`]: streak } }
      : { $set: { [`${path}.streak`]: 0 } },
  )
}

export async function pairBoard(game: GameId, limit = 20) {
  const collection = await streaks()
  return collection.find({ game, best: { $gt: 0 }, guest: { $ne: true } }, { sort: { best: -1 }, limit }).toArray()
}
