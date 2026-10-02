import type { ObjectId } from 'mongodb'
import { GAME_IDS, MODE_IDS, type GameId } from '@nanda/game'
import { rounds, seasons, users } from './db'
import { gameData } from './games'
import { addSeasonXp, previousSeason, seasonAt, seasonStanding, takeSeasonClose } from './season'

export type Tier = 'bronze' | 'silver' | 'gold' | 'legend' | 'secret'
export type Kind = 'life' | 'season'
export type Category = 'guessing' | 'duels' | 'streaks' | 'modes' | 'worlds' | 'season' | 'ranking' | 'secret'

export type Achievement = {
  id: string
  category: Category
  tier: Tier
  kind: Kind
  target: number
  xp: number
  secret?: boolean
  awarded?: boolean
  value?: (facts: Facts) => number
}

export const XP = { bronze: 50, silver: 120, gold: 300, legend: 800, secret: 250 } as const

const life = (id: string, category: Category, tier: Tier, target: number, value: (facts: Facts) => number): Achievement => ({
  id,
  category,
  tier,
  kind: 'life',
  target,
  xp: XP[tier],
  value,
})

const run = (id: string, category: Category, tier: Tier, target: number, value: (facts: Facts) => number): Achievement => ({
  ...life(id, category, tier, target, value),
  kind: 'season',
})

const hidden = (id: string, target: number, value: (facts: Facts) => number): Achievement => ({
  ...life(id, 'secret', 'secret', target, value),
  secret: true,
})

const trophy = (id: string, tier: Tier, target: number): Achievement => ({
  id,
  category: 'ranking',
  tier,
  kind: 'life',
  target,
  xp: XP[tier],
  awarded: true,
})

const modePlayed = (name: string) => (facts: Facts) => facts.modes[name]?.played ?? 0

