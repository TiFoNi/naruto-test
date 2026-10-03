import { randomInt } from 'node:crypto'
import { ObjectId, type Collection, type Filter } from 'mongodb'
import {
  DAILY_KEYS,
  DAILY_XP_FACTOR,
  DAILY_XP_MODES,
  MODE_XP,
  MODE_XP_AFTER,
  STAT_KEYS,
  XP_CAPS,
  type ModeId,
  type XpSource,
} from '@nanda/game'
import { shiftDay, today } from './daily'
import { users, type Stats, type UserDoc } from './db'
import { levelOf } from './quests'
import { addSeasonXp, touchSeasonDay } from './season'
import { fail } from './http'
import { authSession } from './auth'
import { guestCookie, readGuest } from './session'

export { STAT_KEYS }

const NICKNAME = /^[\p{L}\p{N} _.\-]{2,24}$/u

export function defaultNickname(username: string) {
  const base = username.split('@')[0].replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 24)
  return base.length >= 2 ? base : 'Player'
}

export const lowerNickname = (nickname: string) => nickname.toLowerCase()

const TAG_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const TAG_LENGTH = 5

export const makeTag = () => Array.from({ length: TAG_LENGTH }, () => TAG_CHARS[randomInt(TAG_CHARS.length)]).join('')

export const parseTag = (value: unknown) => {
  const tag = String(value ?? '').trim().toUpperCase()
  return tag.length === TAG_LENGTH && [...tag].every((char) => TAG_CHARS.includes(char)) ? tag : null
}

export async function claimTag(collection: Collection<UserDoc>, userId: ObjectId, nicknameLower: string, keep?: string) {
  const free = async (tag: string) => !(await collection.findOne({ _id: { $ne: userId }, nicknameLower, tag }, { projection: { _id: 1 } }))
  if (keep && (await free(keep))) return keep

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const tag = makeTag()
    if (!(await free(tag))) continue
    await collection.updateOne({ _id: userId }, { $set: { tag } })
    return tag
  }
  return keep ?? null
}

export async function ensureTag(collection: Collection<UserDoc>, doc: UserDoc) {
  if (doc.tag) return doc.tag
  const lower = doc.nicknameLower ?? lowerNickname(doc.nickname ?? defaultNickname(doc.username))
  doc.tag = (await claimTag(collection, doc._id!, lower)) ?? undefined
  return doc.tag ?? null
}

export async function searchPlayers(userId: ObjectId, asked: unknown, limit = 6) {
  const raw = String(asked ?? '').trim().slice(0, 32)
  const [namePart, tagPart] = raw.split('#')
  const name = namePart.trim().toLowerCase()
  const tag = tagPart === undefined ? null : parseTag(tagPart)
  const idTag = tagPart === undefined ? parseTag(namePart) : null

  const or: Filter<UserDoc>[] = []
  if (name.length >= 2) or.push({ nicknameLower: { $gte: name, $lt: `${name}\uffff` }, ...(tag ? { tag } : {}) })
  else if (tag) or.push({ tag })
  if (idTag) or.push({ tag: idTag })
  if (!or.length) return []

  const list = await (await users())
    .find(
      { _id: { $ne: userId }, ...(or.length === 1 ? or[0] : { $or: or }) },
      { projection: { nickname: 1, username: 1, tag: 1, avatar: 1 }, sort: { nicknameLower: 1 } },
    )
    .limit(limit)
    .toArray()

  return list.map((doc) => ({
    id: doc._id!.toHexString(),
    nickname: doc.nickname ?? defaultNickname(doc.username),
    tag: doc.tag ?? null,
    avatar: doc.avatar ?? null,
  }))
}

export function parseNickname(value: unknown): string | null {
  const nickname = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return NICKNAME.test(nickname) ? nickname : null
}

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export function normalizeStats(stats: Partial<Stats> | undefined): Stats {
  return {
    solved: number(stats?.solved),
    streak: number(stats?.streak),
    best: number(stats?.best),
    totalGuesses: number(stats?.totalGuesses),
    skipped: number(stats?.skipped),
  }
}

