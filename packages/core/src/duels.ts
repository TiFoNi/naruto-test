import { randomInt } from 'node:crypto'
import { ObjectId } from 'mongodb'
import {
  ABILITY_HINT_AT,
  ABILITY_STAGES,
  BOARD_DEFAULT,
  BOARD_SIZES,
  DUEL_DEFAULT,
  DUEL_MATCH_XP,
  DUEL_MODES,
  DUEL_ROUNDS,
  DUEL_SECONDS,
  GRID_GAMES,
  GRID_MIN,
  GRID_MISSES,
  GRID_SIDE,
  MODE_XP,
  PHRASE_EVERY,
  PHRASE_VOICE_AT,
  ZOOM_LEVELS,
  duelWinsNeeded,
  hasMode,
  judgeAll,
  type GameId,
  type ModeId,
} from '@nanda/game'
import { abilityByKey } from './abilities'
import { duels, users, type DuelDoc, type DuelLogRow, type DuelPlayer, type UserDoc } from './db'
import { optionsOf, phraseAt, phraseCount, roundExtra } from './extra'
import { gameData, isGame, isMode } from './games'
import { matchesFacet, planGrid } from './grid'
import { addXp, defaultNickname } from './profile'
import { sendPush, type PushLang } from './push'
import { duelSeed, focusFor, shotFor } from './crop'
import { markSeasonDuel } from './season'

export const MIN_GAP_MS = 800
export const DUEL_LOG_MAX = 10
const BOARD_ROWS = 10
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const code = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

const nameOf = (doc: UserDoc) => doc.nickname ?? defaultNickname(doc.username)

const player = (doc: UserDoc): DuelPlayer => ({
  userId: doc._id!,
  nickname: nameOf(doc),
  avatar: doc.avatar ?? null,
  seenAt: new Date(),
  ready: false,
  wantsNext: false,
  wins: 0,
  guesses: [],
})

export const wrongCount = (duel: DuelDoc, side: DuelPlayer) => side.guesses.filter((g) => g !== duel.answerId).length

export const abilityStageOf = (duel: DuelDoc, side: DuelPlayer) => {
  const wrong = wrongCount(duel, side)
  return duel.status !== 'playing' || side.solvedAt || side.gaveUp ? '' : wrong >= ABILITY_STAGES ? '' : `s${wrong}/`
}

export const sideOf = (duel: DuelDoc, userId: ObjectId) => duel.players.find((p) => p.userId.equals(userId))

export const isHost = (duel: DuelDoc, userId: ObjectId) => duel.hostId.equals(userId)

const rounds = (value: unknown) => (DUEL_ROUNDS as readonly number[]).includes(Number(value)) ? Number(value) : null
const seconds = (value: unknown) => (DUEL_SECONDS as readonly number[]).includes(Number(value)) ? Number(value) : null

export async function openLobby(userId: ObjectId) {
  return (await duels()).findOne({ hostId: userId, status: 'lobby' }, { sort: { createdAt: -1 } })
}

export async function createDuel(doc: UserDoc, invited?: UserDoc) {
  const collection = await duels()
  for (let attempt = 0; attempt < 5; attempt++) {
    const duel: DuelDoc = {
      code: code(),
      hostId: doc._id!,
      game: 'naruto',
      mode: 'classic',
      status: 'lobby',
      best: DUEL_DEFAULT.best,
      seconds: DUEL_DEFAULT.seconds,
      invite: invited ? { toId: invited._id!, nickname: nameOf(invited), at: new Date() } : null,
      round: 0,
      draws: 0,
      players: [player(doc)],
      createdAt: new Date(),
      touchedAt: new Date(),
    }
    try {
      const { insertedId } = await collection.insertOne(duel)
      return { ...duel, _id: insertedId }
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  return null
}

export const findDuel = async (value: unknown) =>
  typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value)
    ? (await duels()).findOneAndUpdate({ code: value }, { $set: { touchedAt: new Date() } }, { returnDocument: 'after' })
    : null

export async function joinDuel(duel: DuelDoc, doc: UserDoc) {
  if (sideOf(duel, doc._id!)) return duel
  if (duel.players.length >= 2) return null
  return (await duels()).findOneAndUpdate(
    { _id: duel._id, players: { $size: 1 } },
    { $push: { players: player(doc) } },
    { returnDocument: 'after' },
  )
}

export const boardSizes = (pool: number) => {
  const fits = (BOARD_SIZES as readonly number[]).filter((side) => side * side <= pool)
  return fits.length ? fits : [BOARD_SIZES[0]]
}

export async function setupDuel(duel: DuelDoc, userId: ObjectId, body: Record<string, unknown>) {
  if (!isHost(duel, userId) || duel.status !== 'lobby') return duel
  const { game, mode } = body
  if (!isGame(game) || !isMode(mode) || !DUEL_MODES.includes(mode)) return null
  if (mode !== 'who' && !hasMode(game, mode)) return null
  const best = rounds(body.best) ?? duel.best ?? DUEL_DEFAULT.best
  const limit = seconds(body.seconds) ?? duel.seconds ?? DUEL_DEFAULT.seconds
  const allowed = boardSizes((await gameData(game)).pool.length)
  const asked = Number(body.size) || duel.size || BOARD_DEFAULT
  const size = allowed.includes(asked) ? asked : Math.max(...allowed.filter((side) => side <= asked), allowed[0])
  const strict = typeof body.strict === 'boolean' ? body.strict : duel.strict ?? false
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { game, mode, best, seconds: limit, size, strict, 'players.$[].ready': false } },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

const INVITE_PUSH: Record<PushLang, (name: string) => string> = {
  ru: (name) => `${name} зовёт на дуэль`,
  uk: (name) => `${name} кличе на дуель`,
  en: (name) => `${name} invites you to a duel`,
}

export async function inviteTo(duel: DuelDoc, userId: ObjectId, targetId: unknown) {
  if (!isHost(duel, userId) || duel.status !== 'lobby' || duel.players.length > 1) return null
  if (typeof targetId !== 'string' || !ObjectId.isValid(targetId)) return null
  const _id = new ObjectId(targetId)
  if (_id.equals(userId)) return null
  const target = await (await users()).findOne({ _id })
  if (!target) return null
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { invite: { toId: _id, nickname: nameOf(target), at: new Date() } } },
    { returnDocument: 'after' },
  )
  const host = duel.players.find((side) => side.userId.equals(userId))
  const caller = host?.nickname ?? nameOf(target)
  void sendPush(_id, (lang) => ({
    title: 'NandaGuessr',
    body: INVITE_PUSH[lang](caller),
    url: `/duel/${duel.code}`,
    tag: `duel-${duel.code}-${Date.now()}`,
  })).catch(() => undefined)
  return updated ?? duel
}

