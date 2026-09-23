import { users } from '../db'
import { parseCredentials } from '../credentials'
import { fail, handle, json, readJson } from '../http'
import { hashPassword, verifyPassword } from '../password'
import { currentUser, defaultNickname, toProfile } from '../profile'
import { clearedCookie, readSession, sessionCookie } from '../session'
import { clientIp, remember, tooMany } from '../throttle'

const LOGIN_PER_USER = 8
const LOGIN_PER_IP = 30
const REGISTER_PER_IP = 10

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (found) return json(toProfile(found.doc))
  const staleSession = await readSession(request)
  return json({ user: null }, 200, staleSession ? clearedCookie(request) : undefined)
})

export const POST = handle(async (request) => {
  const body = (await readJson(request)) as { action?: string }
  if (body?.action === 'logout') return json({ ok: true }, 200, clearedCookie(request))

  const credentials = parseCredentials(body)
  if (body?.action === 'register') {
    if (typeof credentials === 'string') return fail(400, credentials)
    return register(request, credentials)
  }
  if (body?.action === 'login') {
    if (typeof credentials === 'string') return fail(401, 'bad_credentials')
    return login(request, credentials)
  }
  return fail(400, 'bad_action')
})

async function login(request: Request, credentials: { username: string; password: string }) {
  const username = credentials.username.toLowerCase()
  const keys = [`login:user:${username}`, `login:ip:${clientIp(request)}`]
  if ((await tooMany([keys[0]], LOGIN_PER_USER)) || (await tooMany([keys[1]], LOGIN_PER_IP))) return fail(429, 'too_many')

  const doc = await (await users()).findOne({ usernameLower: username })
  if (!(await verifyPassword(credentials.password, doc?.passwordHash)) || !doc?._id) {
    await remember(keys)
    return fail(401, 'bad_credentials')
  }
  const profile = toProfile(doc)
  return json(profile, 200, await sessionCookie(request, profile.user))
}

async function register(request: Request, credentials: { username: string; password: string }) {
  const ipKey = `register:ip:${clientIp(request)}`
  if (await tooMany([ipKey], REGISTER_PER_IP)) return fail(429, 'too_many')
  await remember([ipKey])

  const doc = {
    username: credentials.username,
    usernameLower: credentials.username.toLowerCase(),
    passwordHash: await hashPassword(credentials.password),
    nickname: defaultNickname(credentials.username),
    createdAt: new Date(),
  }
  try {
    const { insertedId } = await (await users()).insertOne(doc)
    const profile = toProfile({ ...doc, _id: insertedId })
    return json(profile, 201, await sessionCookie(request, profile.user))
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail(409, 'taken')
    throw error
  }
}
