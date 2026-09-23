import { fail, handle, json, readJson } from '../http'
import { hasMode } from '@nanda/game'
import { gameData, isGame, isMode } from '../games'
import { currentUser, unauthorized } from '../profile'
import { activeRound, challengeRound, dailyRound, roundView } from '../rounds'
import { isCode } from '../challenges'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  if (isCode(body.challenge)) {
    const round = await challengeRound(found.doc._id!, body.challenge)
    return round ? json({ round: await roundView(round) }) : fail(404, 'not_found')
  }
  const { game, mode, daily } = body
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return fail(400, 'bad_request')
  if (!gameData(game).pool.length) return fail(503, 'not_ready')
  const round = daily === true ? await dailyRound(found.doc._id!, game, mode) : await activeRound(found.doc._id!, game, mode)
  return json({ round: await roundView(round) })
})
