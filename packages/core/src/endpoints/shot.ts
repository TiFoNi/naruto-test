import { fail, handle, json, readJson } from '../http'
import { gameData } from '../games'
import { roundOwner } from '../profile'
import { shotAnswer, shotGiveUp, shotPoints, shotRun, shotSkip } from '../shots'

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
    if (!result) return fail(409, 'no_round')
    return json({ ...result, total: owner.guest ? undefined : await shotPoints(owner.id) }, 200, owner.cookie)
  }

  const run = await shotRun(owner.id, owner.guest, body.action === 'restart')
  if (!run) return fail(503, 'not_ready')
  return json({ ...run, guest: owner.guest, total: owner.guest ? undefined : await shotPoints(owner.id) }, 200, owner.cookie)
})
