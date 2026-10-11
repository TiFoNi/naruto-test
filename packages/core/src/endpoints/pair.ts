import { fail, handle, json, readJson } from '../http'
import { gameData, isGame } from '../games'
import { roundOwner } from '../profile'
import { isSide, pairAnswer, pairRun } from '../streaks'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)
  const game = body.game

  if (!isGame(game)) return fail(400, 'bad_request')
  if (!(await gameData(game)).pool.length) return fail(503, 'not_ready')

  if (body.action === 'answer') {
    if (!isSide(body.pick)) return fail(400, 'bad_request')
    const result = await pairAnswer(owner.id, game, body.pick)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  const run = await pairRun(owner.id, game, owner.guest, body.action === 'restart')
  return run ? json({ ...run, guest: owner.guest }, 200, owner.cookie) : fail(503, 'not_ready')
})
