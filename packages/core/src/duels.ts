import { randomInt } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { ABILITY_HINT_AT, ABILITY_STAGES, DUEL_DEFAULT, DUEL_MODES, DUEL_ROUNDS, DUEL_SECONDS, duelWinsNeeded, hasMode, judgeAll, type GameId, type ModeId } from '@nanda/game'
import { abilityByKey } from './abilities'
import { duels, users, type DuelDoc, type DuelPlayer, type UserDoc } from './db'
import { roundExtra } from './extra'
import { gameData, isGame, isMode } from './games'
import { defaultNickname } from './profile'

export const MIN_GAP_MS = 800
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const code = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

const nameOf = (doc: UserDoc) => doc.nickname ?? defaultNickname(doc.username)

const player = (doc: UserDoc): DuelPlayer => ({ userId: doc._id!, nickname: nameOf(doc), ready: false, wantsNext: false, wins: 0, guesses: [] })

export const wrongCount = (duel: DuelDoc, side: DuelPlayer) => side.guesses.filter((g) => g !== duel.answerId).length

export const abilityStageOf = (duel: DuelDoc, side: DuelPlayer) => {
  const wrong = wrongCount(duel, side)
  return duel.status !== 'playing' || side.solvedAt ? '' : wrong >= ABILITY_STAGES ? '' : `s${wrong}/`
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

export async function setupDuel(duel: DuelDoc, userId: ObjectId, body: Record<string, unknown>) {
  if (!isHost(duel, userId) || duel.status !== 'lobby') return duel
  const { game, mode } = body
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode) || !DUEL_MODES.includes(mode)) return null
  const best = rounds(body.best) ?? duel.best ?? DUEL_DEFAULT.best
  const limit = seconds(body.seconds) ?? duel.seconds ?? DUEL_DEFAULT.seconds
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { game, mode, best, seconds: limit, 'players.$[].ready': false } },
    { returnDocument: 'after' },
  )
  return updated ?? duel
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
  return updated ?? duel
}

export const INVITE_MS = 60 * 60 * 1000

export async function duelInvites(userId: ObjectId) {
  const list = await (await duels())
    .find({ 'invite.toId': userId, 'invite.declined': { $ne: true }, status: 'lobby', createdAt: { $gt: new Date(Date.now() - INVITE_MS) } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()
  return list
    .filter((duel) => !sideOf(duel, userId))
    .map((duel) => ({
      code: duel.code,
      from: duel.players[0]?.nickname ?? '?',
      game: duel.game ?? null,
      mode: duel.mode ?? null,
      best: duel.best ?? DUEL_DEFAULT.best,
      seconds: duel.seconds || DUEL_DEFAULT.seconds,
      at: duel.createdAt.toISOString(),
    }))
}

export async function declineInvite(duel: DuelDoc, userId: ObjectId) {
  if (!duel.invite?.toId.equals(userId)) return null
  await (await duels()).updateOne({ _id: duel._id }, { $set: { 'invite.declined': true } })
  return true
}

export async function recentRivals(userId: ObjectId, limit = 5) {
  const list = await (await duels())
    .find({ 'players.userId': userId, players: { $size: 2 } })
    .sort({ createdAt: -1 })
    .limit(40)
    .toArray()
  const seen = new Map<string, { id: string; nickname: string; at: string; wins: number; losses: number }>()
  for (const duel of list) {
    const rival = duel.players.find((side) => !side.userId.equals(userId))
    const mine = duel.players.find((side) => side.userId.equals(userId))
    if (!rival || !mine) continue
    const key = rival.userId.toHexString()
    const row = seen.get(key) ?? { id: key, nickname: rival.nickname, at: duel.createdAt.toISOString(), wins: 0, losses: 0 }
    row.wins += mine.wins ?? 0
    row.losses += rival.wins ?? 0
    seen.set(key, row)
    if (seen.size >= limit) break
  }
  return [...seen.values()]
}

async function roundStart(duel: DuelDoc) {
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

export async function setReady(duel: DuelDoc, userId: ObjectId) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0 || duel.status !== 'lobby' || !duel.game || !duel.mode) return duel
  const withReady = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { [`players.${index}.ready`]: true } },
    { returnDocument: 'after' },
  )
  if (!withReady) return duel
  if (withReady.players.length < 2 || !withReady.players.every((p) => p.ready)) return withReady
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

