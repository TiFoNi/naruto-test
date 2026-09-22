import { fail, handle, json, readJson } from '../_lib/http.js'
import { sessionUserId, unauthorized } from '../_lib/profile.js'
import { ownedRound, roundView, skipRound } from '../_lib/rounds.js'

export const POST = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const round = await ownedRound(userId, (await readJson(request)).roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return json({ round: await roundView(round, false) })
  return json({ round: await roundView(await skipRound(round), false) })
})
