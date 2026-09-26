import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export type UserDoc = {
  _id?: ObjectId
  username: string
  usernameLower: string
  passwordHash?: string
  nickname?: string
  xp?: number
  stats?: Record<string, Partial<Stats>>
  solvedTotal?: number
  visit?: { lastDay: string; streak: number; best: number; days: string[] }
  awards?: Record<string, Date>
  claimed?: Record<string, Date>
  resetAt?: Date
  pinned?: string[]
  duelStats?: { played?: number; wins?: number; losses?: number; draws?: number }
  challengeStats?: { solved?: number }
  createdAt: Date
}

export type Stats = { solved: number; streak: number; best: number; totalGuesses: number; skipped: number; lastDay?: string }

export type RoundStatus = 'active' | 'won' | 'lost' | 'skipped'

export type ChallengeSolve = { userId: ObjectId; nickname: string; guesses: number; guessIds?: number[]; solved: boolean; at: Date }

export type ChallengeDoc = {
  _id?: ObjectId
  code: string
  authorId: ObjectId
  author: string
  game: string
  mode: string
  answerId: number
  extra?: string
  solves: ChallengeSolve[]
  createdAt: Date
}

export type RoundDoc = {
  _id?: ObjectId
  userId: ObjectId
  game: string
  mode: string
  answerId: number
  guesses: number[]
  status: RoundStatus
  guest?: boolean
  daily?: string
  challenge?: string
  extra?: string
  guessCount?: number
  lastGuessAt?: Date
  startedAt?: Date
  createdAt: Date
  finishedAt?: Date
}

export type DuelPlayer = {
  userId: ObjectId
  nickname: string
  ready: boolean
  wantsNext?: boolean
  wins?: number
  guesses: number[]
  solvedAt?: Date | null
  gaveUp?: boolean
  lastGuessAt?: Date | null
}

export type DuelDoc = {
  _id?: ObjectId
  code: string
  hostId: ObjectId
  game?: string
  mode?: string
  answerId?: number
  extra?: string | null
  status: 'lobby' | 'playing' | 'finished'
  round: number
  draws: number
  players: DuelPlayer[]
  createdAt: Date
  touchedAt?: Date
  startedAt?: Date | null
  endsAt?: Date | null
  firstSolvedAt?: Date | null
  finishedAt?: Date | null
  winnerId?: ObjectId | null
}

export type EntityDoc = Record<string, unknown> & {
  game: string
  id: number
  answer: boolean
  hidden?: boolean
  updatedAt?: Date
}

export type SettingsDoc = { game: string; updated?: string }

export type QuestDoc = { _id: string; userId: ObjectId; day: string; picks: string[]; claimed: string[]; createdAt: Date }

export type SeasonDoc = { _id: string; season: string; userId: ObjectId; xp: number; solved: number; days: string[] }

export type DailyDoc = { _id: string; day: string; game: string; mode: string; answerId: number; extra?: string; createdAt: Date }

const cache = globalThis as typeof globalThis & {
  __mongo?: Promise<MongoClient>
  __usersIndexed?: Promise<unknown>
  __entitiesIndexed?: Promise<unknown>
  __settingsIndexed?: Promise<unknown>
  __questsIndexed?: Promise<unknown>
  __roundsIndexed?: Promise<unknown>
  __duelsIndexed?: Promise<unknown>
  __challengesIndexed?: Promise<unknown>
  __seasonsIndexed?: Promise<unknown>
}

export const database = async () => (await client()).db(process.env.MONGODB_DB || 'nandaguessr')

