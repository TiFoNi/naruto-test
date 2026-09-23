import { ObjectId } from 'mongodb'
import { rounds, users } from '@/lib/db'
import { gameData, isGame } from '@/lib/games'
import { fail, handle, json, readJson } from '@/lib/http'
import { sessionUserId, unauthorized } from '@/lib/profile'
import { finishRound, roundView } from '@/lib/rounds'

const MAX_GUESSES = 300
const MIN_GAP_MS = 800

export const POST = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const body = await readJson(request)
  const entityId = Number(body.entityId)
  if (typeof body.roundId !== 'string' || !ObjectId.isValid(body.roundId) || !Number.isInteger(entityId)) return fail(400, 'bad_request')
  const game = typeof body.game === 'string' && isGame(body.game) ? body.game : null
  if (game && !gameData(game).byId.has(entityId)) return fail(400, 'bad_request')

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
    if (!gameData(round.game).byId.has(entityId)) return fail(400, 'bad_request')
    if (round.guesses.includes(entityId)) return fail(409, 'duplicate')
    return fail(429, 'too_fast')
  }

  if (!isGame(updated.game) || !gameData(updated.game).byId.has(entityId)) {
    await collection.updateOne({ _id }, { $pull: { guesses: entityId } })
    return fail(400, 'bad_request')
  }

  if (entityId !== updated.answerId) return json({ round: await roundView(updated, false) })
  const result = await finishRound(await users(), updated, true)
  return json({ round: await roundView(result.round, false), stats: result.stats })
})
