import { ObjectId } from 'mongodb'
import { isGame } from '../games'
import { cardsOf, dexOf } from '../dex'
import { users } from '../db'
import { fail, handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'

export const GET = handle(async (request) => {
  const params = new URL(request.url).searchParams
  const game = params.get('game')
  if (!isGame(game)) return fail(400, 'bad_request')
  const wanted = params.get('user')
  const found = await currentUser(request)
  if (!wanted) {
    if (!found) return json({ ids: [], guest: true })
    const [ids, cards] = await Promise.all([dexOf(found.doc._id!, game), cardsOf(found.doc._id!, game)])
    return json({ ids, cards })
  }
  if (!found) return unauthorized()
  if (!ObjectId.isValid(wanted)) return fail(404, 'not_found')
  const owner = await (await users()).findOne({ _id: new ObjectId(wanted) }, { projection: { nickname: 1 } })
  if (!owner) return fail(404, 'not_found')
  const [ids, cards] = await Promise.all([dexOf(owner._id!, game), cardsOf(owner._id!, game)])
  return json({ ids, cards, nickname: owner.nickname ?? null })
})
