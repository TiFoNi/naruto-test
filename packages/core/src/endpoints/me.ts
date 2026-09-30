import { users } from '../db'
import { handle, json } from '../http'
import { currentUser, rememberLang, toProfile } from '../profile'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (found) await rememberLang(await users(), found.doc._id!, request)
  return json(found ? toProfile(found.doc) : { user: null })
})
