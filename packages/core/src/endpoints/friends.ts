import { ObjectId } from 'mongodb'
import { fail, handle, json, readJson } from '../http'
import { currentUser, searchPlayers, unauthorized } from '../profile'
import { answerFriend, askFriend, dropFriend, friendList, friendOutgoing, friendRequests, friendState } from '../friends'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!

  const [list, requests, sent] = await Promise.all([friendList(userId), friendRequests(userId), friendOutgoing(userId)])
  return json({ friends: list, requests, sent })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const body = await readJson(request)
  const action = body.action

  if (action === 'search') return json({ players: await searchPlayers(userId, body.q) })

  const wanted = typeof body.id === 'string' && ObjectId.isValid(body.id) ? new ObjectId(body.id) : null
  if (!wanted) return fail(400, 'bad_request')

  if (action === 'ask') {
    const state = await askFriend(userId, wanted)
    if (state === 'missing') return fail(404, 'not_found')
    return json({ state })
  }

  if (action === 'accept' || action === 'decline') {
    const done = await answerFriend(userId, wanted, action === 'accept')
    if (!done) return fail(404, 'not_found')
    return json({ state: await friendState(userId, wanted) })
  }

  if (action === 'remove') {
    await dropFriend(userId, wanted)
    return json({ state: 'none' })
  }

  return fail(400, 'bad_request')
})
