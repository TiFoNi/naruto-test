import { MongoClient, ObjectId } from 'mongodb'

const [who, raw] = process.argv.slice(2)
const amount = Number(raw)

if (!who || !Number.isFinite(amount) || !amount) {
  console.log('використання: npm run xp -- <нік або пошта> <скільки>\nнаприклад: npm run xp -- Injani 660')
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const zone = 'Europe/Kyiv'
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date())
    .map((part) => [part.type, part.value]),
)
const season = `${parts.year}-${parts.month}`

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const key = who.toLowerCase()

const user = await db.collection('users').findOne({
  $or: [{ nicknameLower: key }, { usernameLower: key }, ...(ObjectId.isValid(who) ? [{ _id: new ObjectId(who) }] : [])],
})

if (!user) {
  console.log(`гравця «${who}» не знайдено в базі ${db.databaseName}`)
  await client.close()
  process.exit(1)
}

const before = user.xp ?? 0
await db.collection('users').updateOne({ _id: user._id }, { $inc: { xp: amount } })
await db.collection('seasons').updateOne(
  { _id: `${season}:${user._id.toHexString()}` },
  { $inc: { xp: amount }, $setOnInsert: { season, userId: user._id, solved: 0, days: [] } },
  { upsert: true },
)

const seasonRow = await db.collection('seasons').findOne({ _id: `${season}:${user._id.toHexString()}` })
console.log(`${user.nickname ?? user.username}: загальний XP ${before} → ${before + amount}, сезон ${season}: ${seasonRow.xp}`)
await client.close()
