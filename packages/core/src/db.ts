import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export type UserDoc = {
  _id?: ObjectId
  username: string
  usernameLower: string
  passwordHash?: string
  nickname?: string
  nicknameLower?: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  frames?: string[]
  framesSeen?: string[]
  xp?: number
  coins?: number
  coinsNews?: { coins: number; at: Date }
  bonusDay?: string
  levelsTaken?: number[]
  chatMutedUntil?: Date | null
  named?: boolean
  xpToday?: { day: string; daily: number; endless: number; duel?: number }
  stats?: Record<string, Partial<Stats>>
  solvedTotal?: number
  visit?: { lastDay: string; streak: number; best: number; days: string[] }
  awards?: Record<string, Date>
  tally?: import('./achievements').Tally
  awardsSolved?: number
  awardsAt?: Date
  lastChallengeAt?: Date | null
  xpGain?: number
  claimed?: Record<string, Date>
  resetAt?: Date
  pinned?: string[]
  showcase?: string[]
  tiles?: (string | null)[]
  avatarPreset?: string | null
  banner?: string
  banners?: string[]
  bannerLooks?: Record<string, Partial<Record<'desktop' | 'tablet' | 'phone' | 'board', { x: number; y: number; z: number }>>>
  tone?: string
  nickTone?: string
  title?: string | null
  titles?: string[]
  blocks?: string[]
  blockSizes?: Record<string, number>
  blockSides?: Record<string, number>
  blockSeen?: Record<string, number>
  duelStats?: { played?: number; wins?: number; losses?: number; draws?: number; modes?: Record<string, { played?: number; wins?: number }> }
  duelLog?: DuelLogRow[]
  duelBestMs?: number
  langs?: string[]
  lang?: string
  duelComeback?: boolean
  challengeStats?: { solved?: number }
  createdAt: Date
}

export type DuelLogRow = {
  at: Date
  game?: string
  mode?: string
  rivalId?: ObjectId
  rival: string
  wins: number
  losses: number
  won: boolean
}

export type Stats = { solved: number; streak: number; best: number; totalGuesses: number; skipped: number; lastDay?: string; day?: string; dayBest?: number; points?: number; bestStreak?: number }

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
  anime?: boolean
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
  team?: number
  lead?: boolean
  avatar?: string | null
  frame?: string | null
  banner?: string | null
  bannerLook?: Partial<Record<'desktop' | 'tablet' | 'phone' | 'board', { x: number; y: number; z: number }>> | null
  title?: string | null
  secret?: number
  cards?: number[]
  struck?: number[]
  answer?: number | null
  seenAt?: Date
  ready: boolean
  wantsNext?: boolean
  wins?: number
  guesses: number[]
  solvedAt?: Date | null
  gaveUp?: boolean
  lastGuessAt?: Date | null
}

export type DuelInvite = { toId: ObjectId; nickname: string; at: Date; declined?: boolean }

export type DuelDoc = {
  _id?: ObjectId
  code: string
  hostId: ObjectId
  game?: string
  mode?: string
  answerId?: number
  extra?: string | null
  status: 'lobby' | 'playing' | 'finished'
  best?: number
  seconds?: number | null
  size?: number
  per?: number
  teams?: number
  strict?: boolean
  bot?: boolean
  firstId?: ObjectId | null
  turnId?: ObjectId | null
  clue?: {
    cards: number[]
    key: number[]
    open: number[]
    turn: number
    word?: string | null
    count?: number
    left?: number
    hit?: { index: number; kind: number } | null
  } | null
  grid?: {
    rows: { key: string; value: string }[]
    cols: { key: string; value: string }[]
    marks: (number | null)[]
    picks?: (number | undefined)[]
    used: number[]
    miss?: { by: number; entityId: number } | null
  } | null
  invites?: DuelInvite[]
  left?: { nickname: string; at: Date } | null
  matchDone?: boolean
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
  winnerTeam?: number | null
}

export type EntityDoc = Record<string, unknown> & {
  game: string
  id: number
  answer: boolean
  hidden?: boolean
  updatedAt?: Date
}

export type SettingsDoc = { game: string; updated?: string; atlas?: string; tune?: Record<string, { scale: number; x: number; y: number; cut: number; cx: number; cy: number }> }

