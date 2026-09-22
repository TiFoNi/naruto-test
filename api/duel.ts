import { fail, handle, json, readJson } from './_lib/http.js'
import { currentUser, unauthorized } from './_lib/profile.js'
import {
  createDuel,
  duelGuess,
  duelHistory,
  duelView,
  findDuel,
  giveUpDuel,
  joinDuel,
  setReady,
  settle,
  sideOf,
} from './_lib/duels.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const duel = await createDuel(found.doc, body.game, body.mode)
    return duel ? json({ duel: duelView(duel, userId) }) : fail(400, 'bad_request')
  }

  if (action === 'history') return json({ history: await duelHistory(userId), stats: found.doc.duelStats ?? null })

  const duel = await findDuel(body.code)
  if (!duel) return fail(404, 'not_found')

  if (action === 'join') {
    const joined = await joinDuel(duel, found.doc)
    return joined ? json({ duel: duelView(joined, userId) }) : fail(409, 'duel_full')
  }

  if (!sideOf(duel, userId)) return fail(403, 'forbidden')

  if (action === 'state') return json({ duel: duelView(await settle(duel), userId) })
  if (action === 'ready') return json({ duel: duelView(await setReady(duel, userId), userId) })
  if (action === 'giveup') return json({ duel: duelView(await giveUpDuel(duel, userId), userId) })

  if (action === 'guess') {
    const entityId = Number(body.entityId)
    if (!Number.isInteger(entityId)) return fail(400, 'bad_request')
    const result = await duelGuess(await settle(duel), userId, entityId)
    if (result.error === 'too_fast') return fail(429, 'too_fast')
    if (result.error) return fail(result.error === 'not_found' ? 404 : result.error === 'duplicate' ? 409 : 400, result.error)
    return json({ duel: duelView(result.duel!, userId) })
  }

  return fail(400, 'bad_request')
})
