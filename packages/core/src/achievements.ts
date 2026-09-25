import type { ObjectId } from 'mongodb'
import { GAME_IDS, type GameId } from '@nanda/game'
import { rounds, users, duels } from './db'
import { gameData } from './games'

export type Tier = 'bronze' | 'silver' | 'gold' | 'legend'
export type Category = 'guessing' | 'duels' | 'streaks' | 'modes' | 'worlds' | 'ranking' | 'secret'

export type Achievement = {
  id: string
  category: Category
  tier: Tier
  target: number
  xp: number
  secret?: boolean
}

export const XP = { bronze: 50, silver: 120, gold: 300, legend: 800 } as const

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', category: 'guessing', tier: 'bronze', target: 1, xp: XP.bronze },
  { id: 'hundred', category: 'guessing', tier: 'bronze', target: 100, xp: XP.bronze },
  { id: 'thousand', category: 'guessing', tier: 'silver', target: 1000, xp: XP.silver },
  { id: 'encyclopedia', category: 'guessing', tier: 'gold', target: 5000, xp: XP.gold },
  { id: 'sniper', category: 'guessing', tier: 'gold', target: 15, xp: XP.gold },
  { id: 'firstTry', category: 'guessing', tier: 'silver', target: 50, xp: XP.silver },
  { id: 'sharpEye', category: 'guessing', tier: 'bronze', target: 1, xp: XP.bronze },
  { id: 'perfectWeek', category: 'guessing', tier: 'gold', target: 7, xp: XP.gold },
  { id: 'marathon', category: 'guessing', tier: 'silver', target: 100, xp: XP.silver },

  { id: 'firstBlood', category: 'duels', tier: 'bronze', target: 1, xp: XP.bronze },
  { id: 'blitz', category: 'duels', tier: 'gold', target: 1, xp: XP.gold },
  { id: 'duelist', category: 'duels', tier: 'silver', target: 50, xp: XP.silver },
  { id: 'gladiator', category: 'duels', tier: 'gold', target: 250, xp: XP.gold },

  { id: 'habit', category: 'streaks', tier: 'bronze', target: 3, xp: XP.bronze },
  { id: 'onFire', category: 'streaks', tier: 'silver', target: 10, xp: XP.silver },
  { id: 'ironWill', category: 'streaks', tier: 'gold', target: 30, xp: XP.gold },
  { id: 'yearTogether', category: 'streaks', tier: 'legend', target: 365, xp: XP.legend },
  { id: 'nightOwl', category: 'streaks', tier: 'bronze', target: 10, xp: XP.bronze },

  { id: 'detective', category: 'modes', tier: 'bronze', target: 100, xp: XP.bronze },
  { id: 'artist', category: 'modes', tier: 'bronze', target: 100, xp: XP.bronze },
  { id: 'technician', category: 'modes', tier: 'bronze', target: 100, xp: XP.bronze },
  { id: 'librarian', category: 'modes', tier: 'silver', target: 100, xp: XP.silver },
  { id: 'allRounder', category: 'modes', tier: 'gold', target: 4, xp: XP.gold },

  { id: 'traveller', category: 'worlds', tier: 'bronze', target: 10, xp: XP.bronze },
  { id: 'multiverse', category: 'worlds', tier: 'silver', target: GAME_IDS.length, xp: XP.silver },
  { id: 'fan', category: 'worlds', tier: 'bronze', target: 50, xp: XP.bronze },
  { id: 'loremaster', category: 'worlds', tier: 'gold', target: 100, xp: XP.gold },
  { id: 'gamer', category: 'worlds', tier: 'silver', target: 100, xp: XP.silver },

  { id: 'top1000', category: 'ranking', tier: 'silver', target: 1000, xp: XP.silver },
  { id: 'legendRank', category: 'ranking', tier: 'gold', target: 100, xp: XP.gold },

  { id: 'comeback', category: 'secret', tier: 'silver', target: 1, xp: XP.silver, secret: true },
  { id: 'gaveUpNever', category: 'secret', tier: 'gold', target: 200, xp: XP.gold, secret: true },
  { id: 'lucky', category: 'secret', tier: 'bronze', target: 1, xp: XP.bronze, secret: true },
  { id: 'polyglot', category: 'secret', tier: 'silver', target: 3, xp: XP.silver, secret: true },
]

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

export type Facts = {
  solved: number
  firstTry: number
  imageFirstTry: number
  sniper: number
  perfectDailyWeek: number
  bestPerDay: number
  streak: number
  bestStreak: number
  night: number
  modes: Record<string, { played: number; won: number }>
  worlds: number
  bestWorldShare: number
  bestWorldDone: number
  gamesSolved: number
  duelWins: number
  fastestDuelMs: number | null
  comeback: boolean
  noGiveUpRun: number
  rank: number | null
  players: number
  languages: number
}

