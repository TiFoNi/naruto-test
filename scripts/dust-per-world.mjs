import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')
const game = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'naruto'

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const list = await users.find({ dust: { $type: 'number' } }, { projection: { nickname: 1, dust: 1 } }).toArray()
console.log(`старий спільний пил → ${game}`)
for (const one of list) console.log(`  ${one.nickname ?? one._id}: ${one.dust}`)
console.log('гравців:', list.length)

if (!write) console.log('\nпрогін без запису. додай --write')
else {
  const res = list.length ? await users.bulkWrite(list.map((one) => ({ updateOne: { filter: { _id: one._id, dust: one.dust }, update: { $set: { dust: { [game]: one.dust } } } } })), { ordered: false }) : null
  console.log('перенесено:', res?.modifiedCount ?? 0)
}

await client.close()
