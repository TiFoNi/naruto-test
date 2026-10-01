import { ObjectId, type Collection } from 'mongodb'
import { database, users } from './db'
import { defaultNickname } from './profile'
import { sendPush, type PushLang } from './push'

export type FriendDoc = {
  _id?: ObjectId
  pair: string
  fromId: ObjectId
  toId: ObjectId
  status: 'pending' | 'accepted'
  createdAt: Date
  answeredAt?: Date
}

export type FriendState = 'none' | 'out' | 'in' | 'friends'

export type FriendPerson = { id: string; nickname: string; tag: string | null; at: string }

const cache = globalThis as typeof globalThis & { __friendsIndexed?: Promise<unknown> }

const pairOf = (one: ObjectId, two: ObjectId) => [one.toHexString(), two.toHexString()].sort().join(':')

export async function friends(): Promise<Collection<FriendDoc>> {
  const collection = (await database()).collection<FriendDoc>('friends')
  cache.__friendsIndexed ??= Promise.all([
    collection.createIndex({ pair: 1 }, { unique: true }),
    collection.createIndex({ toId: 1, status: 1 }),
    collection.createIndex({ fromId: 1, status: 1 }),
  ]).catch((error) => {
    cache.__friendsIndexed = undefined
    throw error
  })
  await cache.__friendsIndexed
  return collection
}

const FRIEND_PUSH: Record<PushLang, (name: string) => string> = {
  ru: (name) => `${name} хочет дружить`,
  uk: (name) => `${name} хоче дружити`,
  en: (name) => `${name} wants to be friends`,
}

const nameOf = async (userId: ObjectId) => {
  const doc = await (await users()).findOne({ _id: userId }, { projection: { nickname: 1, username: 1 } })
  return doc?.nickname ?? defaultNickname(doc?.username ?? '')
}

async function cards(ids: ObjectId[], when: Map<string, Date>): Promise<FriendPerson[]> {
  if (!ids.length) return []
  const list = await (await users())
    .find({ _id: { $in: ids } }, { projection: { nickname: 1, username: 1, tag: 1 } })
    .toArray()

  return list
    .map((doc) => {
      const id = doc._id!.toHexString()
      return {
        id,
        nickname: doc.nickname ?? defaultNickname(doc.username),
        tag: doc.tag ?? null,
        at: (when.get(id) ?? new Date()).toISOString(),
      }
    })
    .sort((one, two) => one.nickname.localeCompare(two.nickname))
}

export async function friendList(userId: ObjectId) {
  const list = await (await friends())
    .find({ status: 'accepted', $or: [{ fromId: userId }, { toId: userId }] })
    .toArray()

  const when = new Map<string, Date>()
  const ids = list.map((doc) => {
    const other = doc.fromId.equals(userId) ? doc.toId : doc.fromId
    when.set(other.toHexString(), doc.answeredAt ?? doc.createdAt)
    return other
  })

  return cards(ids, when)
}

export async function friendIds(userId: ObjectId) {
  const list = await (await friends())
    .find({ status: 'accepted', $or: [{ fromId: userId }, { toId: userId }] }, { projection: { fromId: 1, toId: 1 } })
    .toArray()

  return new Set(list.map((doc) => (doc.fromId.equals(userId) ? doc.toId : doc.fromId).toHexString()))
}

export async function friendRequests(userId: ObjectId) {
  const list = await (await friends()).find({ status: 'pending', toId: userId }).toArray()
  const when = new Map(list.map((doc) => [doc.fromId.toHexString(), doc.createdAt]))
  return cards(
    list.map((doc) => doc.fromId),
    when,
  )
}

export async function friendOutgoing(userId: ObjectId) {
  const list = await (await friends()).find({ status: 'pending', fromId: userId }).toArray()
  const when = new Map(list.map((doc) => [doc.toId.toHexString(), doc.createdAt]))
  return cards(
    list.map((doc) => doc.toId),
    when,
  )
}

export async function friendState(userId: ObjectId, otherId: ObjectId): Promise<FriendState> {
  if (userId.equals(otherId)) return 'none'
  const doc = await (await friends()).findOne({ pair: pairOf(userId, otherId) })
  if (!doc) return 'none'
  if (doc.status === 'accepted') return 'friends'
  return doc.fromId.equals(userId) ? 'out' : 'in'
}

export async function askFriend(userId: ObjectId, targetId: ObjectId): Promise<FriendState | 'missing'> {
  if (userId.equals(targetId)) return 'none'
  const target = await (await users()).findOne({ _id: targetId }, { projection: { _id: 1 } })
  if (!target) return 'missing'

  const collection = await friends()
  const pair = pairOf(userId, targetId)
  const found = await collection.findOne({ pair })

  if (found?.status === 'accepted') return 'friends'
  if (found) {
    if (found.fromId.equals(userId)) return 'out'
    await collection.updateOne({ _id: found._id }, { $set: { status: 'accepted', answeredAt: new Date() } })
    return 'friends'
  }

  await collection.insertOne({ pair, fromId: userId, toId: targetId, status: 'pending', createdAt: new Date() })
  const name = await nameOf(userId)
  void sendPush(targetId, (lang) => ({
    title: 'NandaGuessr',
    body: FRIEND_PUSH[lang](name),
    url: '/',
    tag: `friend-${userId.toHexString()}-${Date.now()}`,
  }))
  return 'out'
}

export async function answerFriend(userId: ObjectId, otherId: ObjectId, accept: boolean) {
  const collection = await friends()
  const found = await collection.findOne({ pair: pairOf(userId, otherId), status: 'pending', toId: userId })
  if (!found) return false
  if (accept) await collection.updateOne({ _id: found._id }, { $set: { status: 'accepted', answeredAt: new Date() } })
  else await collection.deleteOne({ _id: found._id })
  return true
}

export async function dropFriend(userId: ObjectId, otherId: ObjectId) {
  const { deletedCount } = await (await friends()).deleteOne({
    pair: pairOf(userId, otherId),
    $or: [{ fromId: userId }, { toId: userId }],
  })
  return deletedCount > 0
}