const dayOf = (date: Date) => new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 10)

export async function collectFacts(userId: ObjectId, languages = 1, since?: Date): Promise<Facts> {
  const fresh = since ? { createdAt: { $gt: since } } : {}
  const [roundList, duelList, person] = await Promise.all([
    (await rounds())
      .find(
        { userId, ...fresh },
        { projection: { game: 1, mode: 1, status: 1, answerId: 1, guessCount: 1, guesses: 1, daily: 1, finishedAt: 1, createdAt: 1 }, sort: { createdAt: 1 } },
      )
      .toArray(),
    (await duels())
      .find({ 'players.userId': userId, status: 'finished', ...fresh })
      .toArray(),
    (await users()).findOne({ _id: userId }, { projection: { visit: 1 } }),
  ])

  const modes: Facts['modes'] = {}
  const perDay = new Map<string, number>()
  const uniquePerGame = new Map<string, Set<number>>()
  const played = new Set<string>()
  let solved = 0
  let firstTry = 0
  let imageFirstTry = 0
  let night = 0
  let gamesSolved = 0
  let sniper = 0
  let sniperRun = 0
  let noGiveUpRun = 0
  let noGiveUpBest = 0
  const dailyWins: string[] = []

  for (const round of roundList) {
    const mode = (modes[round.mode] ??= { played: 0, won: 0 })
    if (round.status !== 'active') {
      mode.played += 1
      played.add(round.game)
    }
    const won = round.status === 'won'
    const tries = round.guessCount ?? round.guesses?.length ?? 0

    if (round.status === 'skipped' || round.status === 'lost') {
      noGiveUpRun = 0
      sniperRun = 0
    }
    if (!won) continue

    solved += 1
    mode.won += 1
    noGiveUpRun += 1
    noGiveUpBest = Math.max(noGiveUpBest, noGiveUpRun)

    const set = uniquePerGame.get(round.game) ?? new Set<number>()
    set.add(round.answerId)
    uniquePerGame.set(round.game, set)

    if (tries === 1) {
      firstTry += 1
      sniperRun += 1
      sniper = Math.max(sniper, sniperRun)
      if (round.mode === 'image') imageFirstTry += 1
      if (round.daily) dailyWins.push(round.daily)
    } else {
      sniperRun = 0
    }

    const when = round.finishedAt ?? round.createdAt
    if (when) {
      const key = dayOf(when)
      perDay.set(key, (perDay.get(key) ?? 0) + 1)
      const hour = new Date(when.getTime() + 3 * 3600_000).getUTCHours()
      if (hour < 5) night += 1
    }
  }

  let bestWorldShare = 0
  let bestWorldDone = 0
  for (const [game, set] of uniquePerGame) {
    if (!GAME_IDS.includes(game as GameId)) continue
    const { pool } = await gameData(game as GameId)
    if (!pool.length) continue
    bestWorldShare = Math.max(bestWorldShare, Math.round((set.size / pool.length) * 100))
    bestWorldDone = Math.max(bestWorldDone, set.size)
  }
  for (const [game, set] of uniquePerGame) if (game === 'dota' || game === 'mk') gamesSolved += set.size

  const perfectDays = [...new Set(dailyWins)].sort()
  let perfectRun = 0
  let previous: string | null = null
  for (const day of perfectDays) {
    const next = previous ? new Date(`${previous}T00:00:00Z`).getTime() + 86_400_000 : 0
    perfectRun = previous && new Date(`${day}T00:00:00Z`).getTime() === next ? perfectRun + 1 : 1
    previous = day
  }

  let duelWins = 0
  let fastestDuelMs: number | null = null
  let comeback = false
  for (const duel of duelList) {
    const me = duel.players.find((p) => String(p.userId) === String(userId))
    const rival = duel.players.find((p) => String(p.userId) !== String(userId))
    if (!me) continue
    duelWins += me.wins ?? 0
    if (me.solvedAt && duel.startedAt) {
      const ms = me.solvedAt.getTime() - duel.startedAt.getTime()
      if (ms > 0 && (fastestDuelMs === null || ms < fastestDuelMs)) fastestDuelMs = ms
    }
    if ((me.wins ?? 0) > (rival?.wins ?? 0) && (rival?.wins ?? 0) >= 2) comeback = true
  }

  return {
    solved,
    firstTry,
    imageFirstTry,
    sniper,
    perfectDailyWeek: perfectRun,
    bestPerDay: Math.max(0, ...perDay.values()),
    streak: person?.visit?.streak ?? 0,
    bestStreak: person?.visit?.best ?? 0,
    night,
    modes,
    worlds: played.size,
    bestWorldShare,
    bestWorldDone,
    gamesSolved,
    duelWins,
    fastestDuelMs,
    comeback,
    noGiveUpRun: noGiveUpBest,
    rank: null,
    players: 0,
    languages,
  }
}

