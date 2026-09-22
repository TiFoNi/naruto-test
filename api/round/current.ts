import { fail, handle, json, readJson } from '../_lib/http.js'
import { hasMode } from '../../src/games/specs.js'
import { isGame, isMode } from '../_lib/games.js'
import { currentUser, unauthorized } from '../_lib/profile.js'
import { activeRound, dailyRound, roundView } from '../_lib/rounds.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const { game, mode, daily } = await readJson(request)
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return fail(400, 'bad_request')
  const round = daily === true ? await dailyRound(found.doc._id!, game, mode) : await activeRound(found.doc._id!, game, mode)
  return json({ round: await roundView(round) })
})
