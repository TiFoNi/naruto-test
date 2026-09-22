import { ObjectId } from 'mongodb'
import { dailyKey, judgeAll, statsKey, type GameId, type ModeId } from '../../src/games/specs.js'
import { dailyAnswer, dailyNumber, nextReset, pastAnswer, shiftDay, today } from './daily.js'
import { rounds, type RoundDoc, type UserDoc } from './db.js'
import { gameData, isGame, isMode } from './games.js'
import { applyDailyResult, applyResult } from './profile.js'
import { abilityByKey } from './abilities.js'
import { roundExtra } from './extra.js'

const ABILITY_HINT_AT = 7
const ABILITY_STAGES = 5
import type { Collection } from 'mongodb'

const RECENT = 25

export async function activeRound(userId: ObjectId, game: GameId, mode: ModeId) {
  const collection = await rounds()
  const existing = await collection.findOne({ userId, game, mode, status: 'active', daily: { $exists: false } })
  if (existing) return existing

  const recent = await collection
    .find({ userId, game, mode }, { projection: { answerId: 1 }, sort: { createdAt: -1 }, limit: RECENT })
    .toArray()
  const seen = new Set(recent.map((r) => r.answerId))
  const { pool } = gameData(game)
  const fresh = pool.filter((e) => !seen.has(e.id))
  const choices = fresh.length ? fresh : pool
  const answer = choices[Math.floor(Math.random() * choices.length)]
  const extra = roundExtra(mode, answer.id)
  const doc: RoundDoc = { userId, game, mode, answerId: answer.id, ...(extra ? { extra } : {}), guesses: [], status: 'active', createdAt: new Date() }
  const { insertedId } = await collection.insertOne(doc)
  return { ...doc, _id: insertedId }
}

export async function dailyRound(userId: ObjectId, game: GameId, mode: ModeId) {
  const collection = await rounds()
  const day = today()
  const existing = await collection.findOne({ userId, game, mode, daily: day })
  if (existing) return existing
  const doc: RoundDoc = {
    userId,
    game,
    mode,
    daily: day,
    ...(await dailyAnswer(game, mode, day)),
    guesses: [],
    status: 'active',
    createdAt: new Date(),
  }
  try {
    const { insertedId } = await collection.insertOne(doc)
    return { ...doc, _id: insertedId }
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    return (await collection.findOne({ userId, game, mode, daily: day }))!
  }
}

async function dailyInfo(round: RoundDoc) {
  const day = round.daily!
  return {
    daily: day,
    nextAt: nextReset(),
    yesterdayId: await pastAnswer(round.game as GameId, round.mode as ModeId, shiftDay(day, -1)),
  }
}

export async function roundView(round: RoundDoc, full = true) {
  const game = round.game as GameId
  const { byId } = gameData(game)
  const answer = byId.get(round.answerId)!
  const number = !full
    ? undefined
    : round.daily
      ? dailyNumber(round.daily)
      : await (await rounds()).countDocuments({ userId: round.userId, game: round.game, mode: round.mode, daily: { $exists: false } })
  const id = round._id!.toHexString()
  return {
    id,
    game: round.game,
    mode: round.mode,
    number,
    ...(round.daily && full ? await dailyInfo(round) : {}),
    status: round.status,
    guesses: round.guesses.map((guessId) => ({
      id: guessId,
      judgement: round.mode === 'classic' ? judgeAll(game, byId.get(guessId)!, answer) : undefined,
    })),
    answerId: round.status === 'active' ? undefined : round.answerId,
    image: round.mode === 'image' || round.mode === 'ability' ? `/api/round/image?id=${id}` : undefined,
    ...(round.mode === 'ability' ? abilityInfo(round) : {}),
  }
}

const wrongGuesses = (round: RoundDoc) => round.guesses.filter((g) => g !== round.answerId).length

export function abilityStage(round: RoundDoc) {
  const wrong = wrongGuesses(round)
  return round.status !== 'active' || wrong >= ABILITY_STAGES ? '' : `s${wrong}/`
}

function abilityInfo(round: RoundDoc) {
  const wrong = wrongGuesses(round)
  const reveal = round.status !== 'active' || wrong >= ABILITY_HINT_AT
  return { hintAt: ABILITY_HINT_AT, ability: reveal ? abilityByKey(round.answerId, round.extra)?.name : undefined }
}

export async function ownedRound(userId: ObjectId, roundId: unknown) {
  if (typeof roundId !== 'string' || !ObjectId.isValid(roundId)) return null
  const round = await (await rounds()).findOne({ _id: new ObjectId(roundId), userId })
  return round && isGame(round.game) && isMode(round.mode) ? round : null
}

export async function skipRound(round: RoundDoc) {
  const collection = await rounds()
  const updated = await collection.findOneAndUpdate(
    { _id: round._id, status: 'active' },
    { $set: { status: 'skipped', finishedAt: new Date() } },
    { returnDocument: 'after' },
  )
  return updated ?? (await collection.findOne({ _id: round._id }))!
}

export async function finishRound(users: Collection<UserDoc>, round: RoundDoc, won: boolean) {
  const collection = await rounds()
  const updated = await collection.findOneAndUpdate(
    { _id: round._id, status: 'active' },
    { $set: { status: won ? 'won' : 'lost', finishedAt: new Date(), guessCount: round.guesses.length } },
    { returnDocument: 'after' },
  )
  if (!updated) return { round: (await collection.findOne({ _id: round._id }))!, stats: null }
  const guesses = Math.max(round.guesses.length, 1)
  if (round.daily) {
    const key = dailyKey(round.game, round.mode)
    return { round: updated, stats: { key, value: await applyDailyResult(users, round.userId, key, round.daily, guesses) } }
  }
  const key = statsKey(round.game, round.mode)
  const stats = await applyResult(users, round.userId, key, won, guesses)
  return { round: updated, stats: { key, value: stats } }
}
