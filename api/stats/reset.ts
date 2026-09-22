import { handle, json } from '../_lib/http.js'
import { currentUser, toProfile, unauthorized } from '../_lib/profile.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $unset: { stats: '' } }, { returnDocument: 'after' })
  return json(toProfile(doc ?? found.doc))
})
