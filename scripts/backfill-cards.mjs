import { MongoClient, ObjectId } from 'mongodb'
import { cardPoints, cardRank, CARD_RARITIES } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')

const gain = (game, mode, daily) => cardPoints(mode, daily)

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const totals = new Map()
const add = (userId, game, id, mode, xp) => {
  if (!game || !Number.isInteger(id) || xp <= 0) return
  const key = `${userId.toHexString()}:${game}:${id}`
  const card = totals.get(key) ?? { userId, game, entityId: id, xp: 0, modes: {} }
  card.xp += xp
  const one = (card.modes[mode] ??= { n: 0, xp: 0 })
  one.n += 1
  one.xp += xp
  totals.set(key, card)
}

const rounds = db.collection('rounds').find(
  { status: 'won', guest: { $ne: true }, challenge: { $exists: false } },
  { projection: { userId: 1, game: 1, mode: 1, answerId: 1, daily: 1 } },
)
let seen = 0
for await (const round of rounds) {
  seen++
  add(round.userId, round.game, round.answerId, round.mode, gain(round.game, round.mode, !!round.daily))
}

const duels = db.collection('duels').find({ status: 'finished', bot: { $ne: true } }, { projection: { game: 1, mode: 1, answerId: 1, players: 1 } })
let fights = 0
for await (const duel of duels) {
  fights++
  for (const side of duel.players ?? []) {
    if (!side.solvedAt) continue
    const id = duel.mode === 'who' ? side.answer : duel.answerId
    add(side.userId, duel.game, id, duel.mode, gain(duel.game, duel.mode, false))
  }
}

const list = [...totals.entries()]
const people = new Set(list.map(([, card]) => card.userId.toHexString())).size
console.log(`раундів ${seen}, дуелей ${fights} → карток ${list.length} у ${people} гравців`)

const byRarity = Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, 0]))
const maxed = new Map()
const byGame = new Map()
for (const [, card] of list) {
  const { rarity } = cardRank(card.xp)
  byRarity[rarity]++
  if (rarity !== CARD_RARITIES.at(-1)) continue
  const owner = card.userId.toHexString()
  maxed.set(owner, (maxed.get(owner) ?? 0) + 1)
  byGame.set(card.game, (byGame.get(card.game) ?? 0) + 1)
}
console.log('\nрідкості:')
for (const [rarity, count] of Object.entries(byRarity)) console.log(`  ${rarity.padEnd(7)} ${count}`)
console.log(`\nмаксимальних карток ${byRarity[CARD_RARITIES.at(-1)]} у ${maxed.size} гравців`)
console.log('по всесвітах:', [...byGame.entries()].sort((a, b) => b[1] - a[1]).map(([game, count]) => `${game} ${count}`).join(', '))
const top = [...maxed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
if (top.length) {
  const names = new Map(
    (await db.collection('users').find({ _id: { $in: top.map(([id]) => new ObjectId(id)) } }, { projection: { nickname: 1 } }).toArray()).map((one) => [one._id.toHexString(), one.nickname]),
  )
  console.log('топ гравців:', top.map(([id, count]) => `${names.get(id) ?? id} ${count}`).join(', '))
}

if (!write) {
  console.log('\nпробний прогін, нічого не записано. щоб записати: npm run cards:backfill -- --write')
  await client.close()
  process.exit(0)
}

const cards = db.collection('cards')
await cards.createIndex({ userId: 1, game: 1 })
for (let i = 0; i < list.length; i += 1000) {
  const batch = list.slice(i, i + 1000).map(([key, card]) => ({
    updateOne: { filter: { _id: key }, update: { $set: { ...card, updatedAt: new Date() } }, upsert: true },
  }))
  await cards.bulkWrite(batch, { ordered: false })
  console.log(`  записано ${Math.min(i + 1000, list.length)} з ${list.length}`)
}
await client.close()
