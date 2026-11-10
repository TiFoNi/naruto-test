import { randomUUID } from 'node:crypto'
import { ObjectId, type Collection } from 'mongodb'
import { PATRON_REACTIONS, REACTIONS, cardRank, isReaction } from '@nanda/game'
import { authSession } from './auth'
import { cardKey } from './dex'
import { cards, chatNews, chatRoom, pulse, users, type ChatBout, type ChatDoc, type ChatReact, type ChatReply, type ChatTag, type UserDoc } from './db'
import { gameData, isGame } from './games'
import { ownedTitles } from './profile'
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
  reply?: { id: string; userId: string; nickname: string; text: string }
  bout?: BoutLine
  reacts?: ReactLine[]
}

export type ReactLine = { kind: string; people: { id: string; nick: string }[] }

export const reactsOf = (reacts: ChatReact[] = []): ReactLine[] =>
  REACTIONS.map((kind) => ({
    kind,
    people: reacts.filter((one) => one.kind === kind).map((one) => ({ id: one.userId.toHexString(), nick: one.nick })),
  })).filter((one) => one.people.length)

export type BoutLine = {
  game: string
  rival?: { id: string; nickname: string; avatar: string | null; frame: string | null }
  pick?: { id: number; name: { ru: string; uk: string; en: string }; image?: string }
  levels?: [number, number]
}

const boutOf = (bout: ChatBout): BoutLine => ({
  game: bout.game,
  ...(bout.rival
    ? { rival: { id: bout.rival.id.toHexString(), nickname: bout.rival.nickname, avatar: bout.rival.avatar ?? null, frame: bout.rival.frame ?? null } }
    : {}),
  ...(bout.pick ? { pick: bout.pick } : {}),
  ...(bout.levels ? { levels: bout.levels } : {}),
})

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
  ...(doc.reply
    ? { reply: { id: doc.reply.id.toHexString(), userId: doc.reply.userId.toHexString(), nickname: doc.reply.nickname, text: doc.reply.text } }
    : {}),
  ...(doc.bout ? { bout: boutOf(doc.bout) } : {}),
  ...(doc.reacts?.length ? { reacts: reactsOf(doc.reacts) } : {}),
})

export const TAGS_MAX = 3
const TAG_GAP_MS = 5 * 60_000
const EVERYONE = /(^|\s)@(все|всех|усі|всім|all|everyone)(?=$|[\s.,!?:;])/i
const TYPED = /(?:^|\s)@([^\s@.,!?:;]{2,32})/g
const CROWD = new Set(['все', 'всех', 'усі', 'всім', 'all', 'everyone'])

const tagged = new Map<string, number>()

const PUSH_TEXT: Record<PushLang, { one: string; all: string; reply: string }> = {
  ru: { one: 'упомянул тебя в чате', all: 'Важное объявление', reply: 'ответил тебе в чате' },
  uk: { one: 'згадав тебе в чаті', all: 'Важливе оголошення', reply: 'відповів тобі в чаті' },
  en: { one: 'mentioned you in chat', all: 'Announcement', reply: 'replied to you in chat' },
}

export const REPLY_SNIPPET = 120

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

