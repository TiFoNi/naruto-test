import { fail, handle, json, readJson } from '../http'
import { hasMode } from '@nanda/game'
import { gameData, isGame, isMode } from '../games'
import { roundOwner, unauthorized } from '../profile'
import { activeRound, challengeRound, dailyRound, refilterRound, roundView } from '../rounds'
import { isCode } from '../challenges'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)

  if (isCode(body.challenge)) {
    if (owner.guest) return unauthorized()
    const round = await challengeRound(owner.id, body.challenge)
    return round ? json({ round: await roundView(round) }) : fail(404, 'not_found')
  }

  const { game, mode, daily } = body
  if (daily === true && owner.guest) return unauthorized()
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return fail(400, 'bad_request')
  if (!(await gameData(game)).pool.length) return fail(503, 'not_ready')

  const endless = body.swap === true ? refilterRound : activeRound
  const round =
    daily === true
      ? await dailyRound(owner.id, game, mode, owner.guest)
      : await endless(owner.id, game, mode, owner.guest, body.anime === true)
  return json({ round: await roundView(round), guest: owner.guest }, 200, owner.cookie)
})
