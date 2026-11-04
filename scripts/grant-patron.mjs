import { MongoClient } from 'mongodb'

const TITLE = 'patron'
const apply = process.argv.includes('--apply')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const buyers = await db.collection('purchases').distinct('userId', { status: 'paid' })
const need = await db
  .collection('users')
  .find({ _id: { $in: buyers }, titles: { $ne: TITLE } }, { projection: { nickname: 1, username: 1 } })
  .toArray()

console.log(`покупців: ${buyers.length}, без титулу «Меценат»: ${need.length}`)
for (const one of need) console.log(`  ${one.nickname ?? '—'} (${one.username ?? '—'})`)

if (!apply) {
  console.log('\nце перевірка, нічого не змінено. щоб видати: node --env-file-if-exists=.env.local scripts/grant-patron.mjs --apply')
} else if (need.length) {
  const done = await db.collection('users').updateMany({ _id: { $in: need.map((one) => one._id) } }, { $addToSet: { titles: TITLE } })
  console.log(`\nвидано: ${done.modifiedCount}`)
}

await client.close()
