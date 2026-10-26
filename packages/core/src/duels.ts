import { randomInt } from 'node:crypto'
import { ObjectId } from 'mongodb'
import {
  ABILITY_HINT_AT,
  ABILITY_STAGES,
  BOARD_DEFAULT,
  BOARD_SIZES,
  CLUE_DEFAULT,
  clueSide,
  DUEL_DEFAULT,
  DUEL_MATCH_XP,
  DUEL_MODES,
  DUEL_TEAM_COUNTS,
  DUEL_TEAM_SIZES,
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
  ZOOM_REVEAL,
  zoomAt,
  duelWinsNeeded,
  hasMode,
  judgeAll,
  teamCount,
  teamSize,
  TEAM_MODES,
  type GameId,
  type ModeId,
} from '@nanda/game'
import { abilityByKey } from './abilities'
import { duels, users, type DuelDoc, type DuelLogRow, type DuelPlayer, type UserDoc } from './db'
import { modePool, optionsOf, phraseAt, phraseCount, roundExtra } from './extra'
import { gameData, isGame, isMode } from './games'
import { matchesFacet, planGrid } from './grid'
import { BLACK, GREY, cleanCount, cleanWord, clueBoard, clueSizes, clueWinner, kindFor, sideLeft, teamKey } from './clue'
import { addXp, defaultNickname } from './profile'
import { sendPush, type PushLang } from './push'
import { duelSeed, focusFor, shotFor } from './crop'
import { markSeasonDuel } from './season'

export const MIN_GAP_MS = 800
export const RUSH_PER_TRY_MS = 10_000
export const DUEL_LOG_MAX = 10
const BOARD_ROWS = 10
const CROWD_ROWS = 5
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const code = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

const nameOf = (doc: UserDoc) => doc.nickname ?? defaultNickname(doc.username)

