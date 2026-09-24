import type { ObjectId } from 'mongodb'
import { duels, quests, rounds, users } from './db'
import { today } from './daily'

export const LEVEL_XP = 500

export const RANKS = [
  { from: 1, id: 'rookie' },
  { from: 5, id: 'apprentice' },
  { from: 10, id: 'adept' },
  { from: 15, id: 'explorer' },
  { from: 20, id: 'expert' },
  { from: 25, id: 'master' },
  { from: 30, id: 'veteran' },
  { from: 35, id: 'legend' },
  { from: 40, id: 'myth' },
] as const

export const FREE_XP = 25
export const BONUS_XP = 120

type Metric = 'play' | 'games' | 'mode' | 'solve' | 'daily' | 'perfect' | 'duel'

type Quest = { id: string; tier: 'easy' | 'normal' | 'hard'; xp: number; metric: Metric; goal: number; mode?: string }

export const POOL: Quest[] = [
  { id: 'play3', tier: 'easy', xp: 40, metric: 'play', goal: 3 },
  { id: 'play5', tier: 'easy', xp: 50, metric: 'play', goal: 5 },
  { id: 'games2', tier: 'easy', xp: 45, metric: 'games', goal: 2 },
  { id: 'classic3', tier: 'easy', xp: 40, metric: 'mode', goal: 3, mode: 'classic' },
  { id: 'image3', tier: 'easy', xp: 45, metric: 'mode', goal: 3, mode: 'image' },
  { id: 'ability2', tier: 'easy', xp: 45, metric: 'mode', goal: 2, mode: 'ability' },
  { id: 'page2', tier: 'easy', xp: 45, metric: 'mode', goal: 2, mode: 'page' },

  { id: 'solve5', tier: 'normal', xp: 70, metric: 'solve', goal: 5 },
  { id: 'daily1', tier: 'normal', xp: 80, metric: 'daily', goal: 1 },
  { id: 'perfect1', tier: 'normal', xp: 75, metric: 'perfect', goal: 1 },
  { id: 'duel1', tier: 'normal', xp: 70, metric: 'duel', goal: 1 },
  { id: 'games4', tier: 'normal', xp: 65, metric: 'games', goal: 4 },

  { id: 'solve12', tier: 'hard', xp: 120, metric: 'solve', goal: 12 },
  { id: 'perfect3', tier: 'hard', xp: 130, metric: 'perfect', goal: 3 },
  { id: 'duel3', tier: 'hard', xp: 125, metric: 'duel', goal: 3 },
  { id: 'daily3', tier: 'hard', xp: 120, metric: 'daily', goal: 3 },
  { id: 'play15', tier: 'hard', xp: 110, metric: 'play', goal: 15 },
]

const byId = new Map(POOL.map((quest) => [quest.id, quest]))

export const levelOf = (xp: number) => Math.floor(xp / LEVEL_XP) + 1

export const rankOf = (level: number) => [...RANKS].reverse().find((rank) => level >= rank.from) ?? RANKS[0]

export const nextRank = (level: number) => RANKS.find((rank) => rank.from > level) ?? null

function seeded(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function pickQuests(userId: ObjectId, day: string) {
  const random = seeded(`${userId.toHexString()}:${day}`)
  return (['easy', 'normal', 'hard'] as const).map((tier) => {
    const tierQuests = POOL.filter((quest) => quest.tier === tier)
    return tierQuests[Math.floor(random() * tierQuests.length)].id
  })
}

async function progress(userId: ObjectId, day: string) {
  const sameDay = {
    $expr: { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Kyiv' } }, day] },
  }

  const [counts] = await (await rounds())
    .aggregate([
      { $match: { userId, guest: { $ne: true }, status: { $ne: 'active' }, ...sameDay } },
      {
        $group: {
          _id: null,
          play: { $sum: 1 },
          solve: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          daily: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'won'] }, { $ne: [{ $type: '$daily' }, 'missing'] }] }, 1, 0] } },
          perfect: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'won'] }, { $lte: [{ $ifNull: ['$guessCount', 99] }, 1] }] }, 1, 0] },
          },
          games: { $addToSet: '$game' },
          modes: { $push: '$mode' },
        },
      },
    ])
    .toArray()

  const wonDuels = await (await duels()).countDocuments({
    winnerId: userId,
    $expr: { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$finishedAt', timezone: 'Europe/Kyiv' } }, day] },
  })

  const modes = ((counts?.modes as string[]) ?? []).reduce<Record<string, number>>((all, mode) => {
    all[mode] = (all[mode] ?? 0) + 1
    return all
  }, {})

  return {
    play: (counts?.play as number) ?? 0,
    solve: (counts?.solve as number) ?? 0,
    daily: (counts?.daily as number) ?? 0,
    perfect: (counts?.perfect as number) ?? 0,
    games: ((counts?.games as string[]) ?? []).length,
    duel: wonDuels,
    modes,
  }
}

const done = (quest: Quest, counts: Awaited<ReturnType<typeof progress>>) => {
  const value = quest.metric === 'mode' ? (counts.modes[quest.mode ?? ''] ?? 0) : counts[quest.metric]
  return { value, done: value >= quest.goal }
}

export async function questBoard(userId: ObjectId) {
  const day = today()
  const collection = await quests()

  const picks = pickQuests(userId, day)
  const stored = await collection.findOneAndUpdate(
    { _id: `${day}:${userId.toHexString()}` },
    { $setOnInsert: { userId, day, picks, claimed: [], createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  )

  const claimed = new Set(stored?.claimed ?? [])
  const counts = await progress(userId, day)

  const list = (stored?.picks ?? picks).map((id) => {
    const quest = byId.get(id)
    if (!quest) return null
    const state = done(quest, counts)
    return { id, goal: quest.goal, xp: quest.xp, value: Math.min(state.value, quest.goal), done: state.done, claimed: claimed.has(id) }
  })

  const items = list.filter((quest): quest is NonNullable<typeof quest> => quest !== null)
  const free = { xp: FREE_XP, claimed: claimed.has('free') }
  const ready = items.every((quest) => quest.claimed) && free.claimed
  const bonus = { xp: BONUS_XP, claimed: claimed.has('bonus'), ready }
  const collected = items.filter((quest) => quest.claimed).length + (free.claimed ? 1 : 0)

  return { day, quests: items, free, bonus, collected, total: items.length + 1 }
}

export async function claimQuest(userId: ObjectId, id: string) {
  const day = today()
  const board = await questBoard(userId)

  const award =
    id === 'free'
      ? board.free.claimed
        ? null
        : FREE_XP
      : id === 'bonus'
        ? board.bonus.claimed || !board.bonus.ready
          ? null
          : BONUS_XP
        : (() => {
            const quest = board.quests.find((item) => item.id === id)
            return !quest || quest.claimed || !quest.done ? null : quest.xp
          })()

  if (award === null) return null

  const marked = await (await quests()).updateOne(
    { _id: `${day}:${userId.toHexString()}`, claimed: { $ne: id } },
    { $addToSet: { claimed: id } },
  )
  if (!marked.modifiedCount) return null

  await (await users()).updateOne({ _id: userId }, { $inc: { xp: award } })
  return award
}
