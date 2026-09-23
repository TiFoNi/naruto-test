import { dailyKey, statsKey, type GameId, type ModeId } from '../../src/games/specs.js'
import { users } from '../_lib/db.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { applySkip, sessionUserId, unauthorized } from '../_lib/profile.js'
import { ownedRound, roundView, skipRound } from '../_lib/rounds.js'

export const POST = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const round = await ownedRound(userId, (await readJson(request)).roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return json({ round: await roundView(round, false) })
  const skipped = await skipRound(round)
  if (round.challenge) return json({ round: await roundView(skipped, false) })
  const game = round.game as GameId
  const mode = round.mode as ModeId
  const key = round.daily ? dailyKey(game, mode) : statsKey(game, mode)
  const stats = await applySkip(await users(), userId, key)
  return json({ round: await roundView(skipped, false), stats: { key, value: stats } })
})
