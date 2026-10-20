import { users } from '../db'
import { handle, json } from '../http'
import { adminSession } from '../admin'
import { currentUser, rememberLang, toProfile } from '../profile'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return json({ user: null })
  await rememberLang(await users(), found.doc._id!, request)
  const profile = toProfile(found.doc)
  const boss = await adminSession(request)
  return json(boss ? { ...profile, user: { ...profile.user, admin: true } } : profile)
})