const player = (doc: UserDoc): DuelPlayer => ({
  userId: doc._id!,
  nickname: nameOf(doc),
  avatar: doc.avatar ?? null,
  frame: doc.frame ?? null,
  banner: doc.banner ?? null,
  title: doc.title ?? null,
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

export const perTeam = (duel: DuelDoc) => teamSize(duel.mode, duel.per)

export const sideCount = (duel: DuelDoc) => teamCount(duel.mode, duel.teams)

export const seatsOf = (duel: DuelDoc) => perTeam(duel) * sideCount(duel)

const lineUp = (duel: DuelDoc) => Array.from({ length: sideCount(duel) }, (_, team) => team)

const teamOf = (duel: DuelDoc, side: DuelPlayer) => {
  const want = Number(side.team)
  return Number.isInteger(want) && want >= 0 && want < sideCount(duel) ? want : 0
}

const squad = (duel: DuelDoc, team: number) => duel.players.filter((side) => teamOf(duel, side) === team)

const thinner = (duel: DuelDoc) =>
  lineUp(duel).reduce((best, team) => (squad(duel, team).length < squad(duel, best).length ? team : best), 0)

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
      invites: invited ? [{ toId: invited._id!, nickname: nameOf(invited), at: new Date() }] : [],
      round: 0,
      draws: 0,
      per: 1,
      players: [{ ...player(doc), team: 0 }],
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
  const seats = seatsOf(duel)
  if (duel.players.length >= seats) return null
  const team = thinner(duel)
  return (await duels()).findOneAndUpdate(
    { _id: duel._id, players: { $size: duel.players.length } },
    { $push: { players: { ...player(doc), team } } },
    { returnDocument: 'after' },
  )
}

export async function switchTeam(duel: DuelDoc, userId: ObjectId) {
  if (duel.status !== 'lobby') return duel
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  if (index < 0) return duel
  const now = teamOf(duel, duel.players[index])
  const line = lineUp(duel)
  const want = line.slice(now + 1).concat(line.slice(0, now)).find((team) => squad(duel, team).length < perTeam(duel))
  if (want === undefined) return duel
  const calm = Object.fromEntries(duel.players.map((_, slot) => [`players.${slot}.ready`, false]))
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { ...calm, [`players.${index}.team`]: want } },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

export const boardSizes = (pool: number) => {
  const fits = (BOARD_SIZES as readonly number[]).filter((side) => side * side <= pool)
  return fits.length ? fits : [BOARD_SIZES[0]]
}

export async function setupDuel(duel: DuelDoc, userId: ObjectId, body: Record<string, unknown>) {
  if (!isHost(duel, userId) || duel.status !== 'lobby') return duel
  const { game, mode } = body
  if (!isGame(game) || !isMode(mode) || !DUEL_MODES.includes(mode)) return null
  if (mode !== 'who' && mode !== 'clue' && !hasMode(game, mode)) return null
  const best = rounds(body.best) ?? duel.best ?? DUEL_DEFAULT.best
  const limit = seconds(body.seconds) ?? duel.seconds ?? DUEL_DEFAULT.seconds
  const pool = (await gameData(game)).pool.length
  const allowed = mode === 'clue' ? clueSizes(pool) : boardSizes(pool)
  if (!allowed.length) return null
  const asked = Number(body.size) || duel.size || (mode === 'clue' ? CLUE_DEFAULT : BOARD_DEFAULT)
  const size = allowed.includes(asked) ? asked : Math.max(...allowed.filter((side) => side <= asked), allowed[0])
  const strict = typeof body.strict === 'boolean' ? body.strict : duel.strict ?? false
  const here = duel.players.length
  const wantPer = teamSize(mode, body.per ?? duel.per)
  const wantTeams = teamCount(mode, body.teams ?? duel.teams)
  const per = wantPer * wantTeams >= here ? wantPer : Math.min(Math.max(...DUEL_TEAM_SIZES), Math.max(wantPer, Math.ceil(here / wantTeams)))
  const teams = per * wantTeams >= here ? wantTeams : Math.min(Math.max(...DUEL_TEAM_COUNTS), Math.max(wantTeams, Math.ceil(here / per)))
  const plan = { ...duel, mode, per, teams } as DuelDoc
  const room = Array.from({ length: teams }, () => 0)
  const calm = Object.fromEntries(duel.players.map((_, slot) => [`players.${slot}.ready`, false]))
  const seated = Object.fromEntries(
    duel.players.map((side, index) => {
      const want = side.team === undefined ? index % teams : teamOf(plan, side)
      const team = room[want] < per ? want : room.findIndex((taken) => taken < per)
      const seat = team < 0 ? want : team
      room[seat] += 1
      return [`players.${index}.team`, seat]
    }),
  )
  const chiefs = Array.from({ length: teams }, () => false)
  const roles = Object.fromEntries(
    duel.players.map((side, index) => {
      const team = Number(seated[`players.${index}.team`])
      const keep = mode === 'clue' && Boolean(side.lead) && !chiefs[team]
      if (keep) chiefs[team] = true
      return [`players.${index}.lead`, keep]
    }),
  )
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { game, mode, best, seconds: limit, size, strict, per, teams, ...seated, ...roles, ...calm } },
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
  if (!isHost(duel, userId) || duel.status !== 'lobby' || duel.players.length >= seatsOf(duel)) return null
  if (typeof targetId !== 'string' || !ObjectId.isValid(targetId)) return null
  const _id = new ObjectId(targetId)
  if (_id.equals(userId) || sideOf(duel, _id)) return null
  const target = await (await users()).findOne({ _id })
  if (!target) return null
  const invites = [...(duel.invites ?? []).filter((one) => !one.toId.equals(_id)), { toId: _id, nickname: nameOf(target), at: new Date() }]
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { invites: invites.slice(-INVITES_MAX) } },
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
const INVITES_MAX = 8

const inviteFor = (duel: DuelDoc, userId: ObjectId) => duel.invites?.find((one) => one.toId.equals(userId))

const pendingInvites = (duel: DuelDoc) =>
  duel.players.length < seatsOf(duel) ? (duel.invites ?? []).filter((one) => !one.declined && !sideOf(duel, one.toId)) : []

export async function duelInvites(userId: ObjectId) {
  const list = await (await duels())
    .find({
      status: 'lobby',
      invites: { $elemMatch: { toId: userId, declined: { $ne: true }, at: { $gt: new Date(Date.now() - INVITE_MS) } } },
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()
  const seen = new Set<string>()
  return list
    .filter((duel) => !sideOf(duel, userId) && duel.players.length < seatsOf(duel))
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
      at: (inviteFor(duel, userId)?.at ?? duel.createdAt).toISOString(),
    }))
}