export const INVITE_MS = 60 * 60 * 1000

export async function duelInvites(userId: ObjectId) {
  const list = await (await duels())
    .find({ 'invite.toId': userId, 'invite.declined': { $ne: true }, status: 'lobby', 'invite.at': { $gt: new Date(Date.now() - INVITE_MS) } })
    .sort({ 'invite.at': -1 })
    .limit(5)
    .toArray()
  const seen = new Set<string>()
  return list
    .filter((duel) => !sideOf(duel, userId))
    .filter((duel) => {
      const host = duel.hostId.toHexString()
      if (seen.has(host)) return false
      seen.add(host)
      return true
    })
    .map((duel) => ({
      code: duel.code,
      from: duel.players.find((side) => side.userId.equals(duel.hostId))?.nickname ?? duel.players[0]?.nickname ?? '?',
      game: duel.game ?? null,
      mode: duel.mode ?? null,
      best: duel.best ?? DUEL_DEFAULT.best,
      seconds: duel.seconds || DUEL_DEFAULT.seconds,
      at: (duel.invite?.at ?? duel.createdAt).toISOString(),
    }))
}

export async function declineInvite(duel: DuelDoc, userId: ObjectId) {
  if (!duel.invite?.toId.equals(userId)) return null
  await (await duels()).updateOne({ _id: duel._id }, { $set: { 'invite.declined': true } })
  return true
}

export async function duelHistory(userId: ObjectId, limit = DUEL_LOG_MAX) {
  const person = await (await users()).findOne({ _id: userId }, { projection: { duelLog: 1 } })
  return [...(person?.duelLog ?? [])]
    .reverse()
    .slice(0, limit)
    .map((row) => ({
      rivalId: row.rivalId?.toHexString() ?? null,
      rival: row.rival || '?',
      game: row.game ?? null,
      mode: row.mode ?? null,
      wins: row.wins,
      losses: row.losses,
      won: row.won,
      at: row.at.toISOString(),
    }))
}

export async function recentRivals(userId: ObjectId, limit = 5) {
  const person = await (await users()).findOne({ _id: userId }, { projection: { duelLog: 1 } })
  const seen = new Map<string, { id: string; nickname: string; avatar?: string | null; at: string; wins: number; losses: number }>()

  for (const row of [...(person?.duelLog ?? [])].reverse()) {
    if (!row.rivalId) continue
    const id = row.rivalId.toHexString()
    const found = seen.get(id) ?? { id, nickname: row.rival, at: row.at.toISOString(), wins: 0, losses: 0 }
    if (row.won) found.wins += 1
    else found.losses += 1
    seen.set(id, found)
    if (seen.size >= limit) break
  }

  const faces = await (await users())
    .find({ _id: { $in: [...seen.keys()].map((id) => new ObjectId(id)) } }, { projection: { avatar: 1 } })
    .toArray()
  const byId = new Map(faces.map((doc) => [doc._id!.toHexString(), doc.avatar ?? null]))

  return [...seen.values()].map((rival) => ({ ...rival, avatar: byId.get(rival.id) ?? null }))
}

const shuffled = <T>(list: T[]) => {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1)
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

async function boardStart(duel: DuelDoc) {
  const { pool } = await gameData(duel.game as GameId)
  const allowed = boardSizes(pool.length)
  const size = allowed.includes(duel.size ?? BOARD_DEFAULT) ? (duel.size ?? BOARD_DEFAULT) : allowed[allowed.length - 1]
  const cards = shuffled(pool.map((entity) => entity.id)).slice(0, Math.min(size * size, pool.length))

  return {
    status: 'playing' as const,
    round: duel.round + 1,
    answerId: 0,
    extra: null,
    startedAt: null,
    endsAt: null,
    firstId: duel.players[randomInt(duel.players.length)]?.userId ?? null,
    turnId: null,
    firstSolvedAt: null,
    winnerId: null,
    finishedAt: null,
    ...Object.fromEntries(
      duel.players.flatMap((_, index) => [
        [`players.${index}.ready`, false],
        [`players.${index}.wantsNext`, false],
        [`players.${index}.guesses`, []],
        [`players.${index}.solvedAt`, null],
        [`players.${index}.gaveUp`, false],
        [`players.${index}.lastGuessAt`, null],
        [`players.${index}.struck`, []],
        [`players.${index}.answer`, null],
        [`players.${index}.cards`, shuffled(cards)],
        [`players.${index}.secret`, null],
      ]),
    ),
  }
}

