import type { Document } from 'mongodb'
import { adminSession } from '../admin'
import type { ModeId } from '@nanda/game'
import { rounds } from '../db'
import { paceReport, refreshDifficulty, solveXpFor } from '../difficulty'
import { modePool } from '../extra'
import { gameData, isGame, isMode } from '../games'
import { fail, handle, json } from '../http'

const FRESH_MS = 10 * 60_000
const KINDS = ['all', 'endless', 'daily'] as const
type Kind = (typeof KINDS)[number]

type Tally = { rounds: number; won: number; lost: number; skipped: number; first: number; tries: number; tried: number }
type PlayerRow = { _id: { key: string; user: unknown }; rounds: number; won: number; lost: number; skipped: number; first: number; tries: number; tried: number }
type SpreadRow = { _id: { key: string; tries: number }; n: number }

export type DifficultyRow = {
  key: string
  rounds: number
  players: number
  won: number
  lost: number
  skipped: number
  first: number
  avg: number | null
  playerAvg: number | null
  median: number | null
}

const attempts = { $ifNull: ['$guessCount', { $size: { $ifNull: ['$guesses', []] } }] }
const isWon = { $eq: ['$status', 'won'] }
const counted = { $and: [isWon, { $gt: [attempts, 0] }] }

const kindFilter = (kind: Kind) => (kind === 'daily' ? { daily: { $type: 'string' } } : kind === 'endless' ? { daily: { $exists: false } } : {})

const round2 = (value: number) => Math.round(value * 100) / 100

function median(spread: Map<number, number>) {
  const total = [...spread.values()].reduce((sum, n) => sum + n, 0)
  if (!total) return null
  const sorted = [...spread.entries()].sort((a, b) => a[0] - b[0])
  const at = (index: number) => {
    let seen = 0
    for (const [tries, n] of sorted) {
      seen += n
      if (index < seen) return tries
    }
    return sorted[sorted.length - 1][0]
  }
  return total % 2 ? at((total - 1) / 2) : (at(total / 2 - 1) + at(total / 2)) / 2
}

async function measure(match: Document, key: unknown): Promise<DifficultyRow[]> {
  const collection = await rounds()
  const base = { guest: { $ne: true }, status: { $in: ['won', 'lost', 'skipped'] }, ...match }
  const [players, spread] = await Promise.all([
    collection
      .aggregate<PlayerRow>(
        [
          { $match: base },
          {
            $group: {
              _id: { key, user: '$userId' },
              rounds: { $sum: 1 },
              won: { $sum: { $cond: [isWon, 1, 0] } },
              lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
              skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
              first: { $sum: { $cond: [{ $and: [isWon, { $eq: [attempts, 1] }] }, 1, 0] } },
              tries: { $sum: { $cond: [counted, attempts, 0] } },
              tried: { $sum: { $cond: [counted, 1, 0] } },
            },
          },
        ],
        { allowDiskUse: true },
      )
      .toArray(),
    collection
      .aggregate<SpreadRow>(
        [
          { $match: { ...base, status: 'won' } },
          { $project: { key, tries: attempts } },
          { $match: { tries: { $gt: 0 } } },
          { $group: { _id: { key: '$key', tries: '$tries' }, n: { $sum: 1 } } },
        ],
        { allowDiskUse: true },
      )
      .toArray(),
  ])

  const sums = new Map<string, Tally & { players: number; playerAvgSum: number; playerAvgCount: number }>()
  for (const row of players) {
    const id = String(row._id.key)
    const sum = sums.get(id) ?? { rounds: 0, won: 0, lost: 0, skipped: 0, first: 0, tries: 0, tried: 0, players: 0, playerAvgSum: 0, playerAvgCount: 0 }
    sum.rounds += row.rounds
    sum.won += row.won
    sum.lost += row.lost
    sum.skipped += row.skipped
    sum.first += row.first
    sum.tries += row.tries
    sum.tried += row.tried
    sum.players += 1
    if (row.tried) {
      sum.playerAvgSum += row.tries / row.tried
      sum.playerAvgCount += 1
    }
    sums.set(id, sum)
  }

  const spreads = new Map<string, Map<number, number>>()
  for (const row of spread) {
    const id = String(row._id.key)
    const one = spreads.get(id) ?? new Map<number, number>()
    one.set(row._id.tries, (one.get(row._id.tries) ?? 0) + row.n)
    spreads.set(id, one)
  }

  return [...sums.entries()].map(([id, sum]) => ({
    key: id,
    rounds: sum.rounds,
    players: sum.players,
    won: sum.won,
    lost: sum.lost,
    skipped: sum.skipped,
    first: sum.first,
    avg: sum.tried ? round2(sum.tries / sum.tried) : null,
    playerAvg: sum.playerAvgCount ? round2(sum.playerAvgSum / sum.playerAvgCount) : null,
    median: median(spreads.get(id) ?? new Map()),
  }))
}

