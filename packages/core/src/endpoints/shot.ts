import { fail, handle, json, readJson } from '../http'
import { gameData } from '../games'
import { roundOwner } from '../profile'
import { shotAnswer, shotGiveUp, shotRun, shotSkip } from '../shots'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)

  if (!(await gameData('shots')).pool.length) return fail(503, 'not_ready')

  if (body.action === 'answer') {
    if (typeof body.pick !== 'number') return fail(400, 'bad_request')
    const result = await shotAnswer(owner.id, body.pick)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  if (body.action === 'skip' || body.action === 'giveup') {
    const result = body.action === 'skip' ? await shotSkip(owner.id) : await shotGiveUp(owner.id)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  const run = await shotRun(owner.id, owner.guest, body.action === 'restart')
  return run ? json({ ...run, guest: owner.guest }, 200, owner.cookie) : fail(503, 'not_ready')
})
