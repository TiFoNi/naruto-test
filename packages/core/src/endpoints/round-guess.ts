import { ObjectId } from 'mongodb'
import { rounds, users } from '../db'
import { gameData, isGame } from '../games'
import { automated, fail, handle, json, readJson, robot } from '../http'
import { oneTry } from '@nanda/game'
import { rememberLang, roundOwner, touchVisit } from '../profile'
import { finishRound, roundLimit, roundView } from '../rounds'

const MAX_GUESSES = 300
const MIN_GAP_MS = 800

export const POST = handle(async (request) => {
  if (automated(request)) return robot()
  const owner = await roundOwner(request)
  const userId = owner.id
  const body = await readJson(request)
  const entityId = Number(body.entityId)
  if (typeof body.roundId !== 'string' || !ObjectId.isValid(body.roundId) || !Number.isInteger(entityId)) return fail(400, 'bad_request')
  const game = typeof body.game === 'string' && isGame(body.game) ? body.game : null
  if (game && !(await gameData(game)).byId.has(entityId)) return fail(400, 'bad_request')

  const collection = await rounds()
  const _id = new ObjectId(body.roundId)
  const now = new Date()
  const updated = await collection.findOneAndUpdate(
    {
      _id,
      userId,
      status: 'active',
      guesses: { $ne: entityId },
      [`guesses.${MAX_GUESSES}`]: { $exists: false },
      $or: [{ lastGuessAt: { $exists: false } }, { lastGuessAt: { $lte: new Date(now.getTime() - MIN_GAP_MS) } }],
    },
    { $push: { guesses: entityId }, $set: { lastGuessAt: now }, $min: { startedAt: now } },
    { returnDocument: 'after' },
  )

  if (!updated) {
    const round = await collection.findOne({ _id, userId })
    if (!round || !isGame(round.game)) return fail(404, 'not_found')
    if (round.status !== 'active') return fail(409, 'round_over')
    if (!(await gameData(round.game as never)).byId.has(entityId)) return fail(400, 'bad_request')
    if (round.guesses.includes(entityId)) return fail(409, 'duplicate')
    return fail(429, 'too_fast')
  }

  if (!isGame(updated.game) || !(await gameData(updated.game)).byId.has(entityId)) {
    await collection.updateOne({ _id }, { $pull: { guesses: entityId } })
    return fail(400, 'bad_request')
  }

  const people = await users()
  if (!owner.guest) {
    await touchVisit(people, userId)
    await rememberLang(people, userId, request)
  }
  if (entityId !== updated.answerId) {
    const limit = await roundLimit(updated)
    const spent = limit !== null && updated.guesses.length >= limit
    if (!oneTry(updated.game, updated.mode) && !spent) return json({ round: await roundView(updated, false) })
    const missed = await finishRound(people, updated, false)
    return json({ round: await roundView(missed.round, false), stats: missed.stats })
  }
  const result = await finishRound(people, updated, true)
  return json({ round: await roundView(result.round, false), stats: result.stats, ...(result.xp ? { xp: result.xp } : {}) })
})
