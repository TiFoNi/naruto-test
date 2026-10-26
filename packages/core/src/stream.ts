import type { ObjectId } from 'mongodb'
import { chatRoom, coinLedger, duels, type ChatDoc, type DuelDoc } from './db'
import { duelShotKey, duelView, leaveDuel, scheduleBot, settle, sideOf } from './duels'
import { friends, type FriendDoc } from './friends'
import { lineOf } from './chat'

export type Sender = (event: string, data: unknown) => void

type RoomClient = { userId: ObjectId; send: Sender; shot?: string | null }

const HEARTBEAT_MS = 20_000
const GRACE_MS = 60_000
const SAFETY_MS = 4_000

const rooms = new Map<string, Set<RoomClient>>()
const bells = new Map<string, Set<Sender>>()
const marks = new Map<string, string>()
const ends = new Map<string, ReturnType<typeof setTimeout>>()
const safety = new Map<string, ReturnType<typeof setInterval>>()
const drops = new Map<string, ReturnType<typeof setTimeout>>()
const codes = new Map<string, string>()

const chatters = new Set<Sender>()
const typing = new Map<string, { nickname: string; until: number }>()
let sweep: ReturnType<typeof setInterval> | null = null

const typingList = () => [...typing].map(([id, one]) => ({ id, nickname: one.nickname }))

const TYPING_MS = 6_000

function pushTyping() {
  const people = typingList()
  for (const send of chatters) send('typing', { people })
}

function pruneTyping() {
  const now = Date.now()
  let changed = false
  for (const [id, one] of typing) if (one.until <= now) changed = typing.delete(id) || changed
  if (changed) pushTyping()
  if (!typing.size && sweep) {
    clearInterval(sweep)
    sweep = null
  }
}

export function markTyping(userId: string, nickname: string, on: boolean) {
  if (!on) {
    if (typing.delete(userId)) pushTyping()
    return
  }
  const known = typing.get(userId)
  typing.set(userId, { nickname, until: Date.now() + TYPING_MS })
  sweep ??= setInterval(pruneTyping, 1_000)
  if (!known || known.nickname !== nickname) pushTyping()
}

let watcher: Promise<void> | null = null
let talk: Promise<void> | null = null
let mates: Promise<void> | null = null
let purse: Promise<void> | null = null

const mark = (duel: DuelDoc) =>
  JSON.stringify([
    duel.status,
    duel.round,
    duel.draws,
    duel.matchDone,
    duel.game,
    duel.mode,
    duel.best,
    duel.seconds,
    duel.endsAt,
    duel.turnId,
    duel.winnerId,
    duel.grid ? [duel.grid.marks, duel.grid.miss ?? null] : null,
    duel.clue ? [duel.clue.open, duel.clue.turn, duel.clue.word ?? null, duel.clue.left ?? 0, duel.clue.hit ?? null] : null,
    duel.invites,
    duel.left,
    duel.hostId,
    duel.per,
    duel.players.map((side) => [
      side.team,
      side.lead,
      side.userId,
      side.nickname,
      side.ready,
      side.wantsNext,
      side.wins,
      side.guesses,
      side.solvedAt,
      side.gaveUp,
      side.secret,
      side.struck,
      side.answer,
    ]),
  ])

const hasClient = (code: string, userId: ObjectId) => [...(rooms.get(code) ?? [])].some((client) => client.userId.equals(userId))

async function touch(code: string, userId: ObjectId) {
  await (await duels()).updateOne(
    { code, 'players.userId': userId },
    { $set: { 'players.$.seenAt': new Date(), touchedAt: new Date() } },
  )
}

function scheduleEnd(code: string, duel: DuelDoc) {
  clearTimeout(ends.get(code))
  ends.delete(code)
  if (duel.status !== 'playing' || !duel.endsAt) return
  const wait = Math.max(250, duel.endsAt.getTime() - Date.now() + 250)
  ends.set(
    code,
    setTimeout(() => void pushRoom(code), wait),
  )
}

async function sendState(duel: DuelDoc, client: RoomClient) {
  if (!sideOf(duel, client.userId)) return client.send('gone', { code: duel.code })
  const key = duelShotKey(duel, client.userId)
  client.send('state', await duelView(duel, client.userId, Boolean(key) && client.shot === key))
  client.shot = key
}

export async function pushRoom(code: string, known?: DuelDoc | null, only?: RoomClient) {
  const set = rooms.get(code)
  if (!set?.size) return
  const found = known ?? (await (await duels()).findOne({ code }))
  if (!found) {
    marks.delete(code)
    for (const client of only ? [only] : set) client.send('gone', { code })
    return
  }
  const duel = await settle(found)
  scheduleBot(duel)
  const next = mark(duel)
  codes.set(String(duel._id), code)
  scheduleEnd(code, duel)
  if (!only && marks.get(code) === next) return
  marks.set(code, next)
  for (const client of only ? [only] : set) await sendState(duel, client)
}