export async function declineInvite(duel: DuelDoc, userId: ObjectId) {
  if (!inviteFor(duel, userId)) return null
  await (await duels()).updateOne({ _id: duel._id, 'invites.toId': userId }, { $set: { 'invites.$.declined': true } })
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

async function clueStart(duel: DuelDoc) {
  const board = await clueBoard(duel.game as GameId, duel.size, duel.clue?.cards ?? [])
  const startedAt = new Date()
  return {
    status: 'playing' as const,
    round: duel.round + 1,
    answerId: 0,
    extra: null,
    startedAt,
    endsAt: null,
    firstId: null,
    turnId: null,
    grid: null,
    clue: board,
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
  if (duel.mode === 'clue') return clueStart(duel)
  const game = duel.game as GameId
  const pool = modePool((await gameData(game)).pool, duel.mode as ModeId)
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
  if (!clueSeated(withReady)) return withReady
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
  const standing = new Set(rest.map((side) => teamOf(duel, side)))
  if (running && played && standing.size === 1 && gone.some((side) => !standing.has(teamOf(duel, side)))) {
    const winnerTeam = [...standing][0]
    const at = new Date()
    const scores = duel.players.map((side) => ({
      userId: side.userId,
      nickname: side.nickname,
      team: teamOf(duel, side),
      wins: side.wins ?? 0,
    }))
    await applyDuelStats(winnerTeam, [...rest, ...gone], duel.mode)
    await pushDuelLog(scores, winnerTeam, duel.game, duel.mode, at)
    await Promise.all(rest.map((side) => markSeasonDuel(side.userId, true, at)))
    await Promise.all(rest.map((side) => duelXp(side.userId, (duel.mode ?? 'classic') as ModeId, true)))
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
        invites: [],
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

export async function touchSide(duel: DuelDoc, userId: ObjectId, look?: { frame?: string | null; banner?: string | null; title?: string | null }) {
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  if (index < 0) return duel
  const side = duel.players[index]!
  const fresh =
    look &&
    (side.frame !== (look.frame ?? null) || side.banner !== (look.banner ?? null) || side.title !== (look.title ?? null))
      ? {
          [`players.${index}.frame`]: look.frame ?? null,
          [`players.${index}.banner`]: look.banner ?? null,
          [`players.${index}.title`]: look.title ?? null,
        }
      : {}
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id },
    { $set: { [`players.${index}.seenAt`]: new Date(), ...fresh } },
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

const turnMode = (duel: DuelDoc) => duel.mode === 'who' || duel.mode === 'grid' || duel.mode === 'clue'

function decide(duel: DuelDoc) {
  if (turnMode(duel)) {
    const solver = duel.players.find((side) => side.solvedAt)
    if (solver) return teamOf(duel, solver)
    if (duel.players.length > 1 && duel.players.every((side) => side.gaveUp)) return null
    const missed = duel.players.find((side) => side.gaveUp)
    return missed ? lineUp(duel).find((team) => team !== teamOf(duel, missed)) ?? null : null
  }

  const tally = (team: number) => {
    const mates = squad(duel, team)
    const solvers = mates.filter((side) => side.solvedAt)
    const last = Math.max(0, ...solvers.map((side) => side.solvedAt!.getTime()))
    return {
      alive: mates.length > 0,
      full: mates.length > 0 && solvers.length === mates.length,
      solved: solvers.length,
      guesses: mates.reduce((sum, side) => sum + side.guesses.length, 0),
      time: solvers.length ? last - (duel.startedAt?.getTime() ?? 0) : Infinity,
    }
  }

  const boards = lineUp(duel)
    .map((team) => ({ team, ...tally(team) }))
    .filter((one) => one.alive)
  if (boards.length < 2) return null

  const rank = (a: typeof boards[number], b: typeof boards[number]) => {
    if (a.full !== b.full) return a.full ? -1 : 1
    if (a.solved !== b.solved) return b.solved - a.solved
    if (a.guesses !== b.guesses) return a.guesses - b.guesses
    return a.time - b.time
  }

  const [best, next] = [...boards].sort(rank)
  if (!best.full && !best.solved) return null
  return rank(best, next) === 0 ? null : best.team
}

async function pushDuelLog(
  scores: { userId: ObjectId; nickname: string; team: number; wins: number }[],
  winnerTeam: number | null,
  game: string | undefined,
  mode: string | undefined,
  at: Date,
) {
  const collection = await users()
  const best = (team: number) => Math.max(0, ...scores.filter((side) => side.team === team).map((side) => side.wins))
  await Promise.all(
    scores.map((side) => {
      const foes = scores.filter((one) => one.team !== side.team)
      const row: DuelLogRow = {
        at,
        game,
        mode,
        rivalId: foes[0]?.userId,
        rival: foes.map((one) => one.nickname).join(', '),
        wins: side.wins,
        losses: best(side.team === 0 ? 1 : 0),
        won: winnerTeam !== null && side.team === winnerTeam,
      }
      return collection.updateOne({ _id: side.userId }, { $push: { duelLog: { $each: [row], $slice: -DUEL_LOG_MAX } } })
    }),
  )
}

async function applyDuelStats(winnerTeam: number | null, players: DuelPlayer[], mode?: string) {
  const collection = await users()
  const byMode = mode ? { [`duelStats.modes.${mode}.played`]: 1 } : {}
  await Promise.all(
    players.map((side) => {
      const field = winnerTeam === null ? 'draws' : side.team === winnerTeam ? 'wins' : 'losses'
      const won = mode && field === 'wins' ? { [`duelStats.modes.${mode}.wins`]: 1 } : {}
      return collection.updateOne({ _id: side.userId }, { $inc: { 'duelStats.played': 1, [`duelStats.${field}`]: 1, ...byMode, ...won } })
    }),
  )
}

export const winsNeeded = (duel: DuelDoc) => duelWinsNeeded(duel.best ?? DUEL_DEFAULT.best)

export const clueSeated = (duel: DuelDoc) =>
  duel.mode !== 'clue' ||
  lineUp(duel).every((team) => {
    const mates = squad(duel, team)
    return mates.some((side) => side.lead) && mates.some((side) => !side.lead)
  })

export async function takeSeat(duel: DuelDoc, userId: ObjectId, team: unknown, lead: unknown) {
  const index = duel.players.findIndex((side) => side.userId.equals(userId))
  if (index < 0 || duel.status !== 'lobby') return duel
  const sides = sideCount(duel)
  const want = Math.floor(Number(team))
  if (!Number.isInteger(want) || want < 0 || want >= sides) return duel

  const asLead = duel.mode === 'clue' && Boolean(lead)
  const me = duel.players[index]
  if (teamOf(duel, me) === want && Boolean(me.lead) === asLead) return duel

  const mates = duel.players.filter((side, at) => at !== index && teamOf(duel, side) === want)
  if (mates.length >= perTeam(duel)) return duel
  if (asLead && mates.some((side) => side.lead)) return duel
  if (!asLead && duel.mode === 'clue' && mates.filter((side) => !side.lead).length >= perTeam(duel) - 1) return duel

  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'lobby' },
    { $set: { [`players.${index}.team`]: want, [`players.${index}.lead`]: asLead, [`players.${index}.ready`]: false } },
    { returnDocument: 'after' },
  )
  return updated ?? duel
}

const clueLive = (duel: DuelDoc, userId: ObjectId) => {
  const side = sideOf(duel, userId)
  if (!side || duel.mode !== 'clue' || duel.status !== 'playing' || !duel.clue) return null
  return { side, board: duel.clue, team: teamOf(duel, side) }
}

export async function giveClue(duel: DuelDoc, userId: ObjectId, word: unknown, count: unknown) {
  const live = clueLive(duel, userId)
  if (!live) return { error: 'round_over' as const }
  if (!live.side.lead || live.team !== live.board.turn) return { error: 'not_your_turn' as const }
  if (live.board.word) return { error: 'duplicate' as const }
  const text = cleanWord(word)
  if (!text) return { error: 'bad_request' as const }
  const number = cleanCount(count, live.board.cards.length)
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    { $set: { 'clue.word': text, 'clue.count': number, 'clue.left': number + 1, 'clue.hit': null } },
    { returnDocument: 'after' },
  )
  return { duel: updated ?? duel }
}

const clueFinish = (duel: DuelDoc, winner: number) =>
  Object.fromEntries(
    duel.players.flatMap((side, index) => (teamOf(duel, side) === winner ? [[`players.${index}.solvedAt`, new Date()]] : [])),
  )

export async function openCard(duel: DuelDoc, userId: ObjectId, index: unknown) {
  const live = clueLive(duel, userId)
  if (!live) return { error: 'round_over' as const }
  const { board, side, team } = live
  const cell = Math.floor(Number(index))
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.cards.length) return { error: 'bad_request' as const }
  if (side.lead || team !== board.turn) return { error: 'not_your_turn' as const }
  if (!board.word || (board.left ?? 0) <= 0) return { error: 'no_clue' as const }
  if (board.open[cell] >= 0) return { error: 'cell_taken' as const }

  const key = board.key[cell]
  const open = [...board.open]
  open[cell] = team
  const next = { ...board, open } as NonNullable<DuelDoc['clue']>

  const mine = key === teamKey(team)
  const left = mine ? (board.left ?? 1) - 1 : 0
  const keep = mine && left > 0
  const hit = key === BLACK ? { index: cell, kind: BLACK } : key === GREY || !mine ? { index: cell, kind: key } : null

  const set: Record<string, unknown> = {
    'clue.open': open,
    'clue.left': keep ? left : 0,
    'clue.word': keep ? board.word : null,
    'clue.count': keep ? board.count ?? 0 : 0,
    'clue.turn': keep ? board.turn : 1 - board.turn,
    'clue.hit': hit,
  }

  const winner = key === BLACK ? 1 - team : clueWinner({ ...duel, clue: next } as DuelDoc)
  if (winner !== null) {
    set['clue.turn'] = board.turn
    Object.assign(set, clueFinish(duel, winner))
  }

  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    { $set: set },
    { returnDocument: 'after' },
  )
  return { duel: updated ?? duel }
}

