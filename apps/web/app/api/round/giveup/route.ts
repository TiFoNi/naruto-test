import { dailyKey, statsKey, type GameId, type ModeId } from '@nanda/game'
import { users } from '@/lib/db'
import { fail, handle, json, readJson } from '@/lib/http'
import { applySkip, sessionUserId, unauthorized } from '@/lib/profile'
import { ownedRound, roundView, skipRound } from '@/lib/rounds'

export const POST = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const round = await ownedRound(userId, (await readJson(request)).roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return json({ round: await roundView(round, false) })
  const collection = await users()
  const skipped = await skipRound(round, collection)
  if (round.challenge) return json({ round: await roundView(skipped, false) })
  const game = round.game as GameId
  const mode = round.mode as ModeId
  const key = round.daily ? dailyKey(game, mode) : statsKey(game, mode)
  const stats = await applySkip(collection, userId, key)
  return json({ round: await roundView(skipped, false), stats: { key, value: stats } })
})