async function gridStart(duel: DuelDoc) {
  let plan = await planGrid(duel.game as GameId, GRID_MIN)
  for (let retry = 0; !plan && retry < 2; retry++) plan = await planGrid(duel.game as GameId, GRID_MIN)
  const startedAt = new Date()
  const limit = duel.seconds || DUEL_DEFAULT.seconds
  const first = duel.bot
    ? duel.players.find((side) => !side.userId.equals(BOT_ID))?.userId ?? null
    : duel.players[randomInt(duel.players.length)]?.userId ?? null
  return {
    status: 'playing' as const,
    round: duel.round + 1,
    answerId: 0,
    extra: null,
    startedAt,
    endsAt: duel.bot ? null : new Date(startedAt.getTime() + limit * 1000),
    firstId: first,
    turnId: first,
    grid: plan
      ? { rows: plan.rows, cols: plan.cols, marks: Array.from({ length: GRID_SIDE * GRID_SIDE }, () => null), used: [] }
      : null,
    firstSolvedAt: null,
    winnerId: null,
    finishedAt: null,
    'players.$[].ready': false,
    'players.$[].wantsNext': false,
    'players.$[].guesses': [],
    'players.$[].solvedAt': null,
    'players.$[].gaveUp': false,
    'players.$[].lastGuessAt': null,
  }
}

async function roundStart(duel: DuelDoc) {
  if (duel.mode === 'who') return boardStart(duel)
  if (duel.mode === 'grid') return gridStart(duel)
  const game = duel.game as GameId
  const { pool } = await gameData(game)
  const fresh = pool.filter((e) => e.id !== duel.answerId)
  const answer = (fresh.length ? fresh : pool)[randomInt(fresh.length || pool.length)]
  const extra = await roundExtra(duel.game as GameId, duel.mode as ModeId, answer.id)
  const startedAt = new Date()
  const limit = duel.seconds || DUEL_DEFAULT.seconds
  return {
    status: 'playing' as const,
    round: duel.round + 1,
    answerId: answer.id,
    extra: extra ?? null,
    startedAt,
    endsAt: new Date(startedAt.getTime() + limit * 1000),
    firstSolvedAt: null,
    winnerId: null,
    finishedAt: null,
    'players.$[].ready': false,
    'players.$[].wantsNext': false,
    'players.$[].guesses': [],
    'players.$[].solvedAt': null,
    'players.$[].gaveUp': false,
    'players.$[].lastGuessAt': null,
  }
}

async function beginRound(duel: DuelDoc, from: DuelDoc['status']) {
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: from },
    { $set: await roundStart(duel) },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

export async function setReady(duel: DuelDoc, userId: ObjectId, ready = true) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0 || duel.status !== 'lobby' || !duel.game || !duel.mode) return duel
  const withReady = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { [`players.${index}.ready`]: ready } },
    { returnDocument: 'after' },
  )
  if (!withReady) return duel
  if (!ready || withReady.players.length < 2 || !withReady.players.every((p) => p.ready)) return withReady
  return beginRound(withReady, 'lobby')
}

export async function wantNext(duel: DuelDoc, userId: ObjectId) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0 || duel.status !== 'finished' || duel.matchDone) return duel
  const marked = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'finished' },
    { $set: { [`players.${index}.wantsNext`]: true } },
    { returnDocument: 'after' },
  )
  if (!marked) return duel
  if (marked.players.length < 2 || !marked.players.every((p) => p.wantsNext)) return marked
  return beginRound(marked, 'finished')
}

export const IDLE_MS = 150_000
const EMPTY_MS = 240_000
const SWEEP_MS = 60_000
let sweptAt = 0

export async function sweepDuels() {
  if (Date.now() - sweptAt < SWEEP_MS) return
  sweptAt = Date.now()
  const gone = new Date(Date.now() - EMPTY_MS)
  await (await duels()).deleteMany({ players: { $not: { $elemMatch: { seenAt: { $gt: gone } } } } })
}

async function dropPlayers(duel: DuelDoc, gone: DuelPlayer[]) {
  const collection = await duels()
  const ids = new Set(gone.map((side) => side.userId.toHexString()))
  const rest = duel.players.filter((side) => !ids.has(side.userId.toHexString()))

  if (!rest.length) {
    await collection.deleteOne({ _id: duel._id })
    return null
  }

  const running = duel.status === 'playing' || (duel.status === 'finished' && !duel.matchDone)
  const played = duel.players.some((side) => (side.wins ?? 0) > 0) || duel.round > 0
  if (running && played && rest.length === 1) {
    const winner = rest[0].userId
    const at = new Date()
    const scores = duel.players.map((side) => ({ userId: side.userId, nickname: side.nickname, wins: side.wins ?? 0 }))
    await applyDuelStats(winner, [...rest, ...gone], duel.mode)
    await pushDuelLog(scores, winner, duel.game, duel.mode, at)
    await markSeasonDuel(winner, true, at)
    await duelXp(winner, (duel.mode ?? 'classic') as ModeId, true)
  }

  const updated = await collection.findOneAndUpdate(
    { _id: duel._id },
    {
      $set: {
        players: rest.map((side) => ({ ...side, ready: false, wantsNext: false, wins: 0, guesses: [], solvedAt: null, gaveUp: false })),
        hostId: ids.has(duel.hostId.toHexString()) ? rest[0].userId : duel.hostId,
        status: 'lobby',
        matchDone: false,
        round: 0,
        draws: 0,
        invite: null,
        left: { nickname: gone[0].nickname, at: new Date() },
      },
    },
    { returnDocument: 'after' },
  )
  return updated
}

export async function leaveDuel(duel: DuelDoc, userId: ObjectId) {
  const side = sideOf(duel, userId)
  if (!side) return null
  if (duel.bot) {
    await (await duels()).deleteOne({ _id: duel._id })
    return true
  }
  await dropPlayers(duel, [side])
  return true
}