function decide(duel: DuelDoc) {
  const [a, b] = duel.players
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

async function applyDuelStats(winnerId: ObjectId | null, players: DuelPlayer[]) {
  const collection = await users()
  await Promise.all(
    players.map((side) => {
      const field = !winnerId ? 'draws' : winnerId.equals(side.userId) ? 'wins' : 'losses'
      return collection.updateOne({ _id: side.userId }, { $inc: { 'duelStats.played': 1, [`duelStats.${field}`]: 1 } })
    }),
  )
}

export const winsNeeded = (duel: DuelDoc) => duelWinsNeeded(duel.best ?? DUEL_DEFAULT.best)

export async function settle(duel: DuelDoc): Promise<DuelDoc> {
  if (duel.status !== 'playing') return duel
  const timeUp = duel.endsAt ? Date.now() >= duel.endsAt.getTime() : false
  if (!timeUp && !duel.players.every(done)) return duel
  const winnerId = decide(duel)
  const winnerIndex = winnerId ? duel.players.findIndex((p) => p.userId.equals(winnerId)) : -1
  const matchDone = winnerIndex >= 0 && (duel.players[winnerIndex].wins ?? 0) + 1 >= winsNeeded(duel)
  const finished = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    {
      $set: { status: 'finished', finishedAt: new Date(), winnerId, matchDone },
      $inc: winnerIndex >= 0 ? { [`players.${winnerIndex}.wins`]: 1 } : { draws: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!finished) return (await duels()).findOne({ _id: duel._id }) as Promise<DuelDoc>
  await applyDuelStats(winnerId, finished.players)
  return finished
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

export async function duelView(duel: DuelDoc, userId: ObjectId) {
  const you = sideOf(duel, userId)
  const rival = duel.players.find((p) => !p.userId.equals(userId))
  const playing = duel.status === 'playing'
  const finished = duel.status === 'finished'
  const game = duel.game as GameId | undefined
  const byId = game ? (await gameData(game)).byId : null
  const answer = byId && duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const ability =
    duel.mode === 'ability' && you && answer && (finished || wrongCount(duel, you) >= ABILITY_HINT_AT)
      ? abilityByKey(duel.answerId!, duel.extra ?? undefined)?.name
      : undefined
  return {
    code: duel.code,
    game: duel.game ?? null,
    mode: duel.mode ?? null,
    status: duel.status,
    best: duel.best ?? DUEL_DEFAULT.best,
    seconds: duel.seconds || DUEL_DEFAULT.seconds,
    needed: winsNeeded(duel),
    matchDone: Boolean(duel.matchDone),
    invited: duel.invite && !duel.invite.declined && duel.players.length < 2 ? duel.invite.nickname : null,
    declined: Boolean(duel.invite?.declined) && duel.players.length < 2,
    round: duel.round,
    draws: duel.draws,
    host: isHost(duel, userId),
    now: Date.now(),
    startedAt: duel.startedAt?.getTime(),
    endsAt: duel.endsAt?.getTime(),
    hintAt: duel.mode === 'ability' ? ABILITY_HINT_AT : undefined,
    ability,
    image: playing || finished ? (duel.mode === 'image' || duel.mode === 'ability' ? `/api/round/image?duel=${duel.code}&r=${duel.round}` : undefined) : undefined,
    answerId: finished || you?.solvedAt ? duel.answerId : undefined,
    winner: finished ? (duel.winnerId ? duel.players.find((p) => p.userId.equals(duel.winnerId!))?.nickname ?? null : null) : undefined,
    youWon: finished ? Boolean(duel.winnerId && duel.winnerId.equals(userId)) : undefined,
    you: you && {
      nickname: you.nickname,
      ready: you.ready,
      wantsNext: Boolean(you.wantsNext),
      wins: you.wins ?? 0,
      solved: Boolean(you.solvedAt),
      gaveUp: Boolean(you.gaveUp),
      guesses: (playing || finished) && byId && answer
        ? you.guesses
            .filter((id) => byId.has(id))
            .map((id) => ({ id, judgement: duel.mode === 'classic' ? judgeAll(game!, byId.get(id)!, answer) : undefined }))
        : [],
    },
    rival: rival && {
      nickname: rival.nickname,
      ready: rival.ready,
      wantsNext: Boolean(rival.wantsNext),
      wins: rival.wins ?? 0,
      solved: Boolean(rival.solvedAt),
      gaveUp: Boolean(rival.gaveUp),
      guessCount: rival.guesses.length,
    },
  }
}
