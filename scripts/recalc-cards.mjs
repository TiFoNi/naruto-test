import { MongoClient, ObjectId } from 'mongodb'
import { CARD_MAX_LEVEL, SHARD_GAMES, cardPoints } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const totals = new Map()
const add = (userId, game, id, mode, xp) => {
  if (!userId || !game || SHARD_GAMES.includes(game) || !Number.isInteger(id) || xp <= 0) return
  const key = `${userId.toHexString()}:${game}:${id}`
  const card = totals.get(key) ?? { userId, game, entityId: id, xp: 0, modes: {} }
  card.xp += xp
  const one = (card.modes[mode] ??= { n: 0, xp: 0 })
  one.n += 1
  one.xp += xp
  totals.set(key, card)
}

const rounds = db.collection('rounds').find(
  { status: 'won', guest: { $ne: true }, challenge: { $exists: false }, game: { $nin: [...SHARD_GAMES] } },
  { projection: { userId: 1, game: 1, mode: 1, answerId: 1, daily: 1 } },
)
let seen = 0
for await (const round of rounds) {
  seen++
  add(round.userId, round.game, round.answerId, round.mode, cardPoints(round.mode, !!round.daily))
}

console.log(`раундів у історії: ${seen}`)

const cards = db.collection('cards')
const capped = cards.find({ game: { $nin: [...SHARD_GAMES] }, xp: { $gte: CARD_MAX_LEVEL } }, { projection: { userId: 1, game: 1, entityId: 1, xp: 1, modes: 1 } })
const fixes = []
let checked = 0
let fromDuels = 0
for await (const doc of capped) {
  checked++
  const past = totals.get(doc._id) ?? { userId: doc.userId, game: doc.game, entityId: doc.entityId, xp: 0, modes: {} }
  const card = { ...past, modes: Object.fromEntries(Object.entries(past.modes).map(([mode, one]) => [mode, { ...one }])) }
  for (const [mode, one] of Object.entries(doc.modes ?? {})) {
    const known = card.modes[mode]?.n ?? 0
    const more = Math.max(0, (one?.n ?? 0) - known)
    if (!more) continue
    const xp = more * cardPoints(mode, false)
    const slot = (card.modes[mode] ??= { n: 0, xp: 0 })
    slot.n += more
    slot.xp += xp
    card.xp += xp
    fromDuels += xp
  }
  const before = doc.xp ?? 0
  if (card.xp > before) fixes.push({ key: doc._id, card, before })
}
console.log(`перевірено карток на стелі: ${checked}, із них очок за дуелі: ${fromDuels}`)

const people = new Map()
let extra = 0
for (const { card, before } of fixes) {
  const owner = card.userId.toHexString()
  people.set(owner, (people.get(owner) ?? 0) + card.xp - before)
  extra += card.xp - before
}
console.log(`карток із втраченими очками: ${fixes.length}, гравців: ${people.size}, повернеться очок: ${extra}`)

const byGame = new Map()
for (const { card } of fixes) byGame.set(card.game, (byGame.get(card.game) ?? 0) + 1)
console.log('по всесвітах:', [...byGame.entries()].sort((a, b) => b[1] - a[1]).map(([game, count]) => `${game} ${count}`).join(', '))

const top = [...people.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
if (top.length) {
  const names = new Map(
    (await db.collection('users').find({ _id: { $in: top.map(([id]) => new ObjectId(id)) } }, { projection: { nickname: 1, username: 1 } }).toArray()).map((one) => [
      one._id.toHexString(),
      one.nickname ?? one.username,
    ]),
  )
  console.log('кому найбільше:', top.map(([id, count]) => `${names.get(id) ?? id} +${count}`).join(', '))
}
for (const { key, card, before } of fixes.sort((a, b) => b.card.xp - a.card.xp).slice(0, 8)) {
  console.log(`  ${key}: ${before} → ${card.xp} | ${Object.entries(card.modes).map(([mode, one]) => `${mode} ${one.xp}`).join(', ')}`)
}

if (!write) {
  console.log('\nце перевірка, нічого не змінено; для запису: npm run cards:recalc -- --write')
  await client.close()
  process.exit(0)
}

for (let i = 0; i < fixes.length; i += 1000) {
  const batch = fixes.slice(i, i + 1000).map(({ key, card }) => {
    const most = { xp: card.xp }
    for (const [mode, one] of Object.entries(card.modes)) {
      most[`modes.${mode}.xp`] = one.xp
      most[`modes.${mode}.n`] = one.n
    }
    return {
      updateOne: {
        filter: { _id: key },
        update: { $max: most, $set: { updatedAt: new Date() }, $setOnInsert: { userId: card.userId, game: card.game, entityId: card.entityId } },
        upsert: true,
      },
    }
  })
  await cards.bulkWrite(batch, { ordered: false })
  console.log(`  записано ${Math.min(i + 1000, fixes.length)} з ${fixes.length}`)
}
await client.close()
