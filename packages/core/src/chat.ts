import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { authSession } from './auth'
import { chatNews, chatRoom, pulse, users, type ChatDoc, type ChatTag, type UserDoc } from './db'
import { pushSubs, sendPush, type PushLang } from './push'
import { readGuest } from './session'

export const CHAT_MAX = 300
export const NEWS_MAX = 1500
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
  title?: string | null
  nickTone?: string | null
  text: string
  at: number
  tags?: { id: string; nick: string }[]
  everyone?: boolean
}

export const lineOf = (doc: ChatDoc): ChatLine => ({
  id: doc._id!.toHexString(),
  userId: doc.userId.toHexString(),
  nickname: doc.nickname,
  ...(doc.tag ? { tag: doc.tag } : {}),
  avatar: doc.avatar ?? null,
  frame: doc.frame ?? null,
  title: doc.title ?? null,
  nickTone: doc.nickTone ?? null,
  text: doc.text,
  at: doc.at.getTime(),
  ...(doc.tags?.length ? { tags: doc.tags.map((tag) => ({ id: tag.id.toHexString(), nick: tag.nick })) } : {}),
  ...(doc.everyone ? { everyone: true } : {}),
})

export const TAGS_MAX = 3
const TAG_GAP_MS = 5 * 60_000
const EVERYONE = /(^|\s)@(все|всех|усі|всім|all|everyone)(?=$|[\s.,!?:;])/i
const TYPED = /(?:^|\s)@([^\s@.,!?:;]{2,32})/g
const CROWD = new Set(['все', 'всех', 'усі', 'всім', 'all', 'everyone'])

const tagged = new Map<string, number>()

const PUSH_TEXT: Record<PushLang, { one: string; all: string }> = {
  ru: { one: 'упомянул тебя в чате', all: 'Важное объявление' },
  uk: { one: 'згадав тебе в чаті', all: 'Важливе оголошення' },
  en: { one: 'mentioned you in chat', all: 'Announcement' },
}

const mentions = (text: string, nick: string) => text.toLowerCase().includes(`@${nick.toLowerCase()}`)

async function readTags(doc: UserDoc, text: string, picked: unknown): Promise<ChatTag[]> {
  const self = doc._id!.toHexString()
  const chosen = (Array.isArray(picked) ? picked : []).filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id) && id !== self).slice(0, TAGS_MAX)
  const people = await users()
  const found = chosen.length
    ? await people.find({ _id: { $in: chosen.map((id) => new ObjectId(id)) } }, { projection: { nickname: 1, username: 1 } }).toArray()
    : []
  const tags: ChatTag[] = found
    .map((one) => ({ id: one._id!, nick: one.nickname ?? one.username }))
    .filter((tag) => mentions(text, tag.nick))
  const names = [...new Set([...text.matchAll(TYPED)].map((hit) => hit[1].toLowerCase()))].filter(
    (name) => !CROWD.has(name) && !tags.some((tag) => tag.nick.toLowerCase() === name),
  )
  for (const name of names) {
    if (tags.length >= TAGS_MAX) break
    const same = await people.find({ nicknameLower: name }, { projection: { nickname: 1, username: 1 }, limit: 2 }).toArray()
    if (same.length !== 1 || same[0]._id!.toHexString() === self) continue
    tags.push({ id: same[0]._id!, nick: same[0].nickname ?? same[0].username })
  }
  return tags.slice(0, TAGS_MAX)
}

async function notifyTags(doc: UserDoc, line: ChatLine, tags: ChatTag[]) {
  const from = doc.nickname ?? doc.username
  const people = await users()
  await Promise.all(
    tags.map(async (tag) => {
      const key = `${doc._id!.toHexString()}:${tag.id.toHexString()}`
      if (Date.now() - (tagged.get(key) ?? 0) < TAG_GAP_MS) return
      tagged.set(key, Date.now())
      const target = await people.findOneAndUpdate(
        { _id: tag.id },
        { $push: { mentionNews: { $each: [{ id: line.id, fromId: doc._id!.toHexString(), from, text: line.text.slice(0, 160), at: new Date() }], $slice: -10 } } },
        { projection: { mentionPush: 1 } },
      )
      if (target && target.mentionPush !== false)
        await sendPush(tag.id, (lang) => ({ title: `${from} ${PUSH_TEXT[lang].one}`, body: line.text.slice(0, 140), url: `/${lang}?chat=1`, tag: 'mention' }))
    }),
  )
  if (tagged.size > 5000) tagged.clear()
}

async function notifyEveryone(line: ChatLine) {
  const ids = await (await pushSubs()).distinct('userId')
  const muted = new Set(
    (await (await users()).find({ _id: { $in: ids }, mentionPush: false }, { projection: { _id: 1 } }).toArray()).map((one) => one._id!.toHexString()),
  )
  for (const id of ids) {
    if (muted.has(id.toHexString())) continue
    await sendPush(id, (lang) => ({ title: PUSH_TEXT[lang].all, body: line.text.slice(0, 140), url: `/${lang}?chat=news`, tag: 'news' })).catch(() => undefined)
  }
}

export type ChatChannel = 'chat' | 'news'

export const channelOf = (value: unknown): ChatChannel => (value === 'news' ? 'news' : 'chat')

const roomOf = (channel: ChatChannel) => (channel === 'news' ? chatNews() : chatRoom())

export const tidy = (text: unknown, max = CHAT_MAX) =>
  typeof text === 'string'
    ? text
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : ''

