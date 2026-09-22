import { fail, handle, json, readJson } from '../_lib/http.js'
import { isGame, isMode } from '../_lib/games.js'
import { currentUser, unauthorized } from '../_lib/profile.js'
import { activeRound, roundView } from '../_lib/rounds.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const { game, mode } = await readJson(request)
  if (!isGame(game) || !isMode(mode)) return fail(400, 'bad_request')
  const round = await activeRound(found.doc._id!, game, mode)
  return json({ round: await roundView(round) })
})