export const LIFE: Achievement[] = [
  life('first', 'guessing', 'bronze', 1, (f) => f.solved),
  life('ten', 'guessing', 'bronze', 10, (f) => f.solved),
  life('fifty', 'guessing', 'bronze', 50, (f) => f.solved),
  life('hundred', 'guessing', 'bronze', 100, (f) => f.solved),
  life('fiveHundred', 'guessing', 'silver', 500, (f) => f.solved),
  life('thousand', 'guessing', 'silver', 1000, (f) => f.solved),
  life('encyclopedia', 'guessing', 'gold', 5000, (f) => f.solved),
  life('immortal', 'guessing', 'legend', 10000, (f) => f.solved),
  life('luckyTen', 'guessing', 'bronze', 10, (f) => f.firstTry),
  life('firstTry', 'guessing', 'silver', 50, (f) => f.firstTry),
  life('firstTry200', 'guessing', 'gold', 200, (f) => f.firstTry),
  life('sniper5', 'guessing', 'bronze', 5, (f) => f.sniper),
  life('sniper', 'guessing', 'gold', 15, (f) => f.sniper),
  life('sharpEye', 'guessing', 'bronze', 1, (f) => f.imageFirstTry),
  life('marathon25', 'guessing', 'bronze', 25, (f) => f.bestPerDay),
  life('marathon', 'guessing', 'silver', 100, (f) => f.bestPerDay),
  life('daily10', 'guessing', 'bronze', 25, (f) => f.dailySolved),
  life('daily50', 'guessing', 'silver', 150, (f) => f.dailySolved),
  life('daily200', 'guessing', 'gold', 500, (f) => f.dailySolved),
  life('perfectWeek', 'guessing', 'gold', 7, (f) => f.perfectDailyWeek),

  life('modeTour', 'modes', 'bronze', MODE_IDS.length, (f) => Object.values(f.modes).filter((m) => m.played > 0).length),
  life('detective', 'modes', 'bronze', 50, modePlayed('classic')),
  life('detective250', 'modes', 'silver', 250, modePlayed('classic')),
  life('artist', 'modes', 'bronze', 50, modePlayed('image')),
  life('artist250', 'modes', 'silver', 250, modePlayed('image')),
  life('technician', 'modes', 'bronze', 25, modePlayed('ability')),
  life('technician150', 'modes', 'silver', 150, modePlayed('ability')),
  life('librarian', 'modes', 'bronze', 25, modePlayed('page')),
  life('librarian150', 'modes', 'silver', 150, modePlayed('page')),
  life('listener', 'modes', 'bronze', 25, modePlayed('phrase')),
  life('listener150', 'modes', 'silver', 150, modePlayed('phrase')),
  life('allRounder', 'modes', 'gold', 4, (f) => Object.values(f.modes).filter((m) => m.played >= 20 && m.won / m.played >= 0.9).length),

  life('traveller5', 'worlds', 'bronze', 5, (f) => f.worlds),
  life('traveller', 'worlds', 'bronze', 10, (f) => f.worlds),
  life('multiverse', 'worlds', 'silver', GAME_IDS.length, (f) => f.worlds),
  life('local50', 'worlds', 'bronze', 50, (f) => f.bestWorldDone),
  life('local200', 'worlds', 'silver', 200, (f) => f.bestWorldDone),
  life('fan', 'worlds', 'bronze', 25, (f) => f.bestWorldShare),
  life('fan50', 'worlds', 'silver', 50, (f) => f.bestWorldShare),
  life('loremaster', 'worlds', 'gold', 100, (f) => f.bestWorldShare),
  life('gamer', 'worlds', 'silver', 100, (f) => f.gamesSolved),

  life('firstBlood', 'duels', 'bronze', 1, (f) => f.duelWins),
  life('duel5', 'duels', 'bronze', 5, (f) => f.duelWins),
  life('duelist', 'duels', 'silver', 15, (f) => f.duelWins),
  life('gladiator', 'duels', 'gold', 50, (f) => f.duelWins),
  life('warlord', 'duels', 'legend', 150, (f) => f.duelWins),
  life('duelFan', 'duels', 'bronze', 10, (f) => f.duelPlayed),
  life('duelFan100', 'duels', 'silver', 100, (f) => f.duelPlayed),
  life('blitz', 'duels', 'gold', 1, (f) => (f.fastestDuelMs !== null && f.fastestDuelMs <= 10_000 ? 1 : 0)),
  life('boardWin', 'duels', 'bronze', 1, (f) => f.whoWins),
  life('boardWin10', 'duels', 'silver', 10, (f) => f.whoWins),

  life('habit', 'streaks', 'bronze', 3, (f) => Math.max(f.streak, f.bestStreak)),
  life('week', 'streaks', 'bronze', 7, (f) => Math.max(f.streak, f.bestStreak)),
  life('onFire', 'streaks', 'silver', 10, (f) => Math.max(f.streak, f.bestStreak)),
  life('ironWill', 'streaks', 'gold', 30, (f) => Math.max(f.streak, f.bestStreak)),
  life('hundredDays', 'streaks', 'legend', 100, (f) => Math.max(f.streak, f.bestStreak)),
  life('yearTogether', 'streaks', 'legend', 365, (f) => Math.max(f.streak, f.bestStreak)),
  life('nightOwl', 'streaks', 'bronze', 10, (f) => f.night),
  life('earlyBird', 'streaks', 'bronze', 10, (f) => f.morning),

  trophy('seasonTop100', 'silver', 100),
  trophy('seasonTop10', 'gold', 10),
  trophy('seasonChampion', 'legend', 1),

  hidden('lucky', 1, (f) => (f.firstTry > 0 ? 1 : 0)),
  hidden('comeback', 1, (f) => (f.comeback ? 1 : 0)),
  hidden('polyglot', 3, (f) => f.languages),
  hidden('gaveUpNever', 200, (f) => f.noGiveUpRun),
  hidden('sniperDay', 10, (f) => f.bestFirstTryDay),
  hidden('owlMarathon', 50, (f) => f.night),
]

export const SEASON: Achievement[] = [
  run('seasonStart', 'season', 'bronze', 1, (f) => f.solved),
  run('seasonSolve25', 'season', 'bronze', 25, (f) => f.solved),
  run('seasonSolve100', 'season', 'silver', 100, (f) => f.solved),
  run('seasonSolve300', 'season', 'gold', 300, (f) => f.solved),
  run('seasonDays7', 'season', 'bronze', 4, (f) => f.days),
  run('seasonDays20', 'season', 'silver', 7, (f) => f.days),
  run('seasonDaily10', 'season', 'bronze', 30, (f) => f.dailySolved),
  run('seasonDaily25', 'season', 'silver', 100, (f) => f.dailySolved),
  run('seasonFirstTry25', 'season', 'bronze', 25, (f) => f.firstTry),
  run('seasonFirstTry100', 'season', 'silver', 100, (f) => f.firstTry),
  run('seasonDuel5', 'season', 'bronze', 5, (f) => f.duelWins),
  run('seasonDuel20', 'season', 'silver', 20, (f) => f.duelWins),
  run('seasonWorlds5', 'season', 'bronze', 5, (f) => f.worlds),
  run('seasonModes4', 'season', 'bronze', 4, (f) => Object.values(f.modes).filter((m) => m.played > 0).length),
  run('seasonMarathon30', 'season', 'bronze', 30, (f) => f.bestPerDay),
]