const accurateModes = (facts: Facts) =>
  Object.values(facts.modes).filter((m) => m.played >= 20 && m.won / m.played >= 0.9).length

export function progressOf(id: string, facts: Facts): number {
  const mode = (name: string) => facts.modes[name]?.played ?? 0
  switch (id) {
    case 'first':
    case 'hundred':
    case 'thousand':
    case 'encyclopedia':
      return facts.solved
    case 'sniper':
      return facts.sniper
    case 'firstTry':
      return facts.firstTry
    case 'sharpEye':
      return facts.imageFirstTry
    case 'perfectWeek':
      return facts.perfectDailyWeek
    case 'marathon':
      return facts.bestPerDay
    case 'firstBlood':
    case 'duelist':
    case 'gladiator':
      return facts.duelWins
    case 'blitz':
      return facts.fastestDuelMs !== null && facts.fastestDuelMs <= 10_000 ? 1 : 0
    case 'habit':
    case 'onFire':
    case 'ironWill':
    case 'yearTogether':
      return Math.max(facts.streak, facts.bestStreak)
    case 'nightOwl':
      return facts.night
    case 'detective':
      return mode('classic')
    case 'artist':
      return mode('image')
    case 'technician':
      return mode('ability')
    case 'librarian':
      return mode('page')
    case 'allRounder':
      return accurateModes(facts)
    case 'traveller':
    case 'multiverse':
      return facts.worlds
    case 'fan':
      return facts.bestWorldShare
    case 'loremaster':
      return facts.bestWorldShare
    case 'gamer':
      return facts.gamesSolved
    case 'top1000':
    case 'legendRank':
      return facts.rank === null ? 0 : facts.rank
    case 'comeback':
      return facts.comeback ? 1 : 0
    case 'gaveUpNever':
      return facts.noGiveUpRun
    case 'lucky':
      return facts.firstTry > 0 ? 1 : 0
    case 'polyglot':
      return facts.languages
    default:
      return 0
  }
}

const RANKED = new Set(['top1000', 'legendRank'])

export function earned(id: string, facts: Facts): boolean {
  const achievement = byId.get(id)
  if (!achievement) return false
  const value = progressOf(id, facts)
  if (RANKED.has(id)) return facts.rank !== null && facts.rank > 0 && facts.rank <= achievement.target
  return value >= achievement.target
}

export async function syncAwards(userId: ObjectId, facts: Facts, current: Record<string, Date> = {}, taken?: Record<string, Date>) {
  const fresh: Record<string, Date> = {}
  const now = new Date()

  for (const achievement of ACHIEVEMENTS) {
    if (current[achievement.id]) continue
    if (!earned(achievement.id, facts)) continue
    fresh[achievement.id] = now
  }

  const settled = taken ?? { ...current }
  const patch: Record<string, unknown> = Object.fromEntries(Object.entries(fresh).map(([id, at]) => [`awards.${id}`, at]))
  if (!taken) patch.claimed = settled

  if (!Object.keys(patch).length) return { awards: current, claimed: settled, gained: [] as string[] }

  await (await users()).updateOne({ _id: userId }, { $set: patch })
  return { awards: { ...current, ...fresh }, claimed: settled, gained: Object.keys(fresh) }
}

export async function claimAward(userId: ObjectId, id: string) {
  const achievement = byId.get(id)
  if (!achievement) return null

  const marked = await (await users()).updateOne(
    { _id: userId, [`awards.${id}`]: { $exists: true }, [`claimed.${id}`]: { $exists: false } },
    { $set: { [`claimed.${id}`]: new Date() }, $inc: { xp: achievement.xp } },
  )
  return marked.modifiedCount ? achievement.xp : null
}

export async function rarity() {
  const collection = await users()
  const total = await collection.countDocuments({})
  if (!total) return { total: 0, share: {} as Record<string, number> }

  const [row] = await collection
    .aggregate<{ counts: { id: string; n: number }[] }>([
      { $project: { ids: { $map: { input: { $objectToArray: { $ifNull: ['$awards', {}] } }, as: 'a', in: '$$a.k' } } } },
      { $unwind: '$ids' },
      { $group: { _id: '$ids', n: { $sum: 1 } } },
      { $group: { _id: null, counts: { $push: { id: '$_id', n: '$n' } } } },
    ])
    .toArray()

  const share: Record<string, number> = {}
  for (const { id, n } of row?.counts ?? []) share[id] = Math.round((n / total) * 1000) / 10
  return { total, share }
}
