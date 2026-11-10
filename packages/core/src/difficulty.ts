import {
  DAILY_XP_FACTOR,
  DAILY_XP_MODES,
  DUEL_PACE_MODES,
  LOGGED_MODES,
  MODE_XP,
  MODE_XP_AFTER,
  PACE,
  PACE_AUTO,
  PACE_MODES,
  PACE_TARGET,
  SHOT_POINTS,
  autoTarget,
  manualXp,
  TRIES_MIN_PLAYERS,
  TRIES_PRIOR,
  TRIES_REF,
  paceFromTime,
  paceWithin,
  poolXp,
  poolXpPastCap,
  roundXp,
  triesFactor,
  triesXp,
  triesXpPastCap,
  type ModeId,
  type Pace,
} from '@nanda/game'
import { duelRounds, rounds } from './db'

const FRESH_MS = 3 * 60 * 60_000
const WINDOW_MS = 90 * 24 * 60 * 60_000

type Mean = { players: number; avg: number }
type World = Mean & { chars: Map<number, Mean> }
type TriesRow = { _id: { game: string; mode: string; id: number; user: unknown }; n: number; sum: number; failed: number; failedSum: number }
type PaceRow = { _id: { game: string; mode: string; bot?: boolean }; active: number; won: number }
type PlayerPaceRow = { _id: { game: string; mode: string; bot?: boolean; user: unknown }; active: number; won: number; n: number }

let worlds: Map<string, World> | null = null
let modePaces = new Map<string, Pace>()
let worldPaces = new Map<string, Pace>()
let builtAt = 0
let running: Promise<void> | null = null

const worldKey = (game: string, mode: string) => `${game}/${mode}`
const paceKey = (mode: string, bot = false) => (bot ? `${mode}:bot` : mode)
const baseMode = (key: string) => key.split(':')[0] as ModeId
const tryModes = Object.keys(TRIES_REF) as ModeId[]
const attempts = { $ifNull: ['$guessCount', { $size: { $ifNull: ['$guesses', []] } }] }
const recent = () => ({ createdAt: { $gte: new Date(Date.now() - WINDOW_MS) } })