export async function touchSide(duel: DuelDoc, userId: ObjectId) {
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  if (index < 0) return duel
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id },
    { $set: { [`players.${index}.seenAt`]: new Date() } },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

export async function dropIdle(duel: DuelDoc, userId: ObjectId) {
  if (duel.bot || duel.players.length < 2) return duel
  const now = Date.now()
  const gone = duel.players.filter((side) => !side.userId.equals(userId) && side.seenAt && now - side.seenAt.getTime() > IDLE_MS)
  if (!gone.length) return duel
  return (await dropPlayers(duel, gone)) ?? duel
}

export async function backToLobby(duel: DuelDoc, userId: ObjectId) {
  if (!sideOf(duel, userId) || duel.status === 'playing') return duel
  const reset = duel.matchDone ? { matchDone: false, round: 0, draws: 0, 'players.$[].wins': 0 } : {}
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id },
    {
      $set: {
        status: 'lobby',
        ...reset,
        'players.$[].ready': false,
        'players.$[].wantsNext': false,
        'players.$[].guesses': [],
        'players.$[].solvedAt': null,
        'players.$[].gaveUp': false,
      },
    },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

const done = (side: DuelPlayer) => Boolean(side.solvedAt || side.gaveUp)

const turnMode = (duel: DuelDoc) => duel.mode === 'who' || duel.mode === 'grid'

function decide(duel: DuelDoc) {
  const [a, b] = duel.players
  if (turnMode(duel)) {
    const solver = duel.players.find((side) => side.solvedAt)
    if (solver) return solver.userId
    if (duel.players.length > 1 && duel.players.every((side) => side.gaveUp)) return null
    const missed = duel.players.find((side) => side.gaveUp)
    return missed ? duel.players.find((side) => !side.userId.equals(missed.userId))?.userId ?? null : null
  }
  const score = (side: DuelPlayer) => ({
    solved: side.solvedAt ? 1 : 0,
    guesses: side.guesses.length,
    time: side.solvedAt ? side.solvedAt.getTime() - (duel.startedAt?.getTime() ?? 0) : Infinity,
  })
  const [x, y] = [score(a), score(b)]
  if (x.solved !== y.solved) return x.solved > y.solved ? a.userId : b.userId
  if (!x.solved) return null
  if (x.guesses !== y.guesses) return x.guesses < y.guesses ? a.userId : b.userId
  if (x.time !== y.time) return x.time < y.time ? a.userId : b.userId
  return null
}

async function pushDuelLog(
  scores: { userId: ObjectId; nickname: string; wins: number }[],
  winnerId: ObjectId | null,
  game: string | undefined,
  mode: string | undefined,
  at: Date,
) {
  const collection = await users()
  await Promise.all(
    scores.map((side, index) => {
      const rival = scores[scores.length - 1 - index]
      const row: DuelLogRow = {
        at,
        game,
        mode,
        rivalId: rival?.userId,
        rival: rival?.nickname ?? '',
        wins: side.wins,
        losses: rival?.wins ?? 0,
        won: Boolean(winnerId?.equals(side.userId)),
      }
      return collection.updateOne({ _id: side.userId }, { $push: { duelLog: { $each: [row], $slice: -DUEL_LOG_MAX } } })
    }),
  )
}

async function applyDuelStats(winnerId: ObjectId | null, players: DuelPlayer[], mode?: string) {
  const collection = await users()
  const byMode = mode ? { [`duelStats.modes.${mode}.played`]: 1 } : {}
  await Promise.all(
    players.map((side) => {
      const field = !winnerId ? 'draws' : winnerId.equals(side.userId) ? 'wins' : 'losses'
      const won = mode && field === 'wins' ? { [`duelStats.modes.${mode}.wins`]: 1 } : {}
      return collection.updateOne({ _id: side.userId }, { $inc: { 'duelStats.played': 1, [`duelStats.${field}`]: 1, ...byMode, ...won } })
    }),
  )
}

export const winsNeeded = (duel: DuelDoc) => duelWinsNeeded(duel.best ?? DUEL_DEFAULT.best)

