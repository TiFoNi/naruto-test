import type { ObjectId } from 'mongodb'
import { duels, type DuelDoc } from './db'
import { duelShotKey, duelView, leaveDuel, settle, sideOf } from './duels'

export type Sender = (event: string, data: unknown) => void

type RoomClient = { userId: ObjectId; send: Sender; shot?: string | null }

const HEARTBEAT_MS = 20_000
const GRACE_MS = 12_000
const SAFETY_MS = 4_000

const rooms = new Map<string, Set<RoomClient>>()
const bells = new Map<string, Set<Sender>>()
const marks = new Map<string, string>()
const ends = new Map<string, ReturnType<typeof setTimeout>>()
const safety = new Map<string, ReturnType<typeof setInterval>>()
const drops = new Map<string, ReturnType<typeof setTimeout>>()
const codes = new Map<string, string>()

let watcher: Promise<void> | null = null

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
    duel.winnerId,
    duel.invite,
    duel.left,
    duel.hostId,
    duel.players.map((side) => [
      side.userId,
      side.nickname,
      side.ready,
      side.wantsNext,
      side.wins,
      side.guesses,
      side.solvedAt,
      side.gaveUp,
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
        if (doc.invite && !doc.invite.declined && doc.players.length < 2) notifyBell(doc.invite.toId)
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

export function subscribeBell(userId: ObjectId, send: Sender) {
  const key = userId.toHexString()
  const set = bells.get(key) ?? new Set<Sender>()
  set.add(send)
  bells.set(key, set)
  void startWatcher()
  return () => {
    set.delete(send)
    if (!set.size) bells.delete(key)
  }
}