export async function difficultyOverview(kind: Kind) {
  const rows = await measure(kindFilter(kind), { $concat: ['$game', '/', '$mode'] })
  return rows
    .map((row) => {
      const [game, mode] = row.key.split('/')
      return { ...row, game, mode }
    })
    .sort((a, b) => a.game.localeCompare(b.game) || a.mode.localeCompare(b.mode))
}

export async function difficultyCharacters(kind: Kind, game: string, mode: string) {
  const [rows, data] = await Promise.all([measure({ ...kindFilter(kind), game, mode }, '$answerId'), isGame(game) ? gameData(game) : null])
  const pool = data ? modePool(data.pool, mode as ModeId).length : 0
  return rows
    .map((row) => {
      const id = Number(row.key)
      const entity = data?.byId.get(id)
      const xp = solveXpFor(mode as ModeId, pool, { game, id })
      return {
        ...row,
        id,
        xp: xp.base,
        xpAfter: xp.after,
        tries: xp.tries,
        name: typeof entity?.name === 'string' ? entity.name : `#${id}`,
        nameEn: typeof entity?.nameEn === 'string' ? entity.nameEn : undefined,
        nameUk: typeof entity?.nameUk === 'string' ? entity.nameUk : undefined,
        thumb: typeof entity?.thumb === 'number' ? entity.thumb : -1,
        gone: !entity,
      }
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.rounds - a.rounds)
}

type Entry = { at: number; data: unknown }
const store = new Map<string, Entry>()
const running = new Map<string, Promise<Entry>>()

function refresh(key: string, load: () => Promise<unknown>) {
  const busy = running.get(key)
  if (busy) return busy
  const job = load()
    .then((data) => {
      const entry = { at: Date.now(), data }
      store.set(key, entry)
      return entry
    })
    .finally(() => running.delete(key))
  running.set(key, job)
  return job
}

async function remember(key: string, load: () => Promise<unknown>, force: boolean) {
  const hit = store.get(key)
  if (hit && !force) {
    if (Date.now() - hit.at > FRESH_MS) void refresh(key, load).catch(() => null)
    return hit
  }
  return refresh(key, load)
}

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const params = new URL(request.url).searchParams
  const kind = (params.get('kind') ?? 'all') as Kind
  if (!KINDS.includes(kind)) return fail(400, 'bad_request')
  const force = params.get('fresh') === '1'
  const game = params.get('game')
  const mode = params.get('mode')

  if (game || mode) {
    if (!isGame(game) || !isMode(mode)) return fail(400, 'bad_request')
    if (force) await refreshDifficulty()
    const entry = await remember(`${kind}:${game}:${mode}`, () => difficultyCharacters(kind, game, mode), force)
    const data = await gameData(game)
    const typical = solveXpFor(mode, modePool(data.pool, mode).length, { game, id: -1 })
    return json({ kind, game, mode, at: entry.at, rows: entry.data, xp: typical.base, xpAfter: typical.after, tries: typical.tries })
  }

  if (force) await refreshDifficulty()
  const entry = await remember(kind, () => difficultyOverview(kind), force)
  return json({ kind, at: entry.at, rows: entry.data, pace: paceReport() })
})