export async function settle(duel: DuelDoc): Promise<DuelDoc> {
  if (duel.status !== 'playing') return duel
  const timeUp = duel.endsAt ? Date.now() >= duel.endsAt.getTime() : false
  const over = turnMode(duel) ? duel.players.some(done) : duel.players.every(done)
  if (!timeUp && !over) return duel
  const winnerId = decide(duel)
  const winnerIndex = winnerId ? duel.players.findIndex((p) => p.userId.equals(winnerId)) : -1
  const matchDone = duel.bot ? true : winnerIndex >= 0 && (duel.players[winnerIndex].wins ?? 0) + 1 >= winsNeeded(duel)
  const solvedAt = winnerIndex >= 0 ? duel.players[winnerIndex].solvedAt : null
  const ms = solvedAt && duel.startedAt ? solvedAt.getTime() - duel.startedAt.getTime() : null
  const at = new Date()
  const scores = duel.players.map((side, index) => ({
    userId: side.userId,
    nickname: side.nickname,
    wins: (side.wins ?? 0) + (index === winnerIndex ? 1 : 0),
  }))
  const finished = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    {
      $set: { status: 'finished', finishedAt: at, winnerId, matchDone },
      $inc: winnerIndex >= 0 ? { [`players.${winnerIndex}.wins`]: 1 } : { draws: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!finished) return (await duels()).findOne({ _id: duel._id }) as Promise<DuelDoc>
  if (duel.bot) {
    if (winnerId && !winnerId.equals(BOT_ID))
      await addXp(await users(), winnerId, MODE_XP[duel.mode as ModeId], 'endless', duel.mode as ModeId)
    return finished
  }
  if (matchDone) {
    await applyDuelStats(winnerId, finished.players, duel.mode)
    await pushDuelLog(scores, winnerId, duel.game, duel.mode, at)
    if (winnerId) await markSeasonDuel(winnerId, true, at)
    const beaten = scores.find((side) => !side.userId.equals(winnerId!))
    if (winnerId && (beaten?.wins ?? 0) >= 2) await (await users()).updateOne({ _id: winnerId }, { $set: { duelComeback: true } })
  }
  if (winnerId) {
    if (ms && ms > 0) await (await users()).updateOne({ _id: winnerId }, { $min: { duelBestMs: ms } })
    await duelXp(winnerId, duel.mode as ModeId, matchDone)
  }
  return finished
}

async function duelXp(userId: ObjectId, mode: ModeId, matchDone: boolean) {
  const collection = await users()
  await addXp(collection, userId, MODE_XP[mode] + (matchDone ? DUEL_MATCH_XP : 0), 'duel', mode)
}

export async function duelGuess(duel: DuelDoc, userId: ObjectId, entityId: number) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0) return { error: 'not_found' as const }
  const side = duel.players[index]
  if (duel.status !== 'playing' || done(side)) return { error: 'round_over' as const }
  if (!(await gameData(duel.game as GameId)).byId.has(entityId)) return { error: 'bad_request' as const }
  if (side.guesses.includes(entityId)) return { error: 'duplicate' as const }

  const now = new Date()
  const solved = entityId === duel.answerId
  const set: Record<string, unknown> = { [`players.${index}.lastGuessAt`]: now }
  if (solved) set[`players.${index}.solvedAt`] = now
  if (solved && !duel.firstSolvedAt) set.firstSolvedAt = now
  const updated = await (await duels()).findOneAndUpdate(
    {
      _id: duel._id,
      status: 'playing',
      [`players.${index}.guesses`]: { $ne: entityId },
      $or: [
        { [`players.${index}.lastGuessAt`]: { $exists: false } },
        { [`players.${index}.lastGuessAt`]: null },
        { [`players.${index}.lastGuessAt`]: { $lte: new Date(now.getTime() - MIN_GAP_MS) } },
      ],
    },
    { $push: { [`players.${index}.guesses`]: entityId }, $set: set },
    { returnDocument: 'after' },
  )
  if (!updated) return { error: 'too_fast' as const }
  return { duel: await settle(updated) }
}

export const picking = (duel: DuelDoc) => duel.mode === 'who' && duel.players.some((side) => !side.secret)

export async function pickSecret(duel: DuelDoc, userId: ObjectId, entityId: number) {
  if (duel.mode !== 'who' || duel.status !== 'playing') return { error: 'round_over' as const }
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  const side = duel.players[index]
  if (!side?.cards?.includes(entityId) || side.secret) return { error: 'bad_request' as const }

  const set: Record<string, unknown> = { [`players.${index}.secret`]: entityId }
  const others = duel.players.filter((_, at) => at !== index)
  if (others.every((one) => one.secret)) {
    const startedAt = new Date()
    set.startedAt = startedAt
    set.endsAt = new Date(startedAt.getTime() + (duel.seconds || DUEL_DEFAULT.seconds) * 1000)
    set.turnId = duel.firstId ?? duel.players[0]?.userId ?? null
  }

  const updated = await (await duels()).findOneAndUpdate({ _id: duel._id, status: 'playing' }, { $set: set }, { returnDocument: 'after' })
  return { duel: updated ?? duel }
}

export const yourTurn = (duel: DuelDoc, userId: ObjectId) => Boolean(duel.turnId && duel.turnId.equals(userId))

export async function passTurn(duel: DuelDoc, userId: ObjectId) {
  if (duel.mode !== 'who' || duel.status !== 'playing' || picking(duel)) return { error: 'round_over' as const }
  if (!yourTurn(duel, userId)) return { error: 'not_your_turn' as const }
  const next = duel.players.find((side) => !side.userId.equals(userId))?.userId ?? userId
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing', turnId: userId },
    { $set: { turnId: next } },
    { returnDocument: 'after' },
  )
  return { duel: updated ?? duel }
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export const gridWinner = (marks: (number | null)[]) => {
  for (const line of LINES) {
    const [a, b, c] = line
    if (marks[a] !== null && marks[a] === marks[b] && marks[b] === marks[c]) return marks[a]
  }
  return null
}

