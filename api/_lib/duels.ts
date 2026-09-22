import { randomInt } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { hasMode, judgeAll, type GameId } from '../../src/games/specs.js'
import { abilityByKey } from './abilities.js'
import { duels, users, type DuelDoc, type DuelPlayer, type UserDoc } from './db.js'
import { roundExtra } from './extra.js'
import { gameData, isGame, isMode } from './games.js'
import { defaultNickname } from './profile.js'

export const DUEL_MS = 10 * 60 * 1000
export const SUDDEN_DEATH_MS = 60 * 1000
export const MIN_GAP_MS = 800
const ABILITY_STAGES = 5
const ABILITY_HINT_AT = 7
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const HISTORY = 20

const code = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

const nameOf = (doc: UserDoc) => doc.nickname ?? defaultNickname(doc.username)

const player = (doc: UserDoc): DuelPlayer => ({ userId: doc._id!, nickname: nameOf(doc), ready: false, guesses: [] })

export const wrongCount = (duel: DuelDoc, side: DuelPlayer) => side.guesses.filter((g) => g !== duel.answerId).length

export const abilityStageOf = (duel: DuelDoc, side: DuelPlayer) => {
  const wrong = wrongCount(duel, side)
  return duel.status === 'finished' || side.solvedAt || wrong >= ABILITY_STAGES ? '' : `s${wrong}/`
}

export async function createDuel(doc: UserDoc, game: unknown, mode: unknown) {
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return null
  const { pool } = gameData(game)
  const answer = pool[randomInt(pool.length)]
  const extra = roundExtra(mode, answer.id)
  const collection = await duels()
  for (let attempt = 0; attempt < 5; attempt++) {
    const duel: DuelDoc = {
      code: code(),
      game,
      mode,
      answerId: answer.id,
      ...(extra ? { extra } : {}),
      status: 'waiting',
      players: [player(doc)],
      createdAt: new Date(),
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
  typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value) ? (await duels()).findOne({ code: value }) : null

export const sideOf = (duel: DuelDoc, userId: ObjectId) => duel.players.find((p) => p.userId.equals(userId))

export async function joinDuel(duel: DuelDoc, doc: UserDoc) {
  if (sideOf(duel, doc._id!)) return duel
  if (duel.status !== 'waiting' || duel.players.length >= 2) return null
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'waiting', players: { $size: 1 } },
    { $push: { players: player(doc) } },
    { returnDocument: 'after' },
  )
  return updated
}

export async function setReady(duel: DuelDoc, userId: ObjectId) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  if (index < 0 || duel.status !== 'waiting') return duel
  const collection = await duels()
  const withReady = await collection.findOneAndUpdate(
    { _id: duel._id, status: 'waiting' },
    { $set: { [`players.${index}.ready`]: true } },
    { returnDocument: 'after' },
  )
  if (!withReady) return duel
  if (withReady.players.length < 2 || !withReady.players.every((p) => p.ready)) return withReady
  const startedAt = new Date()
  const started = await collection.findOneAndUpdate(
    { _id: duel._id, status: 'waiting' },
    { $set: { status: 'playing', startedAt, endsAt: new Date(startedAt.getTime() + DUEL_MS) } },
    { returnDocument: 'after' },
  )
  return started ?? withReady
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

export async function settle(duel: DuelDoc): Promise<DuelDoc> {
  if (duel.status !== 'playing') return duel
  const over = Date.now() >= (duel.endsAt?.getTime() ?? 0) || duel.players.every(done)
  if (!over) return duel
  const winnerId = decide(duel)
  const finished = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    { $set: { status: 'finished', finishedAt: new Date(), winnerId } },
    { returnDocument: 'after' },
  )
  if (!finished) return (await duels()).findOne({ _id: duel._id }) as Promise<DuelDoc>
  await applyDuelStats(winnerId, finished.players)
  return finished
}

