import { handle, json } from '../http'
import { currentUser, toProfile } from '../profile'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  return json(found ? toProfile(found.doc) : { user: null })
})