export async function markCell(duel: DuelDoc, userId: ObjectId, cell: number, entityId: number) {
  if (duel.mode !== 'grid' || duel.status !== 'playing' || !duel.grid) return { error: 'round_over' as const }
  if (!yourTurn(duel, userId)) return { error: 'not_your_turn' as const }

  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  if (index < 0) return { error: 'forbidden' as const }
  if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_SIDE * GRID_SIDE) return { error: 'bad_request' as const }
  if (duel.grid.marks[cell] !== null) return { error: 'cell_taken' as const }
  if (duel.grid.used.includes(entityId)) return { error: 'already_used' as const }

  const game = duel.game as GameId
  const entity = (await gameData(game)).byId.get(entityId)
  if (!entity || !entity.answer) return { error: 'not_found' as const }

  const row = duel.grid.rows[Math.floor(cell / GRID_SIDE)]
  const col = duel.grid.cols[cell % GRID_SIDE]

  if (!matchesFacet(entity, row, game) || !matchesFacet(entity, col, game)) {
    const rival = 1 - index

    const tries = [...(duel.players[index].guesses ?? []), entityId]
    const out = duel.strict || tries.length >= GRID_MISSES
    const set: Record<string, unknown> = {
      grid: { ...duel.grid, miss: { by: index, entityId } },
      [`players.${index}.guesses`]: tries,
    }

    if (out) {
      set[`players.${index}.gaveUp`] = true
      set[`players.${rival}.solvedAt`] = new Date()
    } else {
      set.turnId = duel.players[rival]?.userId ?? userId
    }

    const missed = await (await duels()).findOneAndUpdate(
      { _id: duel._id, status: 'playing', turnId: userId },
      { $set: set },
      { returnDocument: 'after' },
    )
    const after = await settle(missed ?? duel)
    scheduleBot(after)
    return { duel: after }
  }

  const marks = [...duel.grid.marks]
  marks[cell] = index
  const used = [...duel.grid.used, entityId]
  const picks = [...(duel.grid.picks ?? [])]
  picks[cell] = entityId

  const winner = gridWinner(marks)
  const full = marks.every((one) => one !== null)
  const next = duel.players.find((side) => !side.userId.equals(userId))?.userId ?? userId

  const set: Record<string, unknown> = {
    grid: { ...duel.grid, marks, used, picks, miss: null },
    turnId: winner === null && !full ? next : duel.turnId,
  }
  if (winner !== null) {
    set[`players.${winner}.solvedAt`] = new Date()
    duel.players.forEach((_, at) => at !== winner && (set[`players.${at}.gaveUp`] = true))
  } else if (full) {
    duel.players.forEach((_, at) => (set[`players.${at}.gaveUp`] = true))
  }

  const updated = await (await duels()).findOneAndUpdate({ _id: duel._id, status: 'playing' }, { $set: set }, { returnDocument: 'after' })
  const after = await settle(updated ?? duel)
  scheduleBot(after)
  return { duel: after }
}

export const BOT_ID = new ObjectId('00000000000000000000b07b')
export const BOT_NAME = 'NandaBot'

const BOT_THINK_MIN = 900
const BOT_THINK_SPAN = 1500
const BOT_SLIP = 25

const botPlayer = (): DuelPlayer => ({
  userId: BOT_ID,
  nickname: BOT_NAME,
  seenAt: new Date(),
  ready: true,
  wantsNext: true,
  wins: 0,
  guesses: [],
})

const botTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleBot(duel: DuelDoc) {
  if (!duel.bot || duel.status !== 'playing' || !duel.turnId?.equals(BOT_ID)) return
  if (botTimers.has(duel.code)) return
  const timer = setTimeout(() => {
    botTimers.delete(duel.code)
    void botMove(duel.code).catch(() => undefined)
  }, BOT_THINK_MIN + randomInt(BOT_THINK_SPAN))
  botTimers.set(duel.code, timer)
}

async function botChoice(duel: DuelDoc) {
  if (!duel.grid) return null
  const game = duel.game as GameId
  const { pool } = await gameData(game)
  const used = new Set(duel.grid.used)
  const marks = duel.grid.marks
  const me = duel.players.findIndex((side) => side.userId.equals(BOT_ID))
  const rival = 1 - me

  const options = new Map<number, number[]>()
  for (let cell = 0; cell < GRID_SIDE * GRID_SIDE; cell++) {
    if (marks[cell] !== null) continue
    const row = duel.grid.rows[Math.floor(cell / GRID_SIDE)]
    const col = duel.grid.cols[cell % GRID_SIDE]
    const fits = pool.filter((one) => !used.has(one.id) && matchesFacet(one, row, game) && matchesFacet(one, col, game))
    if (fits.length) options.set(cell, fits.map((one) => one.id))
  }
  if (!options.size) return null

  const free = [...options.keys()]
  const lineCell = (owner: number) => {
    for (const line of LINES) {
      const mine = line.filter((cell) => marks[cell] === owner).length
      const open = line.filter((cell) => marks[cell] === null)
      if (mine === 2 && open.length === 1 && options.has(open[0])) return open[0]
    }
    return null
  }

  const slip = randomInt(100) < BOT_SLIP
  const cell = slip
    ? free[randomInt(free.length)]
    : lineCell(me) ??
      lineCell(rival) ??
      (options.has(4) ? 4 : null) ??
      [0, 2, 6, 8].find((corner) => options.has(corner)) ??
      free[randomInt(free.length)]

  const ids = options.get(cell)!
  return { cell, entityId: ids[randomInt(ids.length)] }
}

async function botMove(code: string) {
  const duel = await (await duels()).findOne({ code })
  if (!duel || !duel.bot || duel.status !== 'playing' || !duel.grid) return
  if (!duel.turnId?.equals(BOT_ID)) return
  const choice = await botChoice(duel)
  if (!choice) {
    const stuck = await (await duels()).findOneAndUpdate(
      { _id: duel._id, status: 'playing' },
      { $set: Object.fromEntries(duel.players.map((_, at) => [`players.${at}.gaveUp`, true])) },
      { returnDocument: 'after' },
    )
    await settle(stuck ?? duel)
    return
  }
  await (await duels()).updateOne({ _id: duel._id, 'players.userId': BOT_ID }, { $set: { 'players.$.seenAt': new Date() } })
  await markCell(duel, BOT_ID, choice.cell, choice.entityId)
}