export async function duelGuess(duel: DuelDoc, userId: ObjectId, entityId: number) {
  const index = duel.players.findIndex((p) => p.userId.equals(userId))
  const side = duel.players[index]
  if (index < 0) return { error: 'not_found' as const }
  if (duel.status !== 'playing') return { error: 'round_over' as const }
  if (done(side)) return { error: 'round_over' as const }
  if (!gameData(duel.game as GameId).byId.has(entityId)) return { error: 'bad_request' as const }
  if (side.guesses.includes(entityId)) return { error: 'duplicate' as const }

  const now = new Date()
  const solved = entityId === duel.answerId
  const set: Record<string, unknown> = { [`players.${index}.lastGuessAt`]: now }
  if (solved) set[`players.${index}.solvedAt`] = now
  if (solved && !duel.firstSolvedAt) {
    set.firstSolvedAt = now
    const rush = new Date(now.getTime() + SUDDEN_DEATH_MS)
    if (rush < (duel.endsAt ?? rush)) set.endsAt = rush
  }
  const updated = await (await duels()).findOneAndUpdate(
    {
      _id: duel._id,
      status: 'playing',
      [`players.${index}.guesses`]: { $ne: entityId },
      $or: [
        { [`players.${index}.lastGuessAt`]: { $exists: false } },
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

export function duelView(duel: DuelDoc, userId: ObjectId) {
  const game = duel.game as GameId
  const { byId } = gameData(game)
  const answer = byId.get(duel.answerId)!
  const you = sideOf(duel, userId)
  const rival = duel.players.find((p) => !p.userId.equals(userId))
  const finished = duel.status === 'finished'
  const ability =
    duel.mode === 'ability' && you && (finished || wrongCount(duel, you) >= ABILITY_HINT_AT)
      ? abilityByKey(duel.answerId, duel.extra)?.name
      : undefined
  return {
    code: duel.code,
    game: duel.game,
    mode: duel.mode,
    status: duel.status,
    now: Date.now(),
    startedAt: duel.startedAt?.getTime(),
    endsAt: duel.endsAt?.getTime(),
    hintAt: duel.mode === 'ability' ? ABILITY_HINT_AT : undefined,
    ability,
    image: duel.mode === 'image' || duel.mode === 'ability' ? `/api/round/image?duel=${duel.code}` : undefined,
    answerId: finished ? duel.answerId : undefined,
    winner: finished ? (duel.winnerId ? duel.players.find((p) => p.userId.equals(duel.winnerId!))?.nickname ?? null : null) : undefined,
    youWon: finished ? Boolean(duel.winnerId && duel.winnerId.equals(userId)) : undefined,
    you: you && {
      nickname: you.nickname,
      ready: you.ready,
      solved: Boolean(you.solvedAt),
      gaveUp: Boolean(you.gaveUp),
      guesses: you.guesses.map((id) => ({
        id,
        judgement: duel.mode === 'classic' ? judgeAll(game, byId.get(id)!, answer) : undefined,
      })),
    },
    rival: rival && {
      nickname: rival.nickname,
      ready: rival.ready,
      solved: Boolean(rival.solvedAt),
      gaveUp: Boolean(rival.gaveUp),
      guessCount: rival.guesses.length,
    },
  }
}

export async function duelHistory(userId: ObjectId) {
  const list = await (await duels())
    .find({ 'players.userId': userId, status: 'finished' }, { sort: { finishedAt: -1 }, limit: HISTORY })
    .toArray()
  return list.map((duel) => {
    const you = sideOf(duel, userId)!
    const rival = duel.players.find((p) => !p.userId.equals(userId))
    return {
      code: duel.code,
      game: duel.game,
      mode: duel.mode,
      at: duel.finishedAt?.getTime() ?? duel.createdAt.getTime(),
      you: { nickname: you.nickname, guesses: you.guesses.length, solved: Boolean(you.solvedAt) },
      rival: rival && { nickname: rival.nickname, guesses: rival.guesses.length, solved: Boolean(rival.solvedAt) },
      result: !duel.winnerId ? 'draw' : duel.winnerId.equals(userId) ? 'win' : 'loss',
    }
  })
}
