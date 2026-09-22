import { handle, json } from '../_lib/http.js'
import { currentUser, toProfile } from '../_lib/profile.js'
import { clearedCookie, readSession } from '../_lib/session.js'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (found) return json(toProfile(found.doc))
  const staleSession = await readSession(request)
  return json({ user: null }, 200, staleSession ? clearedCookie(request) : undefined)
})
