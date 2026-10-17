import { tuneLevel } from '@nanda/game'
import { fail, handle, json, readJson } from '../http'
import { gameData } from '../games'
import { roundOwner } from '../profile'
import { tuneAnswer, tuneGiveUp, tunePoints, tuneRun, tuneSkip } from '../tunes'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)

  if (!(await gameData('tunes')).pool.length) return fail(503, 'not_ready')

  if (body.action === 'answer') {
    if (typeof body.pick !== 'number') return fail(400, 'bad_request')
    const result = await tuneAnswer(owner.id, body.pick)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  if (body.action === 'skip') {
    const result = await tuneSkip(owner.id)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  if (body.action === 'giveup') {
    const result = await tuneGiveUp(owner.id)
    if (!result) return fail(409, 'no_round')
    return json({ ...result, total: owner.guest ? undefined : await tunePoints(owner.id) }, 200, owner.cookie)
  }

  const run = await tuneRun(owner.id, owner.guest, tuneLevel(body.grade), body.action === 'restart')
  if (!run) return fail(503, 'not_ready')
  return json({ ...run, guest: owner.guest, total: owner.guest ? undefined : await tunePoints(owner.id) }, 200, owner.cookie)
})
