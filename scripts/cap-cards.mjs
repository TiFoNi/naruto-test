import { MongoClient } from 'mongodb'
import { CARD_MAX_LEVEL, cardPoints } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const cards = db.collection('cards')
const rounds = db.collection('rounds')

function share(left, leftover) {
  const total = Object.values(leftover).reduce((sum, value) => sum + value, 0)
  if (total <= 0 || left <= 0) return {}
  const raw = Object.entries(leftover).map(([mode, value]) => [mode, (value / total) * left])
  const out = Object.fromEntries(raw.map(([mode, value]) => [mode, Math.floor(value)]))
  let rest = left - Object.values(out).reduce((sum, value) => sum + value, 0)
  for (const [mode] of raw.sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (rest <= 0) break
    out[mode]++
    rest--
  }
  return out
}

async function firstPoints(card) {
  const history = await rounds
    .find(
      { userId: card.userId, game: card.game, answerId: card.entityId, status: 'won', guest: { $ne: true }, challenge: { $exists: false } },
      { projection: { mode: 1, daily: 1, createdAt: 1, finishedAt: 1 } },
    )
    .toArray()
  history.sort((a, b) => (a.finishedAt ?? a.createdAt) - (b.finishedAt ?? b.createdAt))

  const per = {}
  let total = 0
  for (const round of history) {
    if (total >= CARD_MAX_LEVEL) break
    const give = Math.min(cardPoints(round.mode, !!round.daily), CARD_MAX_LEVEL - total)
    if (give <= 0) continue
    per[round.mode] = (per[round.mode] ?? 0) + give
    total += give
  }

  const modes = card.modes ?? {}
  const leftover = Object.fromEntries(Object.entries(modes).map(([mode, one]) => [mode, Math.max(0, (one?.xp ?? 0) - (per[mode] ?? 0))]))
  for (const [mode, extra] of Object.entries(share(CARD_MAX_LEVEL - total, leftover))) per[mode] = (per[mode] ?? 0) + extra
  return per
}

const over = await cards.find({ xp: { $gt: CARD_MAX_LEVEL } }).toArray()
const owners = new Set(over.map((card) => card.userId.toHexString()))
console.log(`карток понад ${CARD_MAX_LEVEL}: ${over.length}, гравців: ${owners.size}`)

let shown = 0
for (const card of over) {
  const per = await firstPoints(card)
  const set = { xp: CARD_MAX_LEVEL }
  for (const mode of Object.keys(card.modes ?? {})) set[`modes.${mode}.xp`] = per[mode] ?? 0
  if (shown < 5) {
    const before = Object.entries(card.modes ?? {}).map(([mode, one]) => `${mode} ${one?.xp ?? 0}`).join(', ')
    const after = Object.entries(per).map(([mode, xp]) => `${mode} ${xp}`).join(', ')
    console.log(`${card._id}: ${card.xp} → ${CARD_MAX_LEVEL} | було: ${before} | стане: ${after}`)
    shown++
  }
  if (write) await cards.updateOne({ _id: card._id }, { $set: set })
}

console.log(write ? `обрізано до ${CARD_MAX_LEVEL}: ${over.length}` : 'це перевірка, нічого не змінено; для запису додай --write')
await client.close()
