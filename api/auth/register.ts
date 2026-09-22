import { users } from '../_lib/db.js'
import { parseCredentials } from '../_lib/credentials.js'
import { fail, handle, json, readJson } from '../_lib/http.js'
import { hashPassword } from '../_lib/password.js'
import { defaultNickname, toProfile } from '../_lib/profile.js'
import { sessionCookie } from '../_lib/session.js'

export const POST = handle(async (request) => {
  const credentials = parseCredentials(await readJson(request))
  if (typeof credentials === 'string') return fail(400, credentials)

  const collection = await users()
  const doc = {
    username: credentials.username,
    usernameLower: credentials.username.toLowerCase(),
    passwordHash: await hashPassword(credentials.password),
    nickname: defaultNickname(credentials.username),
    createdAt: new Date(),
  }
  try {
    const { insertedId } = await collection.insertOne(doc)
    const profile = toProfile({ ...doc, _id: insertedId })
    return json(profile, 201, await sessionCookie(request, profile.user))
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail(409, 'taken')
    throw error
  }
})