export function dailyStats(stats: Partial<Stats> | undefined) {
  const base = normalizeStats(stats)
  const day = today()
  const alive = stats?.lastDay === day || stats?.lastDay === shiftDay(day, -1)
  return { ...base, streak: alive ? base.streak : 0, lastDay: stats?.lastDay ?? null }
}

export async function applyDailyResult(collection: Collection<UserDoc>, userId: ObjectId, key: string, day: string, guesses: number) {
  const doc = await collection.findOne({ _id: userId }, { projection: { [`stats.${key}`]: 1 } })
  const prev = doc?.stats?.[key]
  const base = normalizeStats(prev)
  if (prev?.lastDay === day) return dailyStats(prev)
  const streak = prev?.lastDay === shiftDay(day, -1) ? base.streak + 1 : 1
  const next = { ...base, solved: base.solved + 1, streak, best: Math.max(base.best, streak), totalGuesses: base.totalGuesses + guesses, lastDay: day }
  await collection.updateOne({ _id: userId }, { $set: { [`stats.${key}`]: next }, $inc: { solvedTotal: 1 } })
  return dailyStats(next)
}

export async function awardSolveXp(collection: Collection<UserDoc>, userId: ObjectId, mode: ModeId, source: XpSource) {
  const extra = source === 'daily' && DAILY_XP_MODES.includes(mode) ? DAILY_XP_FACTOR : 1
  return addXp(collection, userId, MODE_XP[mode] * extra, source, mode)
}

export async function addXp(
  collection: Collection<UserDoc>,
  userId: ObjectId,
  amount: number,
  source: XpSource,
  mode?: ModeId,
) {
  if (amount <= 0) return null
  const day = today()
  const carry = (field: XpSource) => ({ $cond: [{ $eq: ['$xpToday.day', day] }, orZero(`xpToday.${field}`), 0] })
  const after = mode ? MODE_XP_AFTER[mode] : 1

  const doc = await collection.findOneAndUpdate(
    { _id: userId },
    [
      { $set: { xpToday: { day, daily: carry('daily'), endless: carry('endless'), duel: carry('duel') } } },
      {
        $set: {
          xpGain: { $cond: [{ $lt: [`$xpToday.${source}`, XP_CAPS[source]] }, amount, after] },
        },
      },
      { $set: { [`xpToday.${source}`]: { $add: [`$xpToday.${source}`, '$xpGain'] }, xp: { $add: [orZero('xp'), '$xpGain'] } } },
    ],
    { returnDocument: 'after' },
  )
  if (!doc) return null
  await addSeasonXp(userId, number(doc.xpGain))
  const xp = number(doc.xp)
  return { xp, level: levelOf(xp), today: todayXp(doc) }
}

export function todayXp(doc: UserDoc) {
  const fresh = doc.xpToday?.day === today()
  const earned = (source: XpSource) => (fresh ? number(doc.xpToday?.[source]) : 0)
  return {
    earned: earned('daily') + earned('endless'),
    cap: XP_CAPS.daily + XP_CAPS.endless,
    sources: (Object.keys(XP_CAPS) as XpSource[]).map((source) => ({ source, earned: earned(source), cap: XP_CAPS[source] })),
  }
}

const VISIT_DAYS = 14

const alive = (visit: UserDoc['visit']) => visit?.lastDay === today() || visit?.lastDay === shiftDay(today(), -1)

const LANGS = new Set(['ru', 'uk', 'en'])

export async function rememberLang(collection: Collection<UserDoc>, userId: ObjectId, request: Request) {
  const lang = request.headers.get('x-nanda-lang')
  if (!lang || !LANGS.has(lang)) return
  await collection.updateOne({ _id: userId }, { $addToSet: { langs: lang }, $set: { lang } })
}

export async function touchVisit(collection: Collection<UserDoc>, userId: ObjectId) {
  const day = today()
  await touchSeasonDay(userId, day)
  const doc = await collection.findOne({ _id: userId }, { projection: { visit: 1 } })
  const prev = doc?.visit
  if (prev?.lastDay === day) return prev

  const streak = prev?.lastDay === shiftDay(day, -1) ? prev.streak + 1 : 1
  const days = [...new Set([...(prev?.days ?? []), day])].sort().slice(-VISIT_DAYS)
  const visit = { lastDay: day, streak, best: Math.max(prev?.best ?? 0, streak), days }
  await collection.updateOne({ _id: userId }, { $set: { visit } })
  return visit
}

