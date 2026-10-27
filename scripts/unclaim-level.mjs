import { MongoClient } from 'mongodb'

const [who, raw] = process.argv.slice(2).filter((one) => !one.startsWith('--'))
const level = Number(raw)
if (!who || !Number.isInteger(level)) throw new Error('використання: node scripts/unclaim-level.mjs <пошта або "нік#TAG"> 65 [--dry]')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const [nickname, tag] = who.split('#')
const query = who.includes('@') ? { usernameLower: who.toLowerCase() } : { nicknameLower: nickname.toLowerCase(), tag }
const dry = process.argv.includes('--dry')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const person = await users.findOne(query, { projection: { nickname: 1, tag: 1, levelsTaken: 1 } })
if (!person) throw new Error(`не знайдено ${who}`)

const taken = person.levelsTaken ?? []
console.log(`${person.nickname}#${person.tag}: забрані рівні ${taken.length ? taken.join(', ') : '—'}`)

if (!taken.includes(level)) console.log(`рівень ${level} і так не забраний`)
else if (dry) console.log(`прибрав би рівень ${level} (пробний прогін)`)
else {
  await users.updateOne({ _id: person._id }, { $pull: { levelsTaken: level } })
  console.log(`рівень ${level} знову можна забрати`)
}

await client.close()