export const ACHIEVEMENTS: Achievement[] = [...LIFE, ...SEASON]

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

export type Facts = {
  solved: number
  firstTry: number
  imageFirstTry: number
  sniper: number
  dailySolved: number
  perfectDailyWeek: number
  bestPerDay: number
  bestFirstTryDay: number
  streak: number
  bestStreak: number
  night: number
  morning: number
  modes: Record<string, { played: number; won: number }>
  worlds: number
  bestWorldShare: number
  bestWorldDone: number
  gamesSolved: number
  duelWins: number
  duelPlayed: number
  whoWins: number
  fastestDuelMs: number | null
  comeback: boolean
  noGiveUpRun: number
  days: number
  rank: number | null
  players: number
  languages: number
}

const dayOf = (date: Date) => new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 10)

export async function collectFacts(userId: ObjectId, languages = 1, since?: Date): Promise<Facts> {
  const fresh = since ? { createdAt: { $gt: since } } : {}
  const [roundList, person] = await Promise.all([
    (await rounds())
      .find(
        { userId, challenge: { $exists: false }, ...fresh },
        { projection: { game: 1, mode: 1, status: 1, answerId: 1, guessCount: 1, guesses: 1, daily: 1, finishedAt: 1, createdAt: 1 }, sort: { createdAt: 1 } },
      )
      .toArray(),
    (await users()).findOne({ _id: userId }, { projection: { visit: 1, duelStats: 1, duelBestMs: 1, duelComeback: 1, langs: 1 } }),
  ])

  const modes: Facts['modes'] = {}
  const perDay = new Map<string, number>()
  const firstTryDay = new Map<string, number>()
  const uniquePerGame = new Map<string, Set<number>>()
  const played = new Set<string>()
  let solved = 0
  let firstTry = 0
  let imageFirstTry = 0
  let night = 0
  let morning = 0
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

    if (round.daily) dailyWins.push(round.daily)

    const when = round.finishedAt ?? round.createdAt
    const key = when ? dayOf(when) : null

    if (tries === 1) {
      firstTry += 1
      sniperRun += 1
      sniper = Math.max(sniper, sniperRun)
      if (round.mode === 'image') imageFirstTry += 1
      if (key) firstTryDay.set(key, (firstTryDay.get(key) ?? 0) + 1)
    } else {
      sniperRun = 0
    }

    if (when && key) {
      perDay.set(key, (perDay.get(key) ?? 0) + 1)
      const hour = new Date(when.getTime() + 3 * 3600_000).getUTCHours()
      if (hour < 5) night += 1
      if (hour >= 5 && hour < 9) morning += 1
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

  const duelWins = person?.duelStats?.wins ?? 0
  const fastestDuelMs = person?.duelBestMs ?? null
  const comeback = Boolean(person?.duelComeback)

  return {
    solved,
    firstTry,
    imageFirstTry,
    sniper,
    dailySolved: dailyWins.length,
    perfectDailyWeek: perfectRun,
    bestPerDay: Math.max(0, ...perDay.values()),
    bestFirstTryDay: Math.max(0, ...firstTryDay.values()),
    streak: person?.visit?.streak ?? 0,
    bestStreak: person?.visit?.best ?? 0,
    night,
    morning,
    modes,
    worlds: played.size,
    bestWorldShare,
    bestWorldDone,
    gamesSolved,
    duelWins,
    duelPlayed: person?.duelStats?.played ?? 0,
    whoWins: person?.duelStats?.modes?.who?.wins ?? 0,
    fastestDuelMs,
    comeback,
    noGiveUpRun: noGiveUpBest,
    days: 0,
    rank: null,
    players: 0,
    languages: Math.max(languages, person?.langs?.length ?? 0),
  }
}

export async function seasonFacts(userId: ObjectId, languages = 1, now = new Date()): Promise<Facts> {
  const season = seasonAt(now)
  const facts = await collectFacts(userId, languages, season.from)
  const doc = await (await seasons()).findOne({ _id: `${season.id}:${userId.toHexString()}` })
  facts.days = doc?.days?.length ?? 0
  facts.duelWins = doc?.duelWins ?? 0
  facts.duelPlayed = 0
  facts.whoWins = 0
  return facts
}

export function progressOf(id: string, facts: Facts): number {
  return byId.get(id)?.value?.(facts) ?? 0
}

export function earned(id: string, facts: Facts): boolean {
  const achievement = byId.get(id)
  if (!achievement || achievement.awarded) return false
  return progressOf(id, facts) >= achievement.target
}

export async function syncAwards(userId: ObjectId, facts: Facts, current: Record<string, Date> = {}, taken?: Record<string, Date>) {
  const fresh: Record<string, Date> = {}
  const now = new Date()

  for (const achievement of LIFE) {
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

export async function syncSeasonAwards(userId: ObjectId, facts: Facts, kept: { awards?: Record<string, Date> } = {}, now = new Date()) {
  const season = seasonAt(now)
  const id = `${season.id}:${userId.toHexString()}`
  const collection = await seasons()
  const doc = await collection.findOne({ _id: id })
  const current = doc?.awards ?? {}
  const fresh: Record<string, Date> = {}
  const at = new Date()

  for (const achievement of SEASON) {
    if (current[achievement.id]) continue
    if (progressOf(achievement.id, facts) >= achievement.target) fresh[achievement.id] = at
  }

  if (Object.keys(fresh).length) {
    await collection.updateOne(
      { _id: id },
      {
        $set: Object.fromEntries(Object.entries(fresh).map(([key, when]) => [`awards.${key}`, when])),
        $setOnInsert: { season: season.id, userId, xp: 0, solved: 0, days: [] },
      },
      { upsert: true },
    )
  }

  const claimed = doc?.claimed ?? {}
  const mirror = Object.entries(claimed).filter(([key]) => !kept.awards?.[key])
  if (mirror.length) {
    await (await users()).updateOne(
      { _id: userId },
      { $set: Object.fromEntries(mirror.flatMap(([key, when]) => [[`awards.${key}`, when], [`claimed.${key}`, when]])) },
    )
  }

  return { awards: { ...current, ...fresh }, claimed, gained: Object.keys(fresh) }
}

export async function claimAward(userId: ObjectId, id: string, now = new Date()) {
  const achievement = byId.get(id)
  if (!achievement) return null

  if (achievement.kind === 'season') {
    const season = seasonAt(now)
    const key = `${season.id}:${userId.toHexString()}`
    const marked = await (await seasons()).updateOne(
      { _id: key, [`awards.${id}`]: { $exists: true }, [`claimed.${id}`]: { $exists: false } },
      { $set: { [`claimed.${id}`]: new Date() } },
    )
    if (!marked.modifiedCount) return null
    const at = new Date()
    await (await users()).updateOne(
      { _id: userId },
      { $inc: { xp: achievement.xp }, $set: { [`awards.${id}`]: at, [`claimed.${id}`]: at } },
    )
    await addSeasonXp(userId, achievement.xp, now)
    return achievement.xp
  }

  const marked = await (await users()).updateOne(
    { _id: userId, [`awards.${id}`]: { $exists: true }, [`claimed.${id}`]: { $exists: false } },
    { $set: { [`claimed.${id}`]: new Date() }, $inc: { xp: achievement.xp } },
  )
  if (!marked.modifiedCount) return null
  return achievement.xp
}

export async function closeFinishedSeason(now = new Date()) {
  const past = previousSeason(now)
  if (past.to.getTime() > now.getTime()) return null
  const taken = await takeSeasonClose(past)
  if (!taken) return null
  const standing = await seasonStanding(past.id, 100)
  await grantSeasonTrophies(standing)
  return { season: past.id, players: standing.length }
}

const TROPHIES: { id: string; places: number }[] = [
  { id: 'seasonChampion', places: 1 },
  { id: 'seasonTop10', places: 10 },
  { id: 'seasonTop100', places: 100 },
]

export async function grantSeasonTrophies(standing: { userId: ObjectId }[]) {
  const collection = await users()
  const now = new Date()
  for (const [index, row] of standing.entries()) {
    const place = index + 1
    const won = TROPHIES.filter((trophy) => place <= trophy.places)
    if (!won.length) continue
    await collection.updateOne(
      { _id: row.userId },
      { $set: Object.fromEntries(won.map((trophy) => [`awards.${trophy.id}`, now])) },
    )
  }
  return standing.length
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
