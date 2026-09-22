import { fail, handle, json, readJson } from '../_lib/http.js'
import { currentUser, parseNickname, toProfile, unauthorized } from '../_lib/profile.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const nickname = parseNickname((await readJson(request)).nickname)
  if (!nickname) return fail(400, 'invalid_nickname')
  const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { nickname } }, { returnDocument: 'after' })
  return json(toProfile(doc ?? found.doc))
})
