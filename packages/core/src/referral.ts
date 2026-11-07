import { randomInt } from 'node:crypto'
import type { Collection } from 'mongodb'
import { credit } from './coins'
import { users, type UserDoc } from './db'
import { mailKey } from './email'
import { levelOf } from './quests'

export const REF_REWARD = 100
export const REF_LEVEL = 40
export const REF_COOKIE = 'nanda_ref'

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7
const CODE_TRIES = 5
const CODE_SHAPE = /^[A-Z2-9]{7}$/

const makeCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ABC[randomInt(CODE_ABC.length)]).join('')

const cookieCode = (request: Request) => {
  const raw = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === REF_COOKIE)?.[1]
  const code = raw ? decodeURIComponent(raw).toUpperCase() : ''
  return CODE_SHAPE.test(code) ? code : null
}

const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000

export async function refCode(doc: UserDoc) {
  if (doc.ref) return doc.ref
  const collection = await users()
  for (let attempt = 0; attempt < CODE_TRIES; attempt++) {
    const code = makeCode()
    try {
      const saved = await collection.findOneAndUpdate({ _id: doc._id, ref: { $exists: false } }, { $set: { ref: code } }, { returnDocument: 'after' })
      if (saved?.ref) return saved.ref
      const fresh = await collection.findOne({ _id: doc._id }, { projection: { ref: 1 } })
      if (fresh?.ref) return fresh.ref
    } catch (error) {
      if (!duplicate(error)) throw error
    }
  }
  throw new Error('referral code collision')
}

export async function newcomerFields(collection: Collection<UserDoc>, request: Request, email: string): Promise<Partial<UserDoc>> {
  const key = mailKey(email)
  const code = cookieCode(request)
  if (!code) return { mailKey: key }
  const [inviter, twin] = await Promise.all([
    collection.findOne({ ref: code }, { projection: { _id: 1, username: 1 } }),
    collection.findOne({ mailKey: key }, { projection: { _id: 1 } }),
  ])
  if (!inviter?._id || twin || mailKey(inviter.username) === key) return { mailKey: key }
  return { mailKey: key, referredBy: inviter._id }
}

export async function payReferral(doc: UserDoc) {
  if (!doc.referredBy || doc.refPaid || levelOf(doc.xp ?? 0) < REF_LEVEL) return
  await credit(doc._id!, doc.referredBy, REF_REWARD, 'referral')
  await (await users()).updateOne({ _id: doc._id, refPaid: { $exists: false } }, { $set: { refPaid: new Date() } })
}

export async function referralBoard(doc: UserDoc) {
  const collection = await users()
  const [code, invited, paid] = await Promise.all([
    refCode(doc),
    collection.countDocuments({ referredBy: doc._id }),
    collection.countDocuments({ referredBy: doc._id, refPaid: { $exists: true } }),
  ])
  return { code, invited, paid, earned: paid * REF_REWARD, reward: REF_REWARD, level: REF_LEVEL }
}