export type PurchaseDoc = {
  _id?: ObjectId
  userId: ObjectId
  packId: string
  base: number
  bonus: number
  usd: number
  charged?: number
  stars?: number
  way?: 'crypto' | 'stars'
  provider: string
  orderId: string
  invoiceId?: string
  paymentId?: string
  payCurrency?: string
  got?: number
  need?: number
  status: 'pending' | 'paid' | 'partial' | 'failed' | 'refunded'
  createdAt: Date
  updatedAt?: Date
}

export type LedgerDoc = {
  _id?: ObjectId
  userId: ObjectId
  delta: number
  reason: 'purchase' | 'refund'
  purchaseId: ObjectId
  at: Date
}

export type QuestDoc = { _id: string; userId: ObjectId; day: string; picks: string[]; claimed: string[]; swapped?: string; createdAt: Date }

export type StreakDoc = {
  _id?: ObjectId
  userId: ObjectId
  game: string
  streak: number
  best: number
  guest?: boolean
  left?: number
  right?: number
  ask?: { parts: { key: string; value: string }[]; join: string }
  answer?: string
  status: 'playing' | 'over'
  createdAt: Date
  updatedAt: Date
}

export type ShotDoc = {
  _id?: ObjectId
  userId: ObjectId
  guest?: boolean
  answerId?: number
  variant?: number[]
  key?: string
  level: number
  misses: number
  score: number
  streak: number
  best: number
  seen: number[]
  shown?: { id: number; variant: number[] }[]
  lastId?: number
  status: 'playing' | 'over'
  createdAt: Date
  updatedAt: Date
}

export type ShotDayDoc = {
  _id?: ObjectId
  userId: ObjectId
  day: string
  guest?: boolean
  answerId: number
  variant: number[]
  key: string
  level: number
  status: 'playing' | 'over'
  won?: boolean
  gained?: number
  createdAt: Date
  updatedAt: Date
}

export type TuneDayDoc = {
  _id?: ObjectId
  userId: ObjectId
  day: string
  guest?: boolean
  answerId: number
  key: string
  step: number
  status: 'playing' | 'over'
  won?: boolean
  gained?: number
  createdAt: Date
  updatedAt: Date
}

export type TuneDoc = {
  _id?: ObjectId
  userId: ObjectId
  guest?: boolean
  answerId?: number
  key?: string
  grade: string
  step: number
  misses: number
  score: number
  streak: number
  best: number
  seen: number[]
  lastId?: number
  won?: boolean
  status: 'playing' | 'over'
  createdAt: Date
  updatedAt: Date
}

export type SeasonDoc = {
  _id: string
  season: string
  userId: ObjectId
  xp: number
  solved: number
  days: string[]
  duelWins?: number
  awards?: Record<string, Date>
  claimed?: Record<string, Date>
}

export type SeasonCloseDoc = { _id: string; season: string; closedAt: Date; players: number }

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
  __streaksIndexed?: Promise<unknown>
  __shotsIndexed?: Promise<unknown>
  __shotDaysIndexed?: Promise<unknown>
  __tunesIndexed?: Promise<unknown>
  __tuneDaysIndexed?: Promise<unknown>
  __purchasesIndexed?: Promise<unknown>
  __ledgerIndexed?: Promise<unknown>
  __chatIndexed?: Promise<unknown>
  __pulseIndexed?: Promise<unknown>
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

export async function streaks(): Promise<Collection<StreakDoc>> {
  const collection = (await database()).collection<StreakDoc>('streaks')
  cache.__streaksIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, game: 1 }, { unique: true }),
    collection.createIndex({ game: 1, best: -1 }),
    collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7, partialFilterExpression: { guest: true } }),
  ]).catch((error) => {
    cache.__streaksIndexed = undefined
    throw error
  })
  await cache.__streaksIndexed
  return collection
}

export async function shotDays(): Promise<Collection<ShotDayDoc>> {
  const collection = (await database()).collection<ShotDayDoc>('shotDays')
  cache.__shotDaysIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, day: 1 }, { unique: true }),
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
  ]).catch((error) => {
    cache.__shotDaysIndexed = undefined
    throw error
  })
  await cache.__shotDaysIndexed
  return collection
}

