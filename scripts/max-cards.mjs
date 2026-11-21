import { MongoClient } from 'mongodb'

const RARITIES = ['paper', 'bronze', 'silver', 'gold', 'legend', 'mythic']

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const args = process.argv.slice(2)
const write = args.includes('--write')
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const rarity = option('rarity') ?? 'mythic'
const rank = RARITIES.indexOf(rarity)
if (rank < 0) throw new Error(`рідкість має бути одна з: ${RARITIES.join(', ')}`)
const [who, game = 'naruto'] = args.filter((arg) => !arg.startsWith('--'))
if (!who) throw new Error('використання: npm run cards:max -- <нік або пошта> [гра] [--rarity=silver] [--write]')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const users = db.collection('users')
const cards = db.collection('cards')
const entities = db.collection('entities')

const filter = who.includes('@') ? { username: who.toLowerCase() } : { nicknameLower: who.toLowerCase() }
const found = await users.find(filter, { projection: { nickname: 1, tag: 1 } }).toArray()
if (found.length !== 1) throw new Error(found.length ? `таких акаунтів ${found.length}` : `гравця «${who}» не знайшов`)
const [user] = found
const ids = (await entities.find({ game, hidden: { $ne: true } }, { projection: { _id: 0, id: 1 } }).toArray()).map((one) => one.id)
const key = (id) => `${user._id.toHexString()}:${game}:${id}`
const had = await cards.countDocuments({ _id: { $in: ids.map(key) }, rank: { $gte: rank } })

console.log(`${user.nickname}#${user.tag ?? ''} · ${game}: персів ${ids.length}, вже ${rarity} або вище: ${had}, стануть ${rarity}: ${ids.length - had}`)

if (!write) console.log('\nпрогін без запису. додай --write')
else {
  const now = new Date()
  const res = await cards.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: key(id) },
        update: { $max: { rank }, $set: { updatedAt: now }, $setOnInsert: { userId: user._id, game, entityId: id, xp: 0, shards: 0, modes: {} } },
        upsert: true,
      },
    })),
    { ordered: false },
  )
  await users.updateOne({ _id: user._id }, { $addToSet: { [`dex.${game}`]: { $each: ids } } })
  console.log(`стали ${rarity}:`, res.modifiedCount + res.upsertedCount)
}

await client.close()