export async function soloGrid(doc: UserDoc, game: unknown) {
  if (!isGame(game) || !GRID_GAMES.includes(game)) return null
  const collection = await duels()

  const live = await collection.findOne({ hostId: doc._id!, bot: true, game, status: 'playing' }, { sort: { createdAt: -1 } })
  if (live) {
    scheduleBot(live)
    return live
  }

  await collection.deleteMany({ hostId: doc._id!, bot: true, status: { $ne: 'playing' } })

  for (let attempt = 0; attempt < 5; attempt++) {
    const duel: DuelDoc = {
      code: code(),
      hostId: doc._id!,
      game,
      mode: 'grid',
      status: 'lobby',
      best: 1,
      seconds: 0,
      bot: true,
      invite: null,
      round: 0,
      draws: 0,
      players: [{ ...player(doc), ready: true }, botPlayer()],
      createdAt: new Date(),
      touchedAt: new Date(),
    }
    try {
      const { insertedId } = await collection.insertOne(duel)
      const started = await beginRound({ ...duel, _id: insertedId }, 'lobby')
      if (!started.grid) {
        await collection.deleteOne({ _id: insertedId })
        return null
      }
      scheduleBot(started)
      return started
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  return null
}

export async function strikeCard(duel: DuelDoc, userId: ObjectId, entityId: number) {
  if (duel.mode !== 'who' || duel.status !== 'playing' || picking(duel)) return { error: 'round_over' as const }
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  const side = duel.players[index]
  if (!side?.cards?.includes(entityId)) return { error: 'bad_request' as const }

  const struck = side.struck ?? []
  const next = struck.includes(entityId) ? struck.filter((id) => id !== entityId) : [...struck, entityId]
  const standing = side.cards.filter((id) => !next.includes(id))
  if (!standing.length) return { error: 'bad_request' as const }

  const rival = duel.players.find((one) => !one.userId.equals(userId))
  const set: Record<string, unknown> = { [`players.${index}.struck`]: next, [`players.${index}.answer`]: null }
  if (standing.length === 1) {
    if (!yourTurn(duel, userId)) return { error: 'not_your_turn' as const }
    set[`players.${index}.answer`] = standing[0]
    if (standing[0] === rival?.secret) set[`players.${index}.solvedAt`] = new Date()
    else set[`players.${index}.gaveUp`] = true
  }

  const updated = await (await duels()).findOneAndUpdate({ _id: duel._id, status: 'playing' }, { $set: set }, { returnDocument: 'after' })
  return { duel: await settle(updated ?? duel) }
}

export async function answerCard(duel: DuelDoc, userId: ObjectId, entityId: number) {
  if (duel.mode !== 'who' || duel.status !== 'playing' || picking(duel)) return { error: 'round_over' as const }
  if (!yourTurn(duel, userId)) return { error: 'not_your_turn' as const }
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  const side = duel.players[index]
  if (!side?.cards?.includes(entityId) || side.struck?.includes(entityId)) return { error: 'bad_request' as const }

  const rival = duel.players.find((one) => !one.userId.equals(userId))
  const set: Record<string, unknown> = {
    [`players.${index}.struck`]: side.cards.filter((id) => id !== entityId),
    [`players.${index}.answer`]: entityId,
  }
  if (entityId === rival?.secret) set[`players.${index}.solvedAt`] = new Date()
  else set[`players.${index}.gaveUp`] = true

  const updated = await (await duels()).findOneAndUpdate({ _id: duel._id, status: 'playing' }, { $set: set }, { returnDocument: 'after' })
  return { duel: await settle(updated ?? duel) }
}

export async function giveUpDuel(duel: DuelDoc, userId: ObjectId) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0 || duel.status !== 'playing') return duel
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    { $set: { [`players.${index}.gaveUp`]: true } },
    { returnDocument: 'after' },
  )
  return settle(updated ?? duel)
}

function phraseLines(duel: DuelDoc, side: DuelPlayer) {
  const total = phraseCount(duel.answerId ?? 0)
  if (!total) return {}
  const step = Math.min(Math.floor(wrongCount(duel, side) / PHRASE_EVERY), total - 1)
  const lines: { text: string; ru?: string }[] = []
  for (let i = 0; i <= step; i++) {
    const line = phraseAt(duel.answerId ?? 0, duel.extra ?? undefined, i)
    if (line) lines.push(line.ru ? { text: line.text, ru: line.ru } : { text: line.text })
  }
  const done = duel.status !== 'playing' || Boolean(side.solvedAt) || Boolean(side.gaveUp)
  return {
    lines,
    linesLeft: Math.max(total - lines.length, 0),
    voice: done || lines.length >= PHRASE_VOICE_AT ? `/api/round/voice?duel=${duel.code}&r=${duel.round}` : undefined,
  }
}

function duelStep(duel: DuelDoc, side: DuelPlayer) {
  const revealed = duel.status === 'finished' || Boolean(side.solvedAt) || Boolean(side.gaveUp)
  return revealed ? ZOOM_LEVELS.length - 1 : Math.min(wrongCount(duel, side), ZOOM_LEVELS.length - 1)
}

export function duelShotKey(duel: DuelDoc, userId: ObjectId) {
  const side = sideOf(duel, userId)
  if (duel.mode !== 'image' || duel.status === 'lobby' || duel.answerId === undefined || !side) return null
  return `${duel.code}:${duel.round}:${duelStep(duel, side)}`
}

async function duelShot(duel: DuelDoc, side: DuelPlayer, known: boolean) {
  const game = duel.game as GameId
  const seed = duelSeed(duel)
  const step = duelStep(duel, side)
  const [focus, shot] = await Promise.all([
    focusFor(game, duel.answerId!, seed),
    known ? Promise.resolve(undefined) : shotFor(game, duel.answerId!, seed, step),
  ])
  return { focus, zoom: ZOOM_LEVELS[step], ...(shot ? { shot } : {}) }
}

