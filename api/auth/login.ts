import { users } from '../_lib/db.js'
import { parseCredentials } from '../_lib/credentials.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { verifyPassword } from '../_lib/password.js'
import { toProfile } from '../_lib/profile.js'
import { sessionCookie } from '../_lib/session.js'
import { clientIp, remember, tooMany } from '../_lib/throttle.js'

const PER_USER = 8
const PER_IP = 30

export const POST = handle(async (request) => {
  const credentials = parseCredentials(await readJson(request))
  if (typeof credentials === 'string') return fail(401, 'bad_credentials')

  const username = credentials.username.toLowerCase()
  const keys = [`login:user:${username}`, `login:ip:${clientIp(request)}`]
  if ((await tooMany([keys[0]], PER_USER)) || (await tooMany([keys[1]], PER_IP))) return fail(429, 'too_many')

  const doc = await (await users()).findOne({ usernameLower: username })
  if (!(await verifyPassword(credentials.password, doc?.passwordHash)) || !doc?._id) {
    await remember(keys)
    return fail(401, 'bad_credentials')
  }
  const profile = toProfile(doc)
  return json(profile, 200, await sessionCookie(request, profile.user))
})
