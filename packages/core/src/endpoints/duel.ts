import { fail, handle, json, readJson } from '../http'
import { currentUser, defaultNickname, unauthorized } from '../profile'
import {
  answerCard,
  backToLobby,
  createDuel,
  declineInvite,
  dropIdle,
  duelGuess,
  duelHistory,
  duelView,
  findDuel,
  giveUpDuel,
  inviteTo,
  joinDuel,
  leaveDuel,
  openLobby,
  passTurn,
  pickSecret,
  recentRivals,
  setReady,
  settle,
  setupDuel,
  sideOf,
  strikeCard,
  sweepDuels,
  touchSide,
  wantNext,
} from '../duels'
import { ObjectId } from 'mongodb'
import { users } from '../db'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const body = await readJson(request)
  const action = body.action
  await sweepDuels()

  if (action === 'create') {
    const reuse = body.fresh ? null : await openLobby(userId)
    const duel = reuse ?? (await createDuel(found.doc))
    return duel ? json({ duel: await duelView(duel, userId) }) : fail(400, 'bad_request')
  }

  if (action === 'challenge') {
    if (typeof body.to !== 'string' || !ObjectId.isValid(body.to)) return fail(400, 'bad_request')
    const target = await (await users()).findOne({ _id: new ObjectId(body.to) })
    if (!target || target._id!.equals(userId)) return fail(404, 'not_found')
    const duel = await createDuel(found.doc, target)
    return duel ? json({ duel: await duelView(duel, userId) }) : fail(400, 'bad_request')
  }

  if (action === 'rivals') return json({ rivals: await recentRivals(userId) })

  if (action === 'history') return json({ duels: (await duelHistory(userId)).slice(0, 10) })

  if (action === 'players') {
    const query = typeof body.q === 'string' ? body.q.trim().slice(0, 24).toLowerCase() : ''
    if (query.length < 2) return json({ players: [] })
    const list = await (await users())
      .find(
        { _id: { $ne: userId }, nicknameLower: { $gte: query, $lt: `${query}\uffff` } },
        { projection: { nickname: 1, username: 1 }, sort: { nicknameLower: 1 } },
      )
      .limit(6)
      .toArray()
    return json({ players: list.map((doc) => ({ id: doc._id!.toHexString(), nickname: doc.nickname ?? defaultNickname(doc.username) })) })
  }

  const duel = await findDuel(body.code)
  if (!duel) return fail(404, 'not_found')

  if (action === 'decline') {
    const done = await declineInvite(duel, userId)
    return done ? json({ ok: true }) : fail(403, 'forbidden')
  }

  if (action === 'join') {
    const joined = await joinDuel(duel, found.doc)
    return joined ? json({ duel: await duelView(joined, userId) }) : fail(409, 'duel_full')
  }

  if (!sideOf(duel, userId)) return fail(403, 'forbidden')

  const live = await dropIdle(await touchSide(duel, userId), userId)

  if (action === 'leave') {
    const done = await leaveDuel(live, userId)
    return done ? json({ ok: true }) : fail(403, 'forbidden')
  }

  if (action === 'state') return json({ duel: await duelView(await settle(live), userId) })
  if (action === 'setup') {
    const updated = await setupDuel(live, userId, body)
    return updated ? json({ duel: await duelView(updated, userId) }) : fail(400, 'bad_request')
  }
  if (action === 'invite') {
    const updated = await inviteTo(live, userId, body.to)
    return updated ? json({ duel: await duelView(updated, userId) }) : fail(400, 'bad_request')
  }
  if (action === 'next') return json({ duel: await duelView(await wantNext(live, userId), userId) })
  if (action === 'lobby') return json({ duel: await duelView(await backToLobby(live, userId), userId) })
  if (action === 'ready') return json({ duel: await duelView(await setReady(live, userId, body.ready !== false), userId) })
  if (action === 'giveup') return json({ duel: await duelView(await giveUpDuel(live, userId), userId) })

  if (action === 'pass') {
    const result = await passTurn(live, userId)
    if (result.error) return fail(result.error === 'round_over' ? 409 : 403, result.error)
    return json({ duel: await duelView(result.duel!, userId) })
  }

  if (action === 'pick') {
    const entityId = Number(body.entityId)
    if (!Number.isInteger(entityId)) return fail(400, 'bad_request')
    const result = await pickSecret(live, userId, entityId)
    if (result.error) return fail(result.error === 'round_over' ? 409 : 400, result.error)
    return json({ duel: await duelView(result.duel!, userId) })
  }

  if (action === 'strike' || action === 'answer') {
    const entityId = Number(body.entityId)
    if (!Number.isInteger(entityId)) return fail(400, 'bad_request')
    const result = action === 'answer' ? await answerCard(live, userId, entityId) : await strikeCard(live, userId, entityId)
    if (result.error) return fail(result.error === 'round_over' ? 409 : result.error === 'not_your_turn' ? 403 : 400, result.error)
    return json({ duel: await duelView(result.duel!, userId) })
  }

  if (action === 'guess') {
    const entityId = Number(body.entityId)
    if (!Number.isInteger(entityId)) return fail(400, 'bad_request')
    const result = await duelGuess(await settle(live), userId, entityId)
    if (result.error === 'too_fast') return fail(429, 'too_fast')
    if (result.error) return fail(result.error === 'not_found' ? 404 : result.error === 'duplicate' ? 409 : 400, result.error)
    return json({ duel: await duelView(result.duel!, userId) })
  }

  return fail(400, 'bad_request')
})