export async function duelView(duel: DuelDoc, userId: ObjectId, known = false) {
  const you = sideOf(duel, userId)
  const mine = duel.players.findIndex((p) => p.userId.equals(userId))
  const rival = duel.players.find((p) => !p.userId.equals(userId))
  const playing = duel.status === 'playing'
  const finished = duel.status === 'finished'
  const game = duel.game as GameId | undefined
  const data = game ? await gameData(game) : null
  const byId = data?.byId ?? null
  const answer = byId && duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const ability =
    duel.mode === 'ability' && you && answer && (finished || you.solvedAt || you.gaveUp || wrongCount(duel, you) >= ABILITY_HINT_AT)
      ? abilityByKey(duel.answerId!, duel.extra ?? undefined)?.name
      : undefined
  return {
    code: duel.code,
    bot: Boolean(duel.bot),
    game: duel.game ?? null,
    mode: duel.mode ?? null,
    status: duel.status,
    best: duel.best ?? DUEL_DEFAULT.best,
    seconds: duel.seconds || DUEL_DEFAULT.seconds,
    strict: duel.strict ?? false,
    needed: winsNeeded(duel),
    matchDone: Boolean(duel.matchDone),
    invited: duel.invite && !duel.invite.declined && duel.players.length < 2 ? duel.invite.nickname : null,
    declined: Boolean(duel.invite?.declined) && duel.players.length < 2,
    left: duel.left && duel.players.length < 2 && Date.now() - duel.left.at.getTime() < 120_000 ? duel.left.nickname : null,
    round: duel.round,
    draws: duel.draws,
    host: isHost(duel, userId),
    now: Date.now(),
    startedAt: duel.startedAt?.getTime(),
    endsAt: duel.endsAt?.getTime(),
    hintAt: duel.mode === 'ability' ? ABILITY_HINT_AT : undefined,
    ability,
    image:
      playing || finished
        ? duel.mode === 'image' || duel.mode === 'ability' || duel.mode === 'page'
          ? `/api/round/image?duel=${duel.code}&r=${duel.round}`
          : undefined
        : undefined,
    ...(duel.mode === 'image' && (playing || finished) && duel.answerId !== undefined && you
      ? await duelShot(duel, you, known)
      : {}),
    ...(duel.mode === 'page' ? { options: optionsOf(duel.extra ?? undefined) } : {}),
    ...(duel.mode === 'phrase' && you ? phraseLines(duel, you) : {}),
    answerId: duel.mode === 'who' ? undefined : finished || you?.solvedAt || you?.gaveUp ? duel.answerId : undefined,
    winner: finished ? (duel.winnerId ? duel.players.find((p) => p.userId.equals(duel.winnerId!))?.nickname ?? null : null) : undefined,
    youWon: finished ? Boolean(duel.winnerId && duel.winnerId.equals(userId)) : undefined,
    ...(duel.mode === 'who' ? { size: duel.size ?? BOARD_DEFAULT, sizes: boardSizes(data?.pool.length ?? 0) } : {}),
    ...(duel.mode === 'grid' && duel.grid && (playing || finished)
      ? {
          grid: {
            rows: duel.grid.rows,
            cols: duel.grid.cols,
            marks: duel.grid.marks.map((one) => (one === null ? null : one === mine ? 'you' : 'rival')),
            picks: duel.grid.picks ?? [],
            miss: duel.grid.miss ? { you: duel.grid.miss.by === mine, entityId: duel.grid.miss.entityId } : null,
          },
          turn: duel.turnId ? duel.players.find((side) => side.userId.equals(duel.turnId!))?.nickname ?? null : null,
          yourTurn: yourTurn(duel, userId),
        }
      : {}),
    ...(duel.mode === 'who' && (playing || finished)
      ? {
          first: duel.firstId ? duel.players.find((side) => side.userId.equals(duel.firstId!))?.nickname ?? null : null,
          youFirst: Boolean(duel.firstId && duel.firstId.equals(userId)),
          turn: duel.turnId ? duel.players.find((side) => side.userId.equals(duel.turnId!))?.nickname ?? null : null,
          yourTurn: yourTurn(duel, userId),
          secret: you?.secret ?? null,
          picking: picking(duel),
          rivalPicked: Boolean(rival?.secret),
          cards: you?.cards ?? [],
          struck: you?.struck ?? [],
          rivalLeft: rival ? (rival.cards?.length ?? 0) - (rival.struck?.length ?? 0) : 0,
          rivalSecret: finished ? rival?.secret : undefined,
          yourAnswer: you?.answer ?? undefined,
          rivalAnswer: finished ? rival?.answer ?? undefined : undefined,
        }
      : {}),
    you: you && {
      id: you.userId.toHexString(),
      nickname: you.nickname,
      avatar: you.avatar ?? null,
      ready: you.ready,
      wantsNext: Boolean(you.wantsNext),
      wins: you.wins ?? 0,
      solved: Boolean(you.solvedAt),
      gaveUp: Boolean(you.gaveUp),
      guesses: (playing || finished) && byId
        ? you.guesses
            .filter((id) => byId.has(id))
            .map((id) => ({ id, judgement: duel.mode === 'classic' && answer ? judgeAll(game!, byId.get(id)!, answer) : undefined }))
        : [],
    },
    rival: rival && {
      id: rival.userId.toHexString(),
      nickname: rival.nickname,
      avatar: rival.avatar ?? null,
      ready: rival.ready,
      wantsNext: Boolean(rival.wantsNext),
      wins: rival.wins ?? 0,
      solved: Boolean(rival.solvedAt),
      gaveUp: Boolean(rival.gaveUp),
      guessCount: rival.guesses.length,
      board:
        duel.mode === 'classic' && byId && answer
          ? rival.guesses
              .slice(-BOARD_ROWS)
              .map((id) => byId.get(id))
              .filter((entity) => entity !== undefined)
              .map((entity) => Object.fromEntries(Object.entries(judgeAll(game!, entity, answer)).map(([key, value]) => [key, value.verdict])))
          : undefined,
    },
  }
}
