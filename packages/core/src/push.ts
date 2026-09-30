import type { Collection, ObjectId } from 'mongodb'
import { database, users } from './db'

export type PushSubDoc = {
  _id?: ObjectId
  userId: ObjectId
  endpoint: string
  keys: { p256dh: string; auth: string }
  createdAt: Date
}

export type PushPayload = { title: string; body: string; url: string; tag?: string }

export type PushLang = 'ru' | 'uk' | 'en'

const LANGS: PushLang[] = ['ru', 'uk', 'en']

type WebPush = typeof import('web-push')

const cache = globalThis as typeof globalThis & { __pushIndexed?: Promise<unknown>; __webPush?: Promise<WebPush> }

export const pushKey = () => process.env.VAPID_PUBLIC_KEY ?? null

const secrets = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || 'mailto:hello@nandaguessr.com' }
}

export async function pushSubs(): Promise<Collection<PushSubDoc>> {
  const collection = (await database()).collection<PushSubDoc>('pushSubs')
  cache.__pushIndexed ??= Promise.all([
    collection.createIndex({ endpoint: 1 }, { unique: true }),
    collection.createIndex({ userId: 1 }),
  ]).catch((error) => {
    cache.__pushIndexed = undefined
    throw error
  })
  await cache.__pushIndexed
  return collection
}

export async function savePushSub(userId: ObjectId, endpoint: string, keys: { p256dh: string; auth: string }) {
  await (await pushSubs()).updateOne(
    { endpoint },
    { $set: { userId, keys }, $setOnInsert: { endpoint, createdAt: new Date() } },
    { upsert: true },
  )
}

export async function dropPushSub(userId: ObjectId, endpoint?: string) {
  const filter = endpoint ? { userId, endpoint } : { userId }
  await (await pushSubs()).deleteMany(filter)
}

export async function hasPushSub(userId: ObjectId) {
  return (await (await pushSubs()).countDocuments({ userId }, { limit: 1 })) > 0
}

async function sender() {
  const config = secrets()
  if (!config) return null
  cache.__webPush ??= import('web-push').then((module) => {
    const lib = (module as unknown as { default?: WebPush }).default ?? module
    lib.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    return lib
  })
  return cache.__webPush
}

export async function sendPush(userId: ObjectId, make: (lang: PushLang) => PushPayload) {
  const lib = await sender()
  if (!lib) return
  const collection = await pushSubs()
  const subs = await collection.find({ userId }).toArray()
  if (!subs.length) return

  const doc = await (await users()).findOne({ _id: userId }, { projection: { lang: 1 } })
  const lang = LANGS.includes(doc?.lang as PushLang) ? (doc?.lang as PushLang) : 'ru'
  const body = JSON.stringify(make(lang))
  const gone: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await lib.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 600 })
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 400 || status === 403 || status === 404 || status === 410) gone.push(sub.endpoint)
      }
    }),
  )

  if (gone.length) await collection.deleteMany({ endpoint: { $in: gone } })
}
