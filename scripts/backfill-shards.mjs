import { MongoClient, ObjectId } from 'mongodb'
import { CARD_RARITIES, CARD_STEPS, CARD_UP, DUST_CRAFT } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')

const FULL_CARDS = 4
const reach = CARD_UP.reduce((all, need, at) => [...all, all[at] + need * DUST_CRAFT], [0]).slice(0, CARD_RARITIES.length)
const cap = reach[CARD_RARITIES.length - 1] * FULL_CARDS

const tierOf = (xp) => {
  let tier = 0
  while (tier + 1 < CARD_STEPS.length && xp >= CARD_STEPS[tier + 1].xp) tier += 1
  return tier
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const cards = db.collection('cards')
const users = db.collection('users')

const list = await cards.find({ rank: { $exists: false } }, { projection: { userId: 1, xp: 1, shards: 1 } }).toArray()

const owed = new Map()
const byTier = new Map()
for (const card of list) {
  const tier = tierOf(card.xp ?? 0)
  byTier.set(tier, (byTier.get(tier) ?? 0) + 1)
  const key = card.userId.toHexString()
  owed.set(key, (owed.get(key) ?? 0) + reach[tier])
}

const gifts = [...owed].map(([id, sum]) => ({ id, sum, dust: Math.min(sum, cap) })).filter((one) => one.dust > 0)
const capped = gifts.filter((one) => one.sum > cap).length
const total = gifts.reduce((sum, one) => sum + one.dust, 0)

console.log('карток без нової рідкості:', list.length, '· гравців з компенсацією:', gifts.length)
console.log('стара рідкість → карток (вартість докрафту до неї):')
for (const [tier, n] of [...byTier].sort((a, b) => a[0] - b[0])) console.log(`  ${CARD_RARITIES[tier]}: ${n}  (${reach[tier]} пилу)`)
console.log(`стеля на гравця: ${cap} пилу (= ${FULL_CARDS} повні карти) · упираються в стелю: ${capped}`)
console.log('всього пилу видаємо:', total)
for (const one of gifts.sort((a, b) => b.dust - a.dust).slice(0, 8)) console.log(`  ${one.id}: ${one.dust}${one.sum > cap ? ` (заробив би ${one.sum})` : ''}`)

if (!write) console.log('\nпрогін без запису. додай --write')
else {
  if (gifts.length) await users.bulkWrite(gifts.map((one) => ({ updateOne: { filter: { _id: new ObjectId(one.id) }, update: { $inc: { dust: one.dust } } } })), { ordered: false })
  const res = list.length ? await cards.bulkWrite(list.map((card) => ({ updateOne: { filter: { _id: card._id }, update: { $set: { rank: 0, shards: card.shards ?? 0 } } } })), { ordered: false }) : null
  console.log('пил видано:', gifts.length, 'гравцям · карток оновлено:', res?.modifiedCount ?? 0)
}

await client.close()