export async function shotRuns(): Promise<Collection<ShotDoc>> {
  const collection = (await database()).collection<ShotDoc>('shotRuns')
  cache.__shotsIndexed ??= Promise.all([
    collection.createIndex({ userId: 1 }, { unique: true }),
    collection.createIndex({ best: -1 }),
    collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7, partialFilterExpression: { guest: true } }),
  ]).catch((error) => {
    cache.__shotsIndexed = undefined
    throw error
  })
  await cache.__shotsIndexed
  return collection
}

export async function tuneDays(): Promise<Collection<TuneDayDoc>> {
  const collection = (await database()).collection<TuneDayDoc>('tuneDays')
  cache.__tuneDaysIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, day: 1 }, { unique: true }),
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
  ]).catch((error) => {
    cache.__tuneDaysIndexed = undefined
    throw error
  })
  await cache.__tuneDaysIndexed
  return collection
}

export async function tuneRuns(): Promise<Collection<TuneDoc>> {
  const collection = (await database()).collection<TuneDoc>('tuneRuns')
  cache.__tunesIndexed ??= Promise.all([
    collection.createIndex({ userId: 1 }, { unique: true }),
    collection.createIndex({ best: -1 }),
    collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7, partialFilterExpression: { guest: true } }),
  ]).catch((error) => {
    cache.__tunesIndexed = undefined
    throw error
  })
  await cache.__tunesIndexed
  return collection
}

export type ChatDoc = {
  _id?: ObjectId
  userId: ObjectId
  nickname: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  title?: string | null
  nickTone?: string | null
  text: string
  at: Date
  hidden?: boolean
}

export async function chatRoom(): Promise<Collection<ChatDoc>> {
  const collection = (await database()).collection<ChatDoc>('chat')
  cache.__chatIndexed ??= Promise.all([
    collection.createIndex({ at: -1 }),
    collection.createIndex({ userId: 1, at: -1 }),
    collection.createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }),
  ]).catch((error) => {
    cache.__chatIndexed = undefined
    throw error
  })
  await cache.__chatIndexed
  return collection
}

export type PulseDoc = { _id: string; at: Date }

export async function pulse(): Promise<Collection<PulseDoc>> {
  const collection = (await database()).collection<PulseDoc>('pulse')
  cache.__pulseIndexed ??= collection
    .createIndex({ at: 1 }, { expireAfterSeconds: 120 })
    .catch((error) => {
      cache.__pulseIndexed = undefined
      throw error
    })
  await cache.__pulseIndexed
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
    collection.createIndex({ 'invites.toId': 1, status: 1 }),
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
  cache.__mongo ??= new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: Number(process.env.MONGODB_POOL ?? 10),
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
  })
    .connect()
    .catch((error) => {
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

export async function seasonCloses(): Promise<Collection<SeasonCloseDoc>> {
  return (await database()).collection<SeasonCloseDoc>('seasonCloses')
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

export async function purchases(): Promise<Collection<PurchaseDoc>> {
  const collection = (await database()).collection<PurchaseDoc>('purchases')
  cache.__purchasesIndexed ??= Promise.all([
    collection.createIndex({ orderId: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, createdAt: -1 }),
    collection.createIndex({ provider: 1, paymentId: 1 }),
  ]).catch((error) => {
    cache.__purchasesIndexed = undefined
    throw error
  })
  await cache.__purchasesIndexed
  return collection
}

export async function coinLedger(): Promise<Collection<LedgerDoc>> {
  const collection = (await database()).collection<LedgerDoc>('coinLedger')
  cache.__ledgerIndexed ??= Promise.all([
    collection.createIndex({ userId: 1, at: -1 }),
    collection.createIndex({ purchaseId: 1, reason: 1 }, { unique: true }),
  ]).catch((error) => {
    cache.__ledgerIndexed = undefined
    throw error
  })
  await cache.__ledgerIndexed
  return collection
}

export async function users(): Promise<Collection<UserDoc>> {
  const collection = (await database()).collection<UserDoc>('users')
  cache.__usersIndexed ??= Promise.all([
    collection.createIndex({ usernameLower: 1 }, { unique: true }),
    collection.createIndex({ nicknameLower: 1 }),
    collection.createIndex({ nicknameLower: 1, tag: 1 }, { unique: true, partialFilterExpression: { tag: { $type: 'string' } } }),
    collection.createIndex({ solvedTotal: -1 }),
  ]).catch((error) => {
    cache.__usersIndexed = undefined
    throw error
  })
  await cache.__usersIndexed
  return collection
}

