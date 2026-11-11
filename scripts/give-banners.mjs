import { MongoClient, ObjectId } from 'mongodb'
import { BANNERS } from '../packages/game/src/specs.ts'

const who = process.argv[2]
const apply = process.argv.includes('--apply')

if (!who || who.startsWith('-')) {
  console.error('вкажи гравця: npm run banners -- <нік|#TAG|id> [--apply]')
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const query = ObjectId.isValid(who)
  ? { _id: new ObjectId(who) }
  : who.startsWith('#')
    ? { tag: who.slice(1).toUpperCase() }
    : { nicknameLower: who.toLowerCase() }

const doc = await users.findOne(query, { projection: { nickname: 1, banners: 1 } })
if (!doc) {
  console.error('гравця не знайшов')
  await client.close()
  process.exit(1)
}

const missing = BANNERS.filter((banner) => !(doc.banners ?? []).includes(banner))
console.log(`${doc.nickname ?? doc._id}: є ${BANNERS.length - missing.length}/${BANNERS.length}, додаємо ${missing.length}${missing.length ? `: ${missing.join(', ')}` : ''}`)

if (apply && missing.length) {
  await users.updateOne({ _id: doc._id }, { $addToSet: { banners: { $each: missing }, bannersGiven: { $each: missing } } })
  console.log('готово')
} else if (!apply) {
  console.log('це перегляд, додай --apply щоб записати')
}

await client.close()
