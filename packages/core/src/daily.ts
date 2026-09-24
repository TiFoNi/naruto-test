import { createHmac } from 'node:crypto'
import type { GameId, ModeId } from '@nanda/game'
import { dailies } from './db'
import { gameData } from './games'
import { roundExtra } from './extra'

const ZONE = 'Europe/Kyiv'
const LAUNCH = '2026-09-22'
const DAY_MS = 86_400_000

const parts = (now: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )

export function today(now = new Date()) {
  const p = parts(now)
  return `${p.year}-${p.month}-${p.day}`
}

export function nextReset(now = new Date()) {
  const p = parts(now)
  const elapsed = (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)) * 1000 + now.getMilliseconds()
  return now.getTime() + DAY_MS - elapsed
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

export const shiftDay = (day: string, delta: number) => new Date((dayNumber(day) + delta) * DAY_MS).toISOString().slice(0, 10)

export const dailyNumber = (day: string) => dayNumber(day) - dayNumber(LAUNCH) + 1

const secret = () => process.env.DAILY_SECRET || process.env.AUTH_SECRET || ''

async function pick(game: GameId, mode: ModeId, day: string) {
  const ids = (await gameData(game)).pool.map((e) => e.id).sort((a, b) => a - b)
  const n = dayNumber(day)
  const cycle = Math.floor(n / ids.length)
  const weight = (id: number) => createHmac('sha256', secret()).update(`${game}:${mode}:${cycle}:${id}`).digest('hex')
  const order = ids.map((id) => [weight(id), id] as const).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return order[n % ids.length][1]
}

export async function dailyAnswer(game: GameId, mode: ModeId, day: string) {
  const collection = await dailies()
  const _id = `${day}:${game}:${mode}`
  const doc = await collection.findOneAndUpdate(
    { _id },
    { $setOnInsert: await dailySeed(game, mode, day) },
    { upsert: true, returnDocument: 'after' },
  )
  if ((await gameData(game)).byId.has(doc!.answerId)) return { answerId: doc!.answerId, extra: doc!.extra }
  const seed = await dailySeed(game, mode, day)
  await collection.updateOne({ _id }, { $set: { answerId: seed.answerId, extra: seed.extra } })
  return { answerId: seed.answerId, extra: seed.extra }
}

async function dailySeed(game: GameId, mode: ModeId, day: string) {
  const answerId = await pick(game, mode, day)
  const roll = parseInt(createHmac('sha256', secret()).update(`${game}:${mode}:${day}:extra`).digest('hex').slice(0, 8), 16) / 0x100000000
  return { day, game, mode, answerId, extra: await roundExtra(game, mode, answerId, roll), createdAt: new Date() }
}

export async function pastAnswer(game: GameId, mode: ModeId, day: string) {
  const doc = await (await dailies()).findOne({ _id: `${day}:${game}:${mode}` })
  return doc && (await gameData(game)).byId.has(doc.answerId) ? doc.answerId : null
}
