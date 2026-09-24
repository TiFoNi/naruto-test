import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'
import {
  backToLobby,
  createDuel,
  duelGuess,
  duelView,
  findDuel,
  giveUpDuel,
  joinDuel,
  setReady,
  settle,
  setupDuel,
  sideOf,
  wantNext,
} from '../duels'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const duel = await createDuel(found.doc)
    return duel ? json({ duel: await duelView(duel, userId) }) : fail(400, 'bad_request')
  }

  const duel = await findDuel(body.code)
  if (!duel) return fail(404, 'not_found')

  if (action === 'join') {
    const joined = await joinDuel(duel, found.doc)
    return joined ? json({ duel: await duelView(joined, userId) }) : fail(409, 'duel_full')
  }

  if (!sideOf(duel, userId)) return fail(403, 'forbidden')

  if (action === 'state') return json({ duel: await duelView(await settle(duel), userId) })
  if (action === 'setup') {
    const updated = await setupDuel(duel, userId, body.game, body.mode)
    return updated ? json({ duel: await duelView(updated, userId) }) : fail(400, 'bad_request')
  }
  if (action === 'next') return json({ duel: await duelView(await wantNext(duel, userId), userId) })
  if (action === 'lobby') return json({ duel: await duelView(await backToLobby(duel, userId), userId) })
  if (action === 'ready') return json({ duel: await duelView(await setReady(duel, userId), userId) })
  if (action === 'giveup') return json({ duel: await duelView(await giveUpDuel(duel, userId), userId) })

  if (action === 'guess') {
    const entityId = Number(body.entityId)
    if (!Number.isInteger(entityId)) return fail(400, 'bad_request')
    const result = await duelGuess(await settle(duel), userId, entityId)
    if (result.error === 'too_fast') return fail(429, 'too_fast')
    if (result.error) return fail(result.error === 'not_found' ? 404 : result.error === 'duplicate' ? 409 : 400, result.error)
    return json({ duel: await duelView(result.duel!, userId) })
  }

  return fail(400, 'bad_request')
})
