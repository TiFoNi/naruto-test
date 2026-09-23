import { fail, handle, json, readJson } from '@/lib/http'
import { currentUser, unauthorized } from '@/lib/profile'
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
} from '@/lib/duels'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const duel = await createDuel(found.doc)
    return duel ? json({ duel: duelView(duel, userId) }) : fail(400, 'bad_request')
  }

  const duel = await findDuel(body.code)
  if (!duel) return fail(404, 'not_found')

  if (action === 'join') {
    const joined = await joinDuel(duel, found.doc)
    return joined ? json({ duel: duelView(joined, userId) }) : fail(409, 'duel_full')
  }

  if (!sideOf(duel, userId)) return fail(403, 'forbidden')

  if (action === 'state') return json({ duel: duelView(await settle(duel), userId) })
  if (action === 'setup') {
    const updated = await setupDuel(duel, userId, body.game, body.mode)
    return updated ? json({ duel: duelView(updated, userId) }) : fail(400, 'bad_request')
  }
  if (action === 'next') return json({ duel: duelView(await wantNext(duel, userId), userId) })
  if (action === 'lobby') return json({ duel: duelView(await backToLobby(duel, userId), userId) })
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
