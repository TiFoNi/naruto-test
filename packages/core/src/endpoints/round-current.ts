import type { RoundDoc } from '../db'
import { fail, handle, json, readJson } from '../http'
import { hasMode, statsKey } from '@nanda/game'
import { users } from '../db'
import { gameData, isGame, isMode } from '../games'
import { applySkip, roundOwner, unauthorized } from '../profile'
import { activeRound, busyElsewhere, challengeRound, claimRound, dailyRound, readDevice, refilterRound, roundView, skipRound } from '../rounds'
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

  const device = readDevice(body.device)
  const endless = body.swap === true ? refilterRound : activeRound
  let round: RoundDoc =
    daily === true
      ? await dailyRound(owner.id, game, mode, owner.guest)
      : await endless(owner.id, game, mode, owner.guest, body.anime === true)
  if (busyElsewhere(round, device)) {
    if (body.take !== true) return fail(409, daily === true ? 'elsewhere_daily' : 'elsewhere')
    if (daily !== true) {
      const people = await users()
      await skipRound(round, people)
      await applySkip(people, owner.id, statsKey(game, mode))
      round = await activeRound(owner.id, game, mode, owner.guest, body.anime === true)
    }
  }
  round = await claimRound(round, device)
  return json({ round: await roundView(round), guest: owner.guest }, 200, owner.cookie)
})
