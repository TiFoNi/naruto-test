import { tuneLevel } from '@nanda/game'
import { automated, fail, handle, json, readJson, robot } from '../http'
import { gameData } from '../games'
import { roundOwner } from '../profile'
import { dailyTune, dailyTuneAnswer, dailyTuneGiveUp, dailyTuneSkip, tuneAnswer, tuneGiveUp, tunePoints, tuneRun, tuneSkip } from '../tunes'

export const POST = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)

  if (!(await gameData('tunes')).pool.length) return fail(503, 'not_ready')

  if (body.daily) {
    if (body.action === 'answer') {
    if (automated(request)) return robot()
      if (typeof body.pick !== 'number') return fail(400, 'bad_request')
      const result = await dailyTuneAnswer(owner.id, body.pick)
      return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
    }

    if (body.action === 'skip' || body.action === 'giveup') {
      const result = body.action === 'skip' ? await dailyTuneSkip(owner.id) : await dailyTuneGiveUp(owner.id)
      return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
    }

    const run = await dailyTune(owner.id, owner.guest)
    return run ? json({ ...run, guest: owner.guest }, 200, owner.cookie) : fail(503, 'not_ready')
  }

  if (body.action === 'answer') {
    if (automated(request)) return robot()
    if (typeof body.pick !== 'number') return fail(400, 'bad_request')
    const result = await tuneAnswer(owner.id, body.pick, owner.guest)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  if (body.action === 'skip') {
    const result = await tuneSkip(owner.id, owner.guest)
    return result ? json(result, 200, owner.cookie) : fail(409, 'no_round')
  }

  if (body.action === 'giveup') {
    const result = await tuneGiveUp(owner.id, owner.guest)
    if (!result) return fail(409, 'no_round')
    return json({ ...result, total: owner.guest ? undefined : await tunePoints(owner.id) }, 200, owner.cookie)
  }

  const run = await tuneRun(owner.id, owner.guest, tuneLevel(body.grade), body.action === 'restart')
  if (!run) return fail(503, 'not_ready')
  return json({ ...run, guest: owner.guest, total: owner.guest ? undefined : await tunePoints(owner.id) }, 200, owner.cookie)
})
