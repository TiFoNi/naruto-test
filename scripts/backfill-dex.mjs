import { MongoClient } from 'mongodb'

const apply = process.argv.includes('--apply')
const BATCH = 500

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const found = db.collection('rounds').aggregate(
  [
    { $match: { status: 'won', guest: { $ne: true }, challenge: { $exists: false }, answerId: { $type: 'number' } } },
    { $group: { _id: { userId: '$userId', game: '$game' }, ids: { $addToSet: '$answerId' } } },
  ],
  { allowDiskUse: true },
)

let groups = 0
let opened = 0
let batch = []

const flush = async () => {
  if (!batch.length) return
  if (apply) await db.collection('users').bulkWrite(batch, { ordered: false })
  batch = []
}

for await (const row of found) {
  groups += 1
  opened += row.ids.length
  batch.push({ updateOne: { filter: { _id: row._id.userId }, update: { $addToSet: { [`dex.${row._id.game}`]: { $each: row.ids } } } } })
  if (batch.length >= BATCH) await flush()
}
await flush()

console.log(`гравців × всесвітів: ${groups}, відкритих персонажів: ${opened}`)
if (!apply) console.log('це перевірка, нічого не змінено. щоб записати: node --env-file-if-exists=.env.local scripts/backfill-dex.mjs --apply')

await client.close()