async function notifyTags(doc: UserDoc, line: ChatLine, tags: ChatTag[], reply = false) {
  const from = doc.nickname ?? doc.username
  const people = await users()
  await Promise.all(
    tags.map(async (tag) => {
      const key = `${doc._id!.toHexString()}:${tag.id.toHexString()}`
      if (Date.now() - (tagged.get(key) ?? 0) < TAG_GAP_MS) return
      tagged.set(key, Date.now())
      const target = await people.findOneAndUpdate(
        { _id: tag.id },
        { $push: { mentionNews: { $each: [{ id: line.id, fromId: doc._id!.toHexString(), from, text: line.text.slice(0, 160), at: new Date(), ...(reply ? { reply: true } : {}) }], $slice: -10 } } },
        { projection: { mentionPush: 1 } },
      )
      if (target && target.mentionPush !== false)
        await sendPush(tag.id, (lang) => ({ title: `${from} ${reply ? PUSH_TEXT[lang].reply : PUSH_TEXT[lang].one}`, body: line.text.slice(0, 140), url: `/${lang}?chat=1`, tag: 'mention' }))
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

export async function countPulse() {
  return (await pulse()).countDocuments({ at: { $gt: new Date(Date.now() - ALIVE_MS) } })
}

export async function touchPulse(key: string) {
  const beats = await pulse()
  await beats.updateOne({ _id: key }, { $set: { at: new Date() } }, { upsert: true })
  return countPulse()
}

export async function freshSince(seen: unknown) {
  if (typeof seen !== 'string' || !ObjectId.isValid(seen)) return false
  const found = await (await chatRoom()).findOne(
    { hidden: { $ne: true }, _id: { $gt: new ObjectId(seen) } },
    { projection: { _id: 1 } },
  )
  return Boolean(found)
}

export const freshFaces = async (docs: { userId: ObjectId }[]) => {
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

async function readReply(room: Collection<ChatDoc>, asked: unknown): Promise<ChatReply | null> {
  if (typeof asked !== 'string' || !ObjectId.isValid(asked)) return null
  const found = await room.findOne({ _id: new ObjectId(asked), hidden: { $ne: true } }, { projection: { userId: 1, nickname: 1, text: 1 } })
  return found ? { id: found._id!, userId: found.userId, nickname: found.nickname, text: found.text.slice(0, REPLY_SNIPPET) } : null
}

const muted = (doc: UserDoc) => Boolean(doc.chatMutedUntil && doc.chatMutedUntil.getTime() > Date.now())

async function pace(room: Collection<ChatDoc>, userId: ObjectId, text?: string) {
  const [last, lately] = await Promise.all([
    room.findOne({ userId }, { sort: { _id: -1 }, projection: { at: 1, text: 1 } }),
    room.countDocuments({ userId, at: { $gt: new Date(Date.now() - 60_000) } }),
  ])
  if (lately >= PER_MINUTE) return false
  if (last && Date.now() - last.at.getTime() < GAP_MS) return false
  return !(text !== undefined && last && last.text === text && Date.now() - last.at.getTime() < 60_000)
}

const authorOf = (doc: UserDoc) => ({
  userId: doc._id!,
  nickname: doc.nickname ?? doc.username,
  ...(doc.tag ? { tag: doc.tag } : {}),
  avatar: doc.avatar ?? null,
  frame: doc.frame ?? null,
  title: doc.title ?? null,
  nickTone: doc.nickTone ?? null,
})

export async function sendChat(doc: UserDoc, raw: unknown, picked?: unknown, replyTo?: unknown): Promise<ChatLine | ChatFail> {
  const text = tidy(raw)
  if (!text) return 'empty'
  if (muted(doc)) return 'muted'

  const room = await chatRoom()
  const userId = doc._id!
  if (!(await pace(room, userId, text))) return 'too_fast'

  const line: ChatDoc = { ...authorOf(doc), text, at: new Date() }
  const tags = await readTags(doc, text, picked)
  if (tags.length) line.tags = tags
  const reply = await readReply(room, replyTo)
  if (reply) line.reply = reply
  const saved = await room.insertOne(line)
  const done = lineOf({ ...line, _id: saved.insertedId })
  if (tags.length) void notifyTags(doc, done, tags).catch(() => undefined)
  const answered = reply && !reply.userId.equals(userId) && !tags.some((tag) => tag.id.equals(reply.userId))
  if (answered) void notifyTags(doc, done, [{ id: reply.userId, nick: reply.nickname }], true).catch(() => undefined)
  return done
}

export type ReactFail = 'bad' | 'muted' | 'patron' | 'too_fast' | 'gone'

const REACT_PER_MINUTE = 10
const reacted = new Map<string, number[]>()

export async function reactChat(doc: UserDoc, asked: unknown, kind: unknown): Promise<{ id: string; reacts: ReactLine[] } | ReactFail> {
  if (typeof asked !== 'string' || !ObjectId.isValid(asked)) return 'bad'
  if (kind !== null && !isReaction(kind)) return 'bad'
  if (muted(doc)) return 'muted'
  if (kind !== null && PATRON_REACTIONS.includes(kind) && !ownedTitles(doc).includes(BOUT_TITLE)) return 'patron'
  const userId = doc._id!
  const key = userId.toHexString()
  const now = Date.now()
  const recent = (reacted.get(key) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= REACT_PER_MINUTE) return 'too_fast'
  reacted.set(key, [...recent, now])
  const others = { $filter: { input: { $ifNull: ['$reacts', []] }, cond: { $ne: ['$$this.userId', userId] } } }
  const mine = { $literal: [{ userId, nick: doc.nickname ?? doc.username, kind }] }
  const done = await (await chatRoom()).findOneAndUpdate(
    { _id: new ObjectId(asked), hidden: { $ne: true } },
    [{ $set: { reacts: kind ? { $concatArrays: [others, mine] } : others } }],
    { returnDocument: 'after', projection: { reacts: 1 } },
  )
  return done ? { id: asked, reacts: reactsOf(done.reacts) } : 'gone'
}

export const BOUT_OPEN_MS = 10 * 60_000
export const BOUT_TEXT = '🃏'

export type BoutFail = 'bad' | 'muted' | 'patron' | 'too_fast' | 'cooldown' | 'open' | 'own' | 'gone' | 'taken'

export const BOUT_TITLE = 'patron'

export const BOUT_GAP_MS = 60_000

const openBout = (since = Date.now()) => ({ 'bout.game': { $exists: true }, 'bout.rival': { $exists: false }, hidden: { $ne: true }, at: { $gt: new Date(since - BOUT_OPEN_MS) } })

export const BOUT_SKIP = new Set(['tunes', 'shots'])

export async function sendBout(doc: UserDoc, game: unknown): Promise<ChatLine | BoutFail> {
  if (!isGame(game) || BOUT_SKIP.has(game)) return 'bad'
  if (!ownedTitles(doc).includes(BOUT_TITLE)) return 'patron'
  if (muted(doc)) return 'muted'
  const room = await chatRoom()
  const userId = doc._id!
  if (await room.findOne({ userId, ...openBout() }, { projection: { _id: 1 } })) return 'open'
  if (await room.findOne({ userId, 'bout.game': { $exists: true }, at: { $gt: new Date(Date.now() - BOUT_GAP_MS) } }, { projection: { _id: 1 } })) return 'cooldown'
  if (!(await pace(room, userId))) return 'too_fast'
  const line: ChatDoc = { ...authorOf(doc), text: BOUT_TEXT, at: new Date(), bout: { game } }
  const saved = await room.insertOne(line)
  return lineOf({ ...line, _id: saved.insertedId })
}

async function levelsOf(game: string, id: number, people: ObjectId[]) {
  const [found, owned] = await Promise.all([
    (await users()).find({ _id: { $in: people } }, { projection: { [`dex.${game}`]: 1 } }).toArray(),
    (await cards()).find({ _id: { $in: people.map((one) => cardKey(one, game, id)) } }, { projection: { xp: 1 } }).toArray(),
  ])
  const xp = new Map(owned.map((one) => [one._id, one.xp]))
  return people.map((one) => {
    const opened = found.find((user) => user._id!.equals(one))?.dex?.[game]?.includes(id)
    return opened ? cardRank(xp.get(cardKey(one, game, id)) ?? 0).level : 0
  }) as [number, number]
}

export async function joinBout(doc: UserDoc, asked: unknown): Promise<ChatLine | BoutFail> {
  if (typeof asked !== 'string' || !ObjectId.isValid(asked)) return 'bad'
  if (muted(doc)) return 'muted'
  const room = await chatRoom()
  const _id = new ObjectId(asked)
  const found = await room.findOne({ _id, hidden: { $ne: true } }, { projection: { userId: 1, at: 1, bout: 1 } })
  if (!found?.bout || !isGame(found.bout.game)) return 'gone'
  if (found.userId.equals(doc._id!)) return 'own'
  if (found.bout.rival) return 'taken'
  if (Date.now() - found.at.getTime() > BOUT_OPEN_MS) return 'gone'
  const { pool } = await gameData(found.bout.game)
  if (!pool.length) return 'gone'
  const entity = pool[Math.floor(Math.random() * pool.length)]!
  const levels = await levelsOf(found.bout.game, entity.id, [found.userId, doc._id!])
  const ru = typeof entity.name === 'string' ? entity.name : ''
  const pick = {
    id: entity.id,
    name: { ru, uk: typeof entity.nameUk === 'string' && entity.nameUk ? entity.nameUk : ru, en: typeof entity.nameEn === 'string' && entity.nameEn ? entity.nameEn : ru },
    ...(typeof entity.image === 'string' ? { image: entity.image } : {}),
  }
  const rival = { id: doc._id!, nickname: doc.nickname ?? doc.username, avatar: doc.avatar ?? null, frame: doc.frame ?? null }
  const done = await room.findOneAndUpdate(
    { _id, ...openBout() },
    { $set: { 'bout.rival': rival, 'bout.pick': pick, 'bout.levels': levels } },
    { returnDocument: 'after' },
  )
  return done ? lineOf(done) : 'taken'
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