const NEWS_KEEP_MS = 30_000

let newsTop: { at: number; id: string | null } | null = null

export async function latestNews() {
  if (newsTop && Date.now() - newsTop.at < NEWS_KEEP_MS) return newsTop.id
  const found = await (await chatNews()).findOne({ hidden: { $ne: true } }, { sort: { _id: -1 }, projection: { _id: 1 } })
  newsTop = { at: Date.now(), id: found?._id?.toHexString() ?? null }
  return newsTop.id
}

export async function watcherKey(request: Request) {
  const session = await authSession(request).catch(() => null)
  if (session?.id) return `u:${session.id}`
  const guest = await readGuest(request).catch(() => null)
  if (guest) return `g:${guest}`
  const own = new URL(request.url).searchParams.get('who')
  return own && /^[A-Za-z0-9-]{8,64}$/.test(own) ? `w:${own}` : `x:${randomUUID()}`
}

const ALIVE_MS = 90_000

export async function touchPulse(key: string) {
  const beats = await pulse()
  await beats.updateOne({ _id: key }, { $set: { at: new Date() } }, { upsert: true })
  return beats.countDocuments({ at: { $gt: new Date(Date.now() - ALIVE_MS) } })
}

export async function freshSince(seen: unknown) {
  if (typeof seen !== 'string' || !ObjectId.isValid(seen)) return false
  const found = await (await chatRoom()).findOne(
    { hidden: { $ne: true }, _id: { $gt: new ObjectId(seen) } },
    { projection: { _id: 1 } },
  )
  return Boolean(found)
}

const freshFaces = async (docs: ChatDoc[]) => {
  const ids = [...new Set(docs.map((one) => one.userId.toHexString()))].map((id) => new ObjectId(id))
  if (!ids.length) return new Map<string, Pick<UserDoc, 'nickname' | 'tag' | 'avatar' | 'frame' | 'title' | 'nickTone'>>()
  const found = await (await users())
    .find({ _id: { $in: ids } }, { projection: { nickname: 1, tag: 1, avatar: 1, frame: 1, title: 1, nickTone: 1 } })
    .toArray()
  return new Map(found.map((one) => [one._id!.toHexString(), one]))
}

export async function chatPage(before?: string, limit = PAGE, channel: ChatChannel = 'chat') {
  const room = await roomOf(channel)
  const size = Math.min(Math.max(Math.trunc(limit) || PAGE, 1), PAGE_MAX)
  const older = before && ObjectId.isValid(before) ? { _id: { $lt: new ObjectId(before) } } : {}
  const found = await room
    .find({ hidden: { $ne: true }, ...older }, { sort: { _id: -1 }, limit: size + 1 })
    .toArray()
  const page = found.slice(0, size)
  const faces = await freshFaces(page)
  const fresh = (doc: ChatDoc): ChatDoc => {
    const now = faces.get(doc.userId.toHexString())
    return now
      ? { ...doc, nickname: now.nickname ?? doc.nickname, tag: now.tag ?? doc.tag, avatar: now.avatar ?? null, frame: now.frame ?? null, title: now.title ?? null, nickTone: now.nickTone ?? null }
      : doc
  }
  return { lines: page.reverse().map((doc) => lineOf(fresh(doc))), more: found.length > size }
}

export type ChatFail = 'empty' | 'muted' | 'too_fast'

export async function sendChat(doc: UserDoc, raw: unknown, picked?: unknown): Promise<ChatLine | ChatFail> {
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
    title: doc.title ?? null,
    nickTone: doc.nickTone ?? null,
    text,
    at: new Date(),
  }
  const tags = await readTags(doc, text, picked)
  if (tags.length) line.tags = tags
  const saved = await room.insertOne(line)
  const done = lineOf({ ...line, _id: saved.insertedId })
  if (tags.length) void notifyTags(doc, done, tags).catch(() => undefined)
  return done
}

export async function sendNews(doc: UserDoc, raw: unknown): Promise<ChatLine | 'empty'> {
  const text = tidy(raw, NEWS_MAX)
  if (!text) return 'empty'
  const everyone = EVERYONE.test(text)
  const line: ChatDoc = {
    userId: doc._id!,
    nickname: doc.nickname ?? doc.username,
    ...(doc.tag ? { tag: doc.tag } : {}),
    avatar: doc.avatar ?? null,
    frame: doc.frame ?? null,
    title: doc.title ?? null,
    nickTone: doc.nickTone ?? null,
    text,
    at: new Date(),
    ...(everyone ? { everyone: true } : {}),
  }
  const saved = await (await chatNews()).insertOne(line)
  newsTop = { at: Date.now(), id: saved.insertedId.toHexString() }
  const done = lineOf({ ...line, _id: saved.insertedId })
  if (everyone) void notifyEveryone(done).catch(() => undefined)
  return done
}

export async function dropChat(id: unknown, channel: ChatChannel = 'chat') {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return false
  const gone = await (await roomOf(channel)).updateOne({ _id: new ObjectId(id) }, { $set: { hidden: true } })
  if (channel === 'news') newsTop = null
  return gone.matchedCount > 0
}

export async function muteChat(id: unknown, minutes: unknown) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null
  const span = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.min(Math.max(Math.trunc(minutes), 0), 60 * 24 * 30) : 60
  const until = span > 0 ? new Date(Date.now() + span * 60_000) : null
  const marked = await (await users()).updateOne({ _id: new ObjectId(id) }, { $set: { chatMutedUntil: until } })
  return marked.matchedCount ? until : null
}
