import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const args = process.argv.slice(2)
const write = args.includes('--write')
const [nickname, game = 'naruto'] = args.filter((arg) => !arg.startsWith('--'))
if (!nickname) throw new Error('використання: npm run cards:max -- <нік> [гра] [--write]')

const TOP = 5

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const users = db.collection('users')
const cards = db.collection('cards')
const entities = db.collection('entities')

const user = await users.findOne({ nicknameLower: nickname.toLowerCase() }, { projection: { nickname: 1 } })
if (!user) throw new Error(`гравця «${nickname}» не знайшов`)
const ids = (await entities.find({ game, hidden: { $ne: true } }, { projection: { _id: 0, id: 1 } }).toArray()).map((one) => one.id)
const key = (id) => `${user._id.toHexString()}:${game}:${id}`
const had = await cards.countDocuments({ _id: { $in: ids.map(key) }, rank: TOP })

console.log(`${user.nickname} · ${game}: персів ${ids.length}, вже міфічних ${had}`)

if (!write) console.log('\nпрогін без запису. додай --write')
else {
  const now = new Date()
  const res = await cards.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: key(id) },
        update: { $set: { rank: TOP, shards: 0, updatedAt: now }, $setOnInsert: { userId: user._id, game, entityId: id, xp: 0, modes: {} } },
        upsert: true,
      },
    })),
    { ordered: false },
  )
  await users.updateOne({ _id: user._id }, { $addToSet: { [`dex.${game}`]: { $each: ids } } })
  console.log('міфічними стали:', res.modifiedCount + res.upsertedCount)
}

await client.close()