export function toProfile(doc: UserDoc) {
  const xp = number(doc.xp)

  return {
    user: {
      id: doc._id!.toHexString(),
      username: doc.username,
      nickname: doc.nickname ?? defaultNickname(doc.username),
      tag: doc.tag ?? null,
      avatar: doc.avatar ?? null,
      frame: doc.frame ?? null,
      frames: doc.frames ?? [],
      level: levelOf(xp),
      xp,
      today: todayXp(doc),
      streak: alive(doc.visit) ? (doc.visit?.streak ?? 0) : 0,
      bestStreak: doc.visit?.best ?? 0,
    },
    stats: Object.fromEntries([
      ...STAT_KEYS.map((key) => [key, normalizeStats(doc.stats?.[key])]),
      ...DAILY_KEYS.map((key) => [key, dailyStats(doc.stats?.[key])]),
    ]),
    challenges: { solved: number(doc.challengeStats?.solved) },
    duels: {
      played: number(doc.duelStats?.played),
      wins: number(doc.duelStats?.wins),
      losses: number(doc.duelStats?.losses),
      draws: number(doc.duelStats?.draws),
    },
  }
}

export async function currentUser(request: Request) {
  const session = await authSession(request)
  if (!session || !ObjectId.isValid(session.id)) return null

  const collection = await users()
  const _id = new ObjectId(session.id)
  const existing = await collection.findOne({ _id })
  if (existing) {
    await ensureTag(collection, existing)
    return { doc: existing, collection }
  }

  const name = defaultNickname(session.name || session.email)
  const doc: UserDoc = {
    _id,
    username: session.email,
    usernameLower: session.email.toLowerCase(),
    nickname: name,
    nicknameLower: lowerNickname(name),
    tag: makeTag(),
    createdAt: new Date(),
  }
  await collection.insertOne(doc)
  return { doc, collection }
}

export const unauthorized = () => fail(401, 'unauthorized')

export type Owner = { id: ObjectId; guest: boolean; cookie?: string }

export async function roundOwner(request: Request): Promise<Owner> {
  const session = await authSession(request)
  if (session && ObjectId.isValid(session.id)) return { id: new ObjectId(session.id), guest: false }

  const existing = await readGuest(request)
  if (existing && ObjectId.isValid(existing)) return { id: new ObjectId(existing), guest: true }

  const id = new ObjectId()
  return { id, guest: true, cookie: await guestCookie(request, id.toHexString()) }
}


const orZero = (path: string) => ({ $ifNull: [`$${path}`, 0] })

export async function applySkip(collection: Collection<UserDoc>, userId: ObjectId, key: string) {
  const doc = await collection.findOneAndUpdate(
    { _id: userId },
    { $inc: { [`stats.${key}.skipped`]: 1 }, $set: { [`stats.${key}.streak`]: 0 } },
    { returnDocument: 'after', projection: { [`stats.${key}`]: 1 } },
  )
  return normalizeStats(doc?.stats?.[key])
}

export async function applyResult(collection: Collection<UserDoc>, userId: ObjectId, key: string, won: boolean, guesses: number) {
  const path = `stats.${key}`
  const update = won
    ? [
        {
          $set: {
            [path]: {
              solved: { $add: [orZero(`${path}.solved`), 1] },
              streak: { $add: [orZero(`${path}.streak`), 1] },
              best: { $max: [orZero(`${path}.best`), { $add: [orZero(`${path}.streak`), 1] }] },
              totalGuesses: { $add: [orZero(`${path}.totalGuesses`), guesses] },
              skipped: orZero(`${path}.skipped`),
            },
            solvedTotal: { $add: [orZero('solvedTotal'), 1] },
          },
        },
      ]
    : { $set: { [`${path}.streak`]: 0 } }
  const doc = await collection.findOneAndUpdate({ _id: userId }, update, { returnDocument: 'after' })
  return normalizeStats(doc?.stats?.[key])
}
