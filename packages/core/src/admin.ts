import type { ObjectId } from 'mongodb'
import { authSession } from './auth'
import { users } from './db'

const allowed = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )

export async function adminSession(request: Request) {
  const session = await authSession(request)
  if (!session?.email) return null
  return allowed().has(session.email.toLowerCase()) ? session : null
}

const ADMIN_KEEP_MS = 60_000
const known = new Map<string, { at: number; yes: boolean }>()

export async function adminUser(userId: ObjectId) {
  const key = userId.toHexString()
  const hit = known.get(key)
  if (hit && Date.now() - hit.at < ADMIN_KEEP_MS) return hit.yes
  const doc = await (await users()).findOne({ _id: userId }, { projection: { username: 1, usernameLower: 1 } })
  const yes = allowed().has(String(doc?.usernameLower ?? doc?.username ?? '').toLowerCase())
  known.set(key, { at: Date.now(), yes })
  return yes
}
