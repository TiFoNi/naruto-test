import { users } from '../_lib/db.js'
import { parseCredentials } from '../_lib/credentials.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { verifyPassword } from '../_lib/password.js'
import { toProfile } from '../_lib/profile.js'
import { sessionCookie } from '../_lib/session.js'

export const POST = handle(async (request) => {
  const credentials = parseCredentials(await readJson(request))
  if (typeof credentials === 'string') return fail(401, 'bad_credentials')

  const doc = await (await users()).findOne({ usernameLower: credentials.username.toLowerCase() })
  if (!(await verifyPassword(credentials.password, doc?.passwordHash)) || !doc?._id) {
    return fail(401, 'bad_credentials')
  }
  const profile = toProfile(doc)
  return json(profile, 200, await sessionCookie(request, profile.user))
})
