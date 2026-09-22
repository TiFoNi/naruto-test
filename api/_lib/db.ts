import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export type UserDoc = {
  _id?: ObjectId
  username: string
  usernameLower: string
  passwordHash: string
  nickname?: string
  stats?: Record<string, Partial<Stats>>
  duelStats?: { played?: number; wins?: number; losses?: number; draws?: number }
  createdAt: Date
}

export type Stats = { solved: number; streak: number; best: number; totalGuesses: number; lastDay?: string }

export type RoundStatus = 'active' | 'won' | 'lost' | 'skipped'

export type RoundDoc = {
  _id?: ObjectId
  userId: ObjectId
  game: string
  mode: string
  answerId: number
  guesses: number[]
  status: RoundStatus
  daily?: string
  extra?: string
  guessCount?: number
  lastGuessAt?: Date
  createdAt: Date
  finishedAt?: Date
}

export type DuelPlayer = {
  userId: ObjectId
  nickname: string
  ready: boolean
  guesses: number[]
  solvedAt?: Date
  gaveUp?: boolean
  lastGuessAt?: Date
}

export type DuelDoc = {
  _id?: ObjectId
  code: string
  game: string
  mode: string
  answerId: number
  extra?: string
  status: 'waiting' | 'playing' | 'finished'
  players: DuelPlayer[]
  createdAt: Date
  startedAt?: Date
  endsAt?: Date
  firstSolvedAt?: Date
  finishedAt?: Date
  winnerId?: ObjectId | null
}

export type DailyDoc = { _id: string; day: string; game: string; mode: string; answerId: number; extra?: string; createdAt: Date }

const cache = globalThis as typeof globalThis & {
  __mongo?: Promise<MongoClient>
  __usersIndexed?: Promise<unknown>
  __attemptsIndexed?: Promise<unknown>
  __roundsIndexed?: Promise<unknown>
  __duelsIndexed?: Promise<unknown>
}

const database = async () => (await client()).db(process.env.MONGODB_DB || 'nandaguessr')

export async function rounds(): Promise<Collection<RoundDoc>> {
  const collection = (await database()).collection<RoundDoc>('rounds')
  cache.__roundsIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, game: 1, mode: 1, status: 1 }),
    collection.createIndex({ userId: 1, game: 1, mode: 1, createdAt: -1 }),
    collection.createIndex(
      { userId: 1, game: 1, mode: 1, daily: 1 },
      { unique: true, partialFilterExpression: { daily: { $type: 'string' } } },
    ),
    collection.createIndex({ daily: 1, game: 1, mode: 1, status: 1, guessCount: 1, finishedAt: 1 }),
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

export async function duels(): Promise<Collection<DuelDoc>> {
  const collection = (await database()).collection<DuelDoc>('duels')
  cache.__duelsIndexed ??= Promise.all([
    collection.createIndex({ code: 1 }, { unique: true }),
    collection.createIndex({ 'players.userId': 1, createdAt: -1 }),
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
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

export async function users(): Promise<Collection<UserDoc>> {
  const collection = (await database()).collection<UserDoc>('users')
  cache.__usersIndexed ??= collection.createIndex({ usernameLower: 1 }, { unique: true }).catch((error) => {
    cache.__usersIndexed = undefined
    throw error
  })
  await cache.__usersIndexed
  return collection
}

export type AttemptDoc = { key: string; at: Date }

export async function attempts(): Promise<Collection<AttemptDoc>> {
  const collection = (await database()).collection<AttemptDoc>('attempts')
  cache.__attemptsIndexed ??= Promise.all([
    collection.createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 }),
    collection.createIndex({ key: 1, at: 1 }),
  ]).catch((error) => {
    cache.__attemptsIndexed = undefined
    throw error
  })
  await cache.__attemptsIndexed
  return collection
}
