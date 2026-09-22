import { ObjectId } from 'mongodb'
import { judgeAll, statsKey, type GameId, type ModeId } from '../../src/games/specs.js'
import { rounds, type RoundDoc, type UserDoc } from './db.js'
import { gameData, isGame, isMode } from './games.js'
import { applyResult } from './profile.js'
import type { Collection } from 'mongodb'

const RECENT = 25

export async function activeRound(userId: ObjectId, game: GameId, mode: ModeId) {
  const collection = await rounds()
  const existing = await collection.findOne({ userId, game, mode, status: 'active' })
  if (existing) return existing

  const recent = await collection
    .find({ userId, game, mode }, { projection: { answerId: 1 }, sort: { createdAt: -1 }, limit: RECENT })
    .toArray()
  const seen = new Set(recent.map((r) => r.answerId))
  const { pool } = gameData(game)
  const fresh = pool.filter((e) => !seen.has(e.id))
  const choices = fresh.length ? fresh : pool
  const answer = choices[Math.floor(Math.random() * choices.length)]
  const doc: RoundDoc = { userId, game, mode, answerId: answer.id, guesses: [], status: 'active', createdAt: new Date() }
  const { insertedId } = await collection.insertOne(doc)
  return { ...doc, _id: insertedId }
}

export async function roundView(round: RoundDoc) {
  const game = round.game as GameId
  const { byId } = gameData(game)
  const answer = byId.get(round.answerId)!
  const number = await (await rounds()).countDocuments({ userId: round.userId, game: round.game, mode: round.mode })
  const id = round._id!.toHexString()
  return {
    id,
    game: round.game,
    mode: round.mode,
    number,
    status: round.status,
    guesses: round.guesses.map((guessId) => ({
      id: guessId,
      judgement: round.mode === 'classic' ? judgeAll(game, byId.get(guessId)!, answer) : undefined,
    })),
    answerId: round.status === 'active' ? undefined : round.answerId,
    image: round.mode === 'image' ? `/api/round/image?id=${id}` : undefined,
  }
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
    { $set: { status: won ? 'won' : 'lost', finishedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated) return { round: (await collection.findOne({ _id: round._id }))!, stats: null }
  const key = statsKey(round.game, round.mode)
  const stats = await applyResult(users, round.userId, key, won, Math.max(round.guesses.length, 1))
  return { round: updated, stats: { key, value: stats } }
}
