import { dailyKey, statsKey, type GameId, type ModeId } from '@nanda/game'
import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { applySkip, roundOwner } from '../profile'
import { ownedRound, readDevice, roundView, skipRound } from '../rounds'
import { ringRound } from '../stream'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const userId = owner.id
  const body = await readJson(request)
  const round = await ownedRound(userId, body.roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return json({ round: await roundView(round, false) })
  const collection = await users()
  const skipped = await skipRound(round, collection)
  if (!owner.guest) ringRound(userId, { id: String(round._id), device: readDevice(body.device) })
  if (round.challenge) return json({ round: await roundView(skipped, false) })
  const game = round.game as GameId
  const mode = round.mode as ModeId
  const key = round.daily ? dailyKey(game, mode) : statsKey(game, mode)
  const stats = await applySkip(collection, userId, key, round.daily ? { day: round.daily, how: 'gaveUp' } : undefined)
  return json({ round: await roundView(skipped, false), stats: { key, value: stats } })
})
