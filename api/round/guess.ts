import { rounds } from '../_lib/db.js'
import { gameData } from '../_lib/games.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { currentUser, unauthorized } from '../_lib/profile.js'
import { finishRound, ownedRound, roundView } from '../_lib/rounds.js'
import type { GameId } from '../../src/games/specs.js'

const MAX_GUESSES = 300

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  const round = await ownedRound(found.doc._id!, body.roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return fail(409, 'round_over')
  const entityId = Number(body.entityId)
  if (!Number.isInteger(entityId) || !gameData(round.game as GameId).byId.has(entityId)) return fail(400, 'bad_request')

  const updated = await (await rounds()).findOneAndUpdate(
    { _id: round._id, status: 'active', guesses: { $ne: entityId }, [`guesses.${MAX_GUESSES}`]: { $exists: false } },
    { $push: { guesses: entityId } },
    { returnDocument: 'after' },
  )
  if (!updated) return fail(409, 'duplicate')

  if (entityId !== updated.answerId) return json({ round: await roundView(updated) })
  const result = await finishRound(found.collection, updated, true)
  return json({ round: await roundView(result.round), stats: result.stats })
})