export async function cluePass(duel: DuelDoc, userId: ObjectId) {
  const live = clueLive(duel, userId)
  if (!live) return { error: 'round_over' as const }
  const { board, side, team } = live
  if (side.lead || team !== board.turn) return { error: 'not_your_turn' as const }
  if (!board.word) return { error: 'no_clue' as const }
  const updated = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    { $set: { 'clue.word': null, 'clue.count': 0, 'clue.left': 0, 'clue.turn': 1 - board.turn, 'clue.hit': null } },
    { returnDocument: 'after' },
  )
  return { duel: updated ?? duel }
}

export async function settle(duel: DuelDoc): Promise<DuelDoc> {
  if (duel.status !== 'playing') return duel
  const timeUp = duel.endsAt ? Date.now() >= duel.endsAt.getTime() : false
  const over = turnMode(duel) ? duel.players.some(done) : duel.players.every(done)
  if (!timeUp && !over) return duel
  const winnerTeam = decide(duel)
  const champs = winnerTeam === null ? [] : duel.players.filter((side) => teamOf(duel, side) === winnerTeam)
  const lead = champs.find((side) => side.solvedAt) ?? champs[0] ?? null
  const winnerId = lead?.userId ?? null
  const taken = (lead?.wins ?? 0) + 1
  const matchDone = duel.bot ? true : champs.length > 0 && taken >= winsNeeded(duel)
  const solvedAt = champs.reduce<Date | null>((latest, side) => (side.solvedAt && (!latest || side.solvedAt > latest) ? side.solvedAt : latest), null)
  const ms = solvedAt && duel.startedAt ? solvedAt.getTime() - duel.startedAt.getTime() : null
  const at = new Date()
  const scores = duel.players.map((side) => ({
    userId: side.userId,
    nickname: side.nickname,
    team: teamOf(duel, side),
    wins: (side.wins ?? 0) + (winnerTeam !== null && teamOf(duel, side) === winnerTeam ? 1 : 0),
  }))
  const won = Object.fromEntries(
    duel.players.flatMap((side, index) => (winnerTeam !== null && teamOf(duel, side) === winnerTeam ? [[`players.${index}.wins`, 1]] : [])),
  )
  const finished = await (await duels()).findOneAndUpdate(
    { _id: duel._id, status: 'playing' },
    {
      $set: { status: 'finished', finishedAt: at, winnerId, winnerTeam, matchDone },
      $inc: winnerTeam !== null ? won : { draws: 1 },
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
    await applyDuelStats(winnerTeam, finished.players, duel.mode)
    await pushDuelLog(scores, winnerTeam, duel.game, duel.mode, at)
    await Promise.all(champs.map((side) => markSeasonDuel(side.userId, true, at)))
    const beaten = Math.max(0, ...scores.filter((side) => side.team !== winnerTeam).map((side) => side.wins))
    if (beaten >= 2) await (await users()).updateMany({ _id: { $in: champs.map((side) => side.userId) } }, { $set: { duelComeback: true } })
  }
  if (champs.length) {
    if (ms && ms > 0 && winnerId) await (await users()).updateOne({ _id: winnerId }, { $min: { duelBestMs: ms } })
    await Promise.all(champs.map((side) => duelXp(side.userId, duel.mode as ModeId, matchDone)))
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
  if (solved && !duel.firstSolvedAt) {
    set.firstSolvedAt = now
    const rush = new Date(now.getTime() + (side.guesses.length + 1) * RUSH_PER_TRY_MS)
    if (!turnMode(duel) && (!duel.endsAt || rush < duel.endsAt)) set.endsAt = rush
  }
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
      invites: [],
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
  return revealed ? ZOOM_REVEAL : Math.min(wrongCount(duel, side), ZOOM_LEVELS.length - 1)
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
  return { focus, zoom: zoomAt(step), ...(shot ? { shot } : {}) }
}

export async function duelView(duel: DuelDoc, userId: ObjectId, known = false) {
  const you = sideOf(duel, userId)
  const mine = duel.players.findIndex((p) => p.userId.equals(userId))
  const yours = you ? teamOf(duel, you) : 0
  const rival = duel.players.find((p) => teamOf(duel, p) !== yours) ?? duel.players.find((p) => !p.userId.equals(userId))
  const playing = duel.status === 'playing'
  const finished = duel.status === 'finished'
  const game = duel.game as GameId | undefined
  const data = game ? await gameData(game) : null
  const byId = data?.byId ?? null
  const answer = byId && duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const foes = duel.players.filter((p) => teamOf(duel, p) !== yours)
  const boardOf = (side: DuelPlayer, rows: number) =>
    duel.mode === 'classic' && byId && answer
      ? side.guesses
          .slice(-rows)
          .map((id) => byId.get(id))
          .filter((entity) => entity !== undefined)
          .map((entity) => Object.fromEntries(Object.entries(judgeAll(game!, entity, answer)).map(([key, value]) => [key, value.verdict])))
      : undefined
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
    invited: pendingInvites(duel).map((one) => one.nickname).join(', ') || null,
    declined: Boolean(duel.invites?.at(-1)?.declined) && duel.players.length < seatsOf(duel),
    left: duel.left && duel.players.length < seatsOf(duel) && Date.now() - duel.left.at.getTime() < 120_000 ? duel.left.nickname : null,
    per: perTeam(duel),
    teams: sideCount(duel),
    seats: seatsOf(duel),
    teamly: TEAM_MODES.includes(duel.mode as ModeId),
    youTeam: yours,
    winnerTeam: finished ? duel.winnerTeam ?? null : undefined,
    squads: lineUp(duel).map((team) =>
      squad(duel, team).map((side) => ({
        id: side.userId.toHexString(),
        nickname: side.nickname,
        avatar: side.avatar ?? null,
        frame: side.frame ?? null,
        banner: side.banner ?? null,
        title: side.title ?? null,
        you: side.userId.equals(userId),
        lead: Boolean(side.lead),
        ready: side.ready,
        wins: side.wins ?? 0,
        solved: Boolean(side.solvedAt),
        gaveUp: Boolean(side.gaveUp),
        guessCount: side.guesses.length,
      })),
    ),
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
    youWon: finished ? duel.winnerTeam !== null && duel.winnerTeam !== undefined && duel.winnerTeam === yours : undefined,
    ...(duel.mode === 'who' ? { size: duel.size ?? BOARD_DEFAULT, sizes: boardSizes(data?.pool.length ?? 0) } : {}),
    ...(duel.mode === 'clue' ? { size: clueSide(duel.size), sizes: clueSizes(data?.pool.length ?? 0) } : {}),
    ...(duel.mode === 'clue' && duel.clue
      ? {
          clue: {
            cards: duel.clue.cards,
            opened: duel.clue.open.map((by) => (by >= 0 ? by : null)),
            shown: duel.clue.open.map((by, index) => (by >= 0 ? kindFor(duel.clue!.key[index], yours) : null)),
            key: you?.lead || finished ? duel.clue.key.map((one) => kindFor(one, yours)) : undefined,
            turn: duel.clue.turn,
            yours: duel.clue.turn === yours,
            lead: Boolean(you?.lead),
            word: duel.clue.word ?? null,
            count: duel.clue.count ?? 0,
            left: duel.clue.left ?? 0,
            hit: duel.clue.hit ?? null,
            mine: sideLeft(duel, yours),
            foes: sideLeft(duel, 1 - yours),
          },
        }
      : {}),
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
      lead: Boolean(you.lead),
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
      board: boardOf(rival, BOARD_ROWS),
    },
    rivals:
      foes.length > 1
        ? foes.map((side) => ({
            id: side.userId.toHexString(),
            nickname: side.nickname,
            solved: Boolean(side.solvedAt),
            gaveUp: Boolean(side.gaveUp),
            guessCount: side.guesses.length,
            board: boardOf(side, CROWD_ROWS),
          }))
        : undefined,
  }
}