async function measureTries() {
  return (await rounds())
    .aggregate<TriesRow>(
      [
        { $match: { guest: { $ne: true }, status: { $in: ['won', 'lost', 'skipped'] }, daily: { $exists: false }, mode: { $in: tryModes }, ...recent() } },
        { $project: { game: 1, mode: 1, answerId: 1, userId: 1, tries: attempts, won: { $eq: ['$status', 'won'] } } },
        { $match: { $or: [{ won: false }, { tries: { $gt: 0 } }] } },
        {
          $group: {
            _id: { game: '$game', mode: '$mode', id: '$answerId', user: '$userId' },
            n: { $sum: { $cond: ['$won', 1, 0] } },
            sum: { $sum: { $cond: ['$won', '$tries', 0] } },
            failed: { $sum: { $cond: ['$won', 0, 1] } },
            failedSum: { $sum: { $cond: ['$won', 0, '$tries'] } },
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray()
}

async function measurePace() {
  const started = { $ifNull: ['$startedAt', '$finishedAt'] }
  const extra = { $multiply: [PACE.guessCapMs, { $max: [0, { $subtract: [attempts, 1] }] }] }
  const asked = { $min: [{ $add: [PACE.thinkCapMs, extra] }, { $max: [0, { $subtract: ['$finishedAt', '$askedAt'] }] }] }
  const played = {
    $add: [
      { $min: [PACE.thinkCapMs, { $max: [0, { $subtract: [started, '$createdAt'] }] }] },
      { $min: [extra, { $max: [0, { $subtract: ['$finishedAt', started] }] }] },
    ],
  }
  return (await rounds())
    .aggregate<PlayerPaceRow>(
      [
        {
          $match: {
            guest: { $ne: true },
            status: { $in: ['won', 'lost', 'skipped'] },
            daily: { $exists: false },
            finishedAt: { $exists: true },
            ...recent(),
            $or: [{ mode: { $in: PACE_MODES.filter((mode) => !LOGGED_MODES.includes(mode)) } }, { mode: { $in: LOGGED_MODES }, askedAt: { $exists: true } }],
          },
        },
        {
          $group: {
            _id: { game: '$game', mode: '$mode', user: '$userId' },
            active: { $sum: { $cond: [{ $ifNull: ['$askedAt', false] }, asked, played] } },
            won: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
            n: { $sum: 1 },
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray()
}

async function measureDuels() {
  return (await duelRounds())
    .aggregate<PlayerPaceRow>(
      [
        { $match: { at: { $gte: new Date(Date.now() - WINDOW_MS) }, mode: { $in: DUEL_PACE_MODES } } },
        {
          $group: {
            _id: { game: '$game', mode: '$mode', bot: '$bot', user: '$userId' },
            active: { $sum: { $min: [PACE.duelCapMs, { $max: [0, '$ms'] }] } },
            won: { $sum: { $cond: ['$won', 1, 0] } },
            n: { $sum: 1 },
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray()
}

function buildWorlds(rows: TriesRow[]) {
  const solved = new Map<string, { sum: number; n: number }>()
  for (const row of rows) {
    if (!row.n) continue
    const person = `${worldKey(row._id.game, row._id.mode)}|${String(row._id.user)}`
    const total = solved.get(person) ?? { sum: 0, n: 0 }
    total.sum += row.sum
    total.n += row.n
    solved.set(person, total)
  }
  const plain = new Map<string, { sum: number; players: number }>()
  for (const [person, total] of solved) {
    const key = person.slice(0, person.indexOf('|'))
    const world = plain.get(key) ?? { sum: 0, players: 0 }
    world.sum += total.sum / total.n
    world.players += 1
    plain.set(key, world)
  }
  const penalty = (key: string) => {
    const world = plain.get(key)
    return world ? world.sum / world.players : 0
  }

  const chars = new Map<string, Map<number, { sum: number; players: number }>>()
  const players = new Map<string, { sum: number; n: number }>()
  for (const row of rows) {
    const key = worldKey(row._id.game, row._id.mode)
    const cost = row.sum + row.failedSum + row.failed * penalty(key)
    const count = row.n + row.failed
    if (!count) continue
    const list = chars.get(key) ?? new Map<number, { sum: number; players: number }>()
    const one = list.get(row._id.id) ?? { sum: 0, players: 0 }
    one.sum += cost / count
    one.players += 1
    list.set(row._id.id, one)
    chars.set(key, list)
    const person = `${key}|${String(row._id.user)}`
    const total = players.get(person) ?? { sum: 0, n: 0 }
    total.sum += cost
    total.n += count
    players.set(person, total)
  }
  const sums = new Map<string, { sum: number; players: number }>()
  for (const [person, total] of players) {
    const key = person.slice(0, person.indexOf('|'))
    const world = sums.get(key) ?? { sum: 0, players: 0 }
    world.sum += total.sum / total.n
    world.players += 1
    sums.set(key, world)
  }
  const out = new Map<string, World>()
  for (const [key, world] of sums) {
    const list = new Map<number, Mean>()
    for (const [id, one] of chars.get(key) ?? []) list.set(id, { players: one.players, avg: one.sum / one.players })
    out.set(key, { players: world.players, avg: world.sum / world.players, chars: list })
  }
  return out
}

function capPlayers(rows: PlayerPaceRow[]): PaceRow[] {
  const worlds = new Map<string, PaceRow>()
  for (const row of rows) {
    const weight = Math.min(1, PACE.playerRounds / Math.max(1, row.n))
    const key = `${row._id.game}|${row._id.mode}|${row._id.bot ? 1 : 0}`
    const world = worlds.get(key) ?? { _id: { game: row._id.game, mode: row._id.mode, bot: row._id.bot }, active: 0, won: 0 }
    world.active += row.active * weight
    world.won += row.won * weight
    worlds.set(key, world)
  }
  return [...worlds.values()]
}

function heavyTargets(players: PlayerPaceRow[], worlds: PaceRow[]) {
  const rate = new Map(worlds.map((world) => [`${world._id.game}|${paceKey(world._id.mode, world._id.bot)}`, world.won ? world.active / world.won : 0]))
  const sums = new Map<string, { ratio: number; rounds: number; players: number }>()
  for (const row of players) {
    if (row.n < PACE_AUTO.heavyRounds || !row.won) continue
    const key = paceKey(row._id.mode, row._id.bot)
    const world = rate.get(`${row._id.game}|${key}`)
    if (!world) continue
    const sum = sums.get(key) ?? { ratio: 0, rounds: 0, players: 0 }
    sum.ratio += (world / (row.active / row.won)) * row.n
    sum.rounds += row.n
    sum.players += 1
    sums.set(key, sum)
  }
  const targets = new Map<string, { target: number; faster: number | null }>()
  for (const [key, sum] of sums) {
    if (sum.players < PACE_AUTO.minPlayers || sum.rounds < PACE_AUTO.minRounds) continue
    const faster = sum.ratio / sum.rounds
    targets.set(key, { target: autoTarget(baseMode(key), faster), faster })
  }
  return targets
}

let modeTargets = new Map<string, { target: number; faster: number | null }>()

const targetOf = (key: string) => modeTargets.get(key)?.target ?? PACE_TARGET[baseMode(key)] ?? PACE.perMinute

function worldBonuses(map: Map<string, World>) {
  const modes = new Map<string, { sum: number; players: number }>()
  for (const [key, world] of map) {
    if (world.players < TRIES_MIN_PLAYERS) continue
    const mode = key.slice(key.indexOf('/') + 1)
    const total = modes.get(mode) ?? { sum: 0, players: 0 }
    total.sum += world.avg * world.players
    total.players += world.players
    modes.set(mode, total)
  }
  const out = new Map<string, number>()
  for (const [key, world] of map) {
    if (world.players < TRIES_MIN_PLAYERS) continue
    const total = modes.get(key.slice(key.indexOf('/') + 1))
    if (!total?.players) continue
    const ratio = world.avg / (total.sum / total.players)
    out.set(key, Math.min(PACE.worldBonusHigh, Math.max(PACE.worldBonusLow, ratio ** PACE.worldBonusPower)))
  }
  return out
}

function buildPaces(rows: PaceRow[], bonus: Map<string, number> = new Map()) {
  const totals = new Map<string, { active: number; won: number }>()
  for (const row of rows) {
    const key = paceKey(row._id.mode, row._id.bot)
    const total = totals.get(key) ?? { active: 0, won: 0 }
    total.active += row.active
    total.won += row.won
    totals.set(key, total)
  }
  const modes = new Map<string, Pace>()
  for (const [key, total] of totals) {
    if (total.won < PACE.minWins) continue
    modes.set(key, paceWithin(baseMode(key), paceFromTime(baseMode(key), total.active / total.won, targetOf(key))))
  }
  const perWorld = new Map<string, Pace>()
  for (const row of rows) {
    const key = paceKey(row._id.mode, row._id.bot)
    const whole = modes.get(key)
    if (!whole) continue
    const msPerWin = (row.active + PACE.priorWins * whole.msPerWin) / (row.won + PACE.priorWins)
    const pace = paceFromTime(baseMode(key), msPerWin, targetOf(key) * (bonus.get(worldKey(row._id.game, key)) ?? 1))
    perWorld.set(worldKey(row._id.game, key), { ...pace, base: Math.min(pace.base, whole.base * PACE.spread), after: Math.min(pace.after, whole.after * PACE.spread) })
  }
  return { modes, perWorld }
}

export function refreshDifficulty() {
  if (running) return running
  running = Promise.all([measureTries(), measurePace(), measureDuels()])
    .then(([triesRows, paceRows, duelRows]) => {
      const players = [...paceRows, ...duelRows]
      const capped = capPlayers(players)
      modeTargets = heavyTargets(players, capped)
      const nextWorlds = buildWorlds(triesRows)
      const { modes, perWorld } = buildPaces(capped, worldBonuses(nextWorlds))
      worlds = nextWorlds
      modePaces = modes
      worldPaces = perWorld
      builtAt = Date.now()
    })
    .catch((error) => console.error('[difficulty]', error))
    .finally(() => {
      running = null
    })
  return running
}

function stale() {
  if (!worlds || Date.now() - builtAt > FRESH_MS) void refreshDifficulty()
}

export function paceOf(mode: ModeId, game?: string, bot = false) {
  stale()
  const key = paceKey(mode, bot)
  return (game ? worldPaces.get(worldKey(game, key)) : undefined) ?? modePaces.get(key) ?? null
}

function charFactor(game: string, mode: ModeId, id: number) {
  const world = worlds?.get(worldKey(game, mode))
  if (!world || world.players < TRIES_MIN_PLAYERS) return { tries: null, factor: 1 }
  const char = world.chars.get(id)
  const seen = char?.players ?? 0
  const tries = (seen * (char?.avg ?? 0) + TRIES_PRIOR * world.avg) / (seen + TRIES_PRIOR)
  return { tries: Math.round(tries * 100) / 100, factor: triesFactor(tries, world.avg) }
}

export type SolveTarget = { game: string; id: number }

export function solveXpFor(mode: ModeId, pool: number, target?: SolveTarget) {
  const pace = paceOf(mode, target?.game)
  const { tries, factor } = target && TRIES_REF[mode] ? charFactor(target.game, mode, target.id) : { tries: null, factor: 1 }
  if (pace) return { base: triesXp(mode, factor, pace.base), after: triesXpPastCap(mode, factor, 0, pace.after), tries, factor }
  return { base: poolXp(MODE_XP[mode], mode, pool), after: poolXpPastCap(MODE_XP_AFTER[mode], mode, pool), tries, factor }
}

const PACE_UNIT: Partial<Record<ModeId, number>> = { shot: 9 }
const PACE_SPAN: Partial<Record<ModeId, readonly number[]>> = { shot: SHOT_POINTS }

export function paceXp(mode: ModeId, manual: number, game?: string, bot = false) {
  const pace = paceOf(mode, game, bot)
  if (!pace) return { base: manualXp(mode, manual), after: manualXp(mode, MODE_XP_AFTER[mode]) }
  return { base: roundXp((manual * pace.base) / (PACE_UNIT[mode] ?? MODE_XP[mode])), after: Math.max(1, Math.round(pace.after)) }
}

export type XpRate = { low: number; high: number; afterLow: number; afterHigh: number; daily: number }

export function xpRates() {
  stale()
  const out: Partial<Record<ModeId, XpRate>> = {}
  for (const [key, whole] of modePaces) {
    if (key.includes(':')) continue
    const mode = key as ModeId
    const paces = [whole, ...[...worldPaces].filter(([world]) => world.endsWith(`/${mode}`)).map(([, pace]) => pace)]
    const span = PACE_SPAN[mode]
    const unit = PACE_UNIT[mode] ?? MODE_XP[mode]
    const lows = paces.map((pace) => (span ? roundXp((Math.min(...span) * pace.base) / unit) : triesXp(mode, 1, pace.base)))
    const highs = paces.map((pace) => (span ? roundXp((Math.max(...span) * pace.base) / unit) : triesXp(mode, 1, pace.base)))
    out[mode] = {
      low: Math.min(...lows),
      high: Math.max(...highs),
      afterLow: Math.min(...paces.map((pace) => triesXpPastCap(mode, 1, 1, pace.after))),
      afterHigh: Math.max(...paces.map((pace) => triesXpPastCap(mode, 1, 1000, pace.after))),
      daily: DAILY_XP_MODES.includes(mode) ? DAILY_XP_FACTOR : 1,
    }
  }
  return out
}

export function paceReport() {
  stale()
  const round1 = (value: number) => Math.round(value * 10) / 10
  return Object.fromEntries([...modePaces].map(([mode, pace]) => [mode, { base: round1(pace.base), after: round1(pace.after), seconds: round1(pace.msPerWin / 1000), target: round1(pace.target), faster: modeTargets.get(mode)?.faster ? round1(modeTargets.get(mode)!.faster!) : null }]))
}
