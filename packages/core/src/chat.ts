import { ObjectId } from 'mongodb'
import { chatRoom, users, type ChatDoc, type UserDoc } from './db'

export const CHAT_MAX = 300
const GAP_MS = 3000
const PER_MINUTE = 20
const PAGE = 50
const PAGE_MAX = 100

export type ChatLine = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  text: string
  at: number
}

export const lineOf = (doc: ChatDoc): ChatLine => ({
  id: doc._id!.toHexString(),
  userId: doc.userId.toHexString(),
  nickname: doc.nickname,
  ...(doc.tag ? { tag: doc.tag } : {}),
  avatar: doc.avatar ?? null,
  frame: doc.frame ?? null,
  text: doc.text,
  at: doc.at.getTime(),
})

const tidy = (text: unknown) =>
  typeof text === 'string'
    ? text
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, CHAT_MAX)
    : ''

export async function chatPage(before?: string, limit = PAGE) {
  const room = await chatRoom()
  const size = Math.min(Math.max(Math.trunc(limit) || PAGE, 1), PAGE_MAX)
  const older = before && ObjectId.isValid(before) ? { _id: { $lt: new ObjectId(before) } } : {}
  const found = await room
    .find({ hidden: { $ne: true }, ...older }, { sort: { _id: -1 }, limit: size + 1 })
    .toArray()
  const page = found.slice(0, size)
  return { lines: page.reverse().map(lineOf), more: found.length > size }
}

export type ChatFail = 'empty' | 'muted' | 'too_fast'

export async function sendChat(doc: UserDoc, raw: unknown): Promise<ChatLine | ChatFail> {
  const text = tidy(raw)
  if (!text) return 'empty'
  if (doc.chatMutedUntil && doc.chatMutedUntil.getTime() > Date.now()) return 'muted'

  const room = await chatRoom()
  const userId = doc._id!
  const [last, lately] = await Promise.all([
    room.findOne({ userId }, { sort: { _id: -1 }, projection: { at: 1, text: 1 } }),
    room.countDocuments({ userId, at: { $gt: new Date(Date.now() - 60_000) } }),
  ])
  if (lately >= PER_MINUTE) return 'too_fast'
  if (last && Date.now() - last.at.getTime() < GAP_MS) return 'too_fast'
  if (last && last.text === text && Date.now() - last.at.getTime() < 60_000) return 'too_fast'

  const line: ChatDoc = {
    userId,
    nickname: doc.nickname ?? doc.username,
    ...(doc.tag ? { tag: doc.tag } : {}),
    avatar: doc.avatar ?? null,
    frame: doc.frame ?? null,
    text,
    at: new Date(),
  }
  const saved = await room.insertOne(line)
  return lineOf({ ...line, _id: saved.insertedId })
}

export async function dropChat(id: unknown) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return false
  const gone = await (await chatRoom()).updateOne({ _id: new ObjectId(id) }, { $set: { hidden: true } })
  return gone.matchedCount > 0
}

export async function muteChat(id: unknown, minutes: unknown) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null
  const span = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.min(Math.max(Math.trunc(minutes), 0), 60 * 24 * 30) : 60
  const until = span > 0 ? new Date(Date.now() + span * 60_000) : null
  const marked = await (await users()).updateOne({ _id: new ObjectId(id) }, { $set: { chatMutedUntil: until } })
  return marked.matchedCount ? until : null
}