function notifyBell(userId: unknown) {
  for (const send of bells.get(String(userId)) ?? []) send('invite', {})
}

async function startWatcher() {
  watcher ??= (async () => {
    const stream = (await duels()).watch([], { fullDocument: 'updateLookup' })
    stream.on('change', (change) => {
      const id = String((change as { documentKey?: { _id?: unknown } }).documentKey?._id ?? '')
      const doc = (change as { fullDocument?: DuelDoc }).fullDocument
      if (doc) {
        codes.set(String(doc._id), doc.code)
        if (doc.status === 'lobby') for (const one of doc.invites ?? []) if (!sideOf(doc, one.toId)) notifyBell(one.toId)
        void pushRoom(doc.code, doc)
        return
      }
      const code = codes.get(id)
      if (code) void pushRoom(code, null)
    })
    stream.on('error', () => {
      watcher = null
      void stream.close().catch(() => undefined)
    })
  })().catch(() => {
    watcher = null
  })
  return watcher
}

async function startMates() {
  mates ??= (async () => {
    const stream = (await friends()).watch([], { fullDocument: 'updateLookup' })
    stream.on('change', (change) => {
      const doc = (change as { fullDocument?: FriendDoc }).fullDocument
      if (!doc) return
      if (doc.status === 'pending') notifyBell(doc.toId)
      else notifyBell(doc.fromId)
    })
    stream.on('error', () => {
      mates = null
      void stream.close().catch(() => undefined)
    })
  })().catch(() => {
    mates = null
  })
  return mates
}

function scheduleDrop(code: string, userId: ObjectId) {
  const key = `${code}:${userId.toHexString()}`
  const at = new Date()
  clearTimeout(drops.get(key))
  drops.set(
    key,
    setTimeout(async () => {
      drops.delete(key)
      if (hasClient(code, userId)) return
      const duel = await (await duels()).findOne({ code })
      if (!duel) return
      const side = sideOf(duel, userId)
      if (!side || (side.seenAt && side.seenAt > at)) return
      await leaveDuel(duel, userId)
      await pushRoom(code)
    }, GRACE_MS),
  )
}

export async function subscribeDuel(code: string, userId: ObjectId, send: Sender) {
  const client: RoomClient = { userId, send }
  const set = rooms.get(code) ?? new Set<RoomClient>()
  set.add(client)
  rooms.set(code, set)
  clearTimeout(drops.get(`${code}:${userId.toHexString()}`))

  void startWatcher()
  if (!safety.has(code)) safety.set(code, setInterval(() => void pushRoom(code), SAFETY_MS))

  const beat = setInterval(() => void touch(code, userId), HEARTBEAT_MS)
  await touch(code, userId)
  await pushRoom(code, undefined, client)

  return () => {
    clearInterval(beat)
    set.delete(client)
    if (!set.size) {
      rooms.delete(code)
      marks.delete(code)
      clearInterval(safety.get(code))
      safety.delete(code)
      clearTimeout(ends.get(code))
      ends.delete(code)
    }
    if (!hasClient(code, userId)) scheduleDrop(code, userId)
  }
}

async function startPurse() {
  purse ??= (async () => {
    const stream = (await coinLedger()).watch([{ $match: { operationType: 'insert' } }], { fullDocument: 'updateLookup' })
    stream.on('change', (change) => {
      const doc = (change as { fullDocument?: { userId?: unknown; delta?: number } }).fullDocument
      if (doc?.userId && (doc.delta ?? 0) > 0) notifyBell(doc.userId)
    })
    stream.on('error', () => {
      purse = null
      void stream.close().catch(() => undefined)
    })
  })().catch(() => {
    purse = null
  })
  return purse
}

async function startTalk() {
  talk ??= (async () => {
    const stream = (await chatRoom()).watch([{ $match: { operationType: { $in: ['insert', 'update'] } } }], { fullDocument: 'updateLookup' })
    stream.on('change', (change) => {
      const doc = (change as { fullDocument?: ChatDoc }).fullDocument
      if (!doc?._id) return
      if (doc.hidden) {
        for (const send of chatters) send('drop', { id: doc._id.toHexString() })
        return
      }
      if ((change as { operationType?: string }).operationType !== 'insert') return
      const line = lineOf(doc)
      for (const send of chatters) send('chat', line)
    })
    stream.on('error', () => {
      talk = null
      void stream.close().catch(() => undefined)
    })
  })().catch(() => {
    talk = null
  })
  return talk
}

export function subscribeChat(send: Sender) {
  chatters.add(send)
  void startTalk()
  if (typing.size) send('typing', { people: typingList() })
  return () => {
    chatters.delete(send)
  }
}

export function subscribeBell(userId: ObjectId, send: Sender) {
  const key = userId.toHexString()
  const set = bells.get(key) ?? new Set<Sender>()
  set.add(send)
  bells.set(key, set)
  void startWatcher()
  void startMates()
  void startPurse()
  return () => {
    set.delete(send)
    if (!set.size) bells.delete(key)
  }
}
