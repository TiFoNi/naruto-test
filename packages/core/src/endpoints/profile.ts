import { fail, handle, json, readJson } from '../http'
import { currentUser, parseNickname, toProfile, unauthorized } from '../profile'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)

  if (body.action === 'reset') {
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $unset: { stats: '', duelStats: '', challengeStats: '' } }, { returnDocument: 'after' })
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'nickname') {
    const nickname = parseNickname(body.nickname)
    if (!nickname) return fail(400, 'invalid_nickname')
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { nickname } }, { returnDocument: 'after' })
    return json(toProfile(doc ?? found.doc))
  }

  return fail(400, 'bad_request')
})
