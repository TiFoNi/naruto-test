import { fail, handle, json, readJson } from '../_lib/http.js'
import { currentUser, unauthorized } from '../_lib/profile.js'
import { ownedRound, roundView, skipRound } from '../_lib/rounds.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const round = await ownedRound(found.doc._id!, (await readJson(request)).roundId)
  if (!round) return fail(404, 'not_found')
  if (round.status !== 'active') return json({ round: await roundView(round) })
  return json({ round: await roundView(await skipRound(round)) })
})