export async function rounds(): Promise<Collection<RoundDoc>> {
  const collection = (await database()).collection<RoundDoc>('rounds')
  cache.__roundsIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, game: 1, mode: 1, status: 1 }),
    collection.createIndex({ userId: 1, game: 1, mode: 1, createdAt: -1 }),
    collection.createIndex({ userId: 1, challenge: 1 }, { unique: true, partialFilterExpression: { challenge: { $exists: true } } }),
    collection.createIndex(
      { userId: 1, game: 1, mode: 1, daily: 1 },
      { unique: true, partialFilterExpression: { daily: { $type: 'string' } } },
    ),
    collection.createIndex({ daily: 1, game: 1, mode: 1, status: 1, guessCount: 1, finishedAt: 1 }),
    collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 7, partialFilterExpression: { guest: true } },
    ),
  ]).catch((error) => {
    cache.__roundsIndexed = undefined
    throw error
  })
  await cache.__roundsIndexed
  return collection
}

export async function dailies(): Promise<Collection<DailyDoc>> {
  return (await database()).collection<DailyDoc>('dailies')
}

export async function challenges(): Promise<Collection<ChallengeDoc>> {
  const collection = (await database()).collection<ChallengeDoc>('challenges')
  cache.__challengesIndexed ??= Promise.all([
    collection.createIndex({ code: 1 }, { unique: true }),
    collection.createIndex({ authorId: 1, createdAt: -1 }),
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }),
  ]).catch((error) => {
    cache.__challengesIndexed = undefined
    throw error
  })
  await cache.__challengesIndexed
  return collection
}

export async function duels(): Promise<Collection<DuelDoc>> {
  const collection = (await database()).collection<DuelDoc>('duels')
  cache.__duelsIndexed ??= Promise.all([
    collection.createIndex({ code: 1 }, { unique: true }),
    collection.createIndex({ 'players.userId': 1, createdAt: -1 }),
    collection.createIndex({ touchedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }),
    collection.dropIndex('createdAt_1').catch(() => undefined),
  ]).catch((error) => {
    cache.__duelsIndexed = undefined
    throw error
  })
  await cache.__duelsIndexed
  return collection
}

export function client() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  cache.__mongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }).connect().catch((error) => {
    cache.__mongo = undefined
    throw error
  })
  return cache.__mongo
}

export async function entities(): Promise<Collection<EntityDoc>> {
  const collection = (await database()).collection<EntityDoc>('entities')
  cache.__entitiesIndexed ??= Promise.all([
    collection.createIndex({ game: 1, id: 1 }, { unique: true }),
    collection.createIndex({ game: 1, answer: 1, hidden: 1 }),
  ]).catch((error) => {
    cache.__entitiesIndexed = undefined
    throw error
  })
  await cache.__entitiesIndexed
  return collection
}

export async function settings(): Promise<Collection<SettingsDoc>> {
  const collection = (await database()).collection<SettingsDoc>('settings')
  cache.__settingsIndexed ??= collection.createIndex({ game: 1 }, { unique: true }).catch((error) => {
    cache.__settingsIndexed = undefined
    throw error
  })
  await cache.__settingsIndexed
  return collection
}

export async function quests(): Promise<Collection<QuestDoc>> {
  const collection = (await database()).collection<QuestDoc>('quests')
  cache.__questsIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, day: -1 }),
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }),
  ]).catch((error) => {
    cache.__questsIndexed = undefined
    throw error
  })
  await cache.__questsIndexed
  return collection
}

export async function seasons(): Promise<Collection<SeasonDoc>> {
  const collection = (await database()).collection<SeasonDoc>('seasons')
  cache.__seasonsIndexed ??= collection.createIndex({ season: 1, xp: -1 }).catch((error) => {
    cache.__seasonsIndexed = undefined
    throw error
  })
  await cache.__seasonsIndexed
  return collection
}

export async function users(): Promise<Collection<UserDoc>> {
  const collection = (await database()).collection<UserDoc>('users')
  cache.__usersIndexed ??= Promise.all([
    collection.createIndex({ usernameLower: 1 }, { unique: true }),
    collection.createIndex({ solvedTotal: -1 }),
  ]).catch((error) => {
    cache.__usersIndexed = undefined
    throw error
  })
  await cache.__usersIndexed
  return collection
}

