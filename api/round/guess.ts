import { ObjectId } from 'mongodb'
import { rounds, users } from '../_lib/db.js'
import { gameData, isGame } from '../_lib/games.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { sessionUserId, unauthorized } from '../_lib/profile.js'
import { finishRound, roundView } from '../_lib/rounds.js'

const MAX_GUESSES = 300

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
  const updated = await collection.findOneAndUpdate(
    { _id, userId, status: 'active', guesses: { $ne: entityId }, [`guesses.${MAX_GUESSES}`]: { $exists: false } },
    { $push: { guesses: entityId } },
    { returnDocument: 'after' },
  )

  if (!updated) {
    const round = await collection.findOne({ _id, userId })
    if (!round || !isGame(round.game)) return fail(404, 'not_found')
    if (round.status !== 'active') return fail(409, 'round_over')
    if (!gameData(round.game).byId.has(entityId)) return fail(400, 'bad_request')
    return fail(409, 'duplicate')
  }

  if (!isGame(updated.game) || !gameData(updated.game).byId.has(entityId)) {
    await collection.updateOne({ _id }, { $pull: { guesses: entityId } })
    return fail(400, 'bad_request')
  }

  if (entityId !== updated.answerId) return json({ round: await roundView(updated, false) })
  const result = await finishRound(await users(), updated, true)
  return json({ round: await roundView(result.round, false), stats: result.stats })
})
